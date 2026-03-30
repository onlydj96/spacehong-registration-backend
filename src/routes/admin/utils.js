/**
 * Admin Route Utilities
 * 공통 상수, 유틸리티 함수, 미들웨어
 */
import { supabase } from '../../services/supabase.js';

// ===== Constants =====

export const CACHE_TTL = {
  STATS: 60,
  STATISTICS: 300,
  LIST: 30,
};

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
};

// Admin email whitelist from environment variable
// SECURITY: If no ADMIN_EMAILS configured, only role-based auth is allowed
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

// Security warning if no email whitelist is configured
if (ADMIN_EMAILS.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn(
    '[SECURITY WARNING] ADMIN_EMAILS environment variable is not set. ' +
    'Admin access will only be allowed via user metadata role. ' +
    'Set ADMIN_EMAILS for additional security layer.'
  );
}

// ===== Utility Functions =====

/**
 * Sanitize search term to prevent SQL injection and special character abuse
 *
 * 제거하는 문자:
 * - % _ : SQL LIKE 와일드카드
 * - \ ' " : 이스케이프 및 문자열 구분자
 * - ; : SQL 구문 종료
 * - - (연속 2개): SQL 주석
 * - < > : XSS 방지
 */
export const sanitizeSearchTerm = (term) => {
  if (!term || typeof term !== 'string') return '';
  return term
    .trim()
    .replace(/%/g, '')           // SQL LIKE wildcard
    .replace(/_/g, '')           // SQL LIKE single char wildcard
    .replace(/\\/g, '')          // Escape character
    .replace(/'/g, '')           // Single quote
    .replace(/"/g, '')           // Double quote
    .replace(/;/g, '')           // SQL statement terminator
    .replace(/--/g, '')          // SQL comment (두 개의 하이픈)
    .replace(/[<>]/g, '')        // XSS prevention
    .slice(0, 100);              // Limit length to prevent abuse
};

/**
 * Helper to sanitize and validate pagination params
 */
export const getPaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT;
  limit = Math.min(Math.max(limit, PAGINATION.MIN_LIMIT), PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// ===== Middleware =====

/**
 * Verify admin token and role
 */
export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, errors: ['인증이 필요합니다.'] });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, errors: ['유효하지 않은 토큰입니다.'] });
    }

    // Check if user has admin role via email whitelist or user metadata
    const userEmail = user.email?.toLowerCase();
    const isAdminByEmail = userEmail && ADMIN_EMAILS.includes(userEmail);
    const isAdminByRole = user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin';

    // SECURITY: Require at least one authentication method
    if (!isAdminByEmail && !isAdminByRole) {
      // Log failed admin access attempt for security monitoring
      console.warn(`[SECURITY] Admin access denied for user: ${userEmail || 'unknown'}`);
      return res.status(403).json({ success: false, errors: ['관리자 권한이 없습니다.'] });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, errors: ['인증에 실패했습니다.'] });
  }
};