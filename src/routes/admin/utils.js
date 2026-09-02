/**
 * Admin Route Utilities
 * 공통 상수, 유틸리티 함수, 미들웨어
 */
import { supabase } from '../../services/supabase.js';
import { logger } from '../../middleware/logger.js';

// ===== Constants =====

export const CACHE_TTL = {
  STATS: 300,       // 5분 (기존 60초 → 반복 조회 시 DB 재조회 방지)
  STATISTICS: 300,  // 5분 (유지)
  LIST: 120,        // 2분 (기존 30초 → 프론트엔드 캐시와 일치)
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
  logger.warn('[SECURITY WARNING] ADMIN_EMAILS 환경변수가 설정되지 않았습니다. Admin 접근은 user metadata role로만 허용됩니다. 추가 보안을 위해 ADMIN_EMAILS를 설정하세요.');
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
 * 토큰 → 유저 정보 단기 캐시 (30초)
 * 동일 토큰의 연속 요청마다 Supabase 네트워크 호출을 줄이기 위함
 * TTL이 짧으므로 로그아웃 후 최대 30초 내 만료됨
 */
const TOKEN_CACHE_TTL_MS = 30 * 1000;
const tokenCache = new Map(); // Map<token, { user, expiresAt }>

function getTokenCache(token) {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenCache.delete(token);
    return null;
  }
  return entry.user;
}

function setTokenCache(token, user) {
  // 만료 항목 먼저 정리
  if (tokenCache.size >= 500) {
    const now = Date.now();
    for (const [k, v] of tokenCache.entries()) {
      if (now > v.expiresAt) tokenCache.delete(k);
    }
    // 만료 항목 정리 후에도 500개를 초과하면 가장 오래된 항목 제거 (하드 제한)
    if (tokenCache.size >= 500) {
      const oldestKey = tokenCache.keys().next().value;
      tokenCache.delete(oldestKey);
    }
  }
  tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

/**
 * Verify admin token and role
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate :id param as UUID
 */
export const validateId = (req, res, next) => {
  if (!UUID_REGEX.test(req.params.id)) {
    return res.status(400).json({ success: false, errors: ['유효하지 않은 ID 형식입니다.'] });
  }
  next();
};

export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, errors: ['인증이 필요합니다.'] });
  }

  const token = authHeader.split(' ')[1];

  // 캐시에 유효한 유저 정보가 있으면 Supabase 네트워크 호출 생략
  const cachedUser = getTokenCache(token);
  if (cachedUser) {
    req.user = cachedUser;
    return next();
  }

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
      logger.warn({ email: userEmail || 'unknown' }, '[SECURITY] Admin access denied');
      return res.status(403).json({ success: false, errors: ['관리자 권한이 없습니다.'] });
    }

    setTokenCache(token, user);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, errors: ['인증에 실패했습니다.'] });
  }
};