import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { logger } from '../middleware/logger.js';

const router = Router();

// 추적 허용 경로 화이트리스트 — App.jsx 라우트와 동기화 유지
const ALLOWED_PATHS = new Set([
  '/', '/rental', '/site-visit', '/settlement',
  '/about', '/space', '/facility', '/quote', '/tour',
  '/faq', '/contact', '/info',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/analytics/pageview - 페이지 방문 기록
// 인증 불필요 — 공개 엔드포인트. UX에 영향을 주지 않도록 항상 success 반환.
router.post('/pageview', async (req, res) => {
  try {
    const { sessionId, pagePath, pageName, step } = req.body;

    // sessionId 검증 (UUID 형식)
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 세션 ID입니다.'] });
    }

    // pagePath 화이트리스트 검증
    if (!pagePath || !ALLOWED_PATHS.has(pagePath)) {
      return res.status(400).json({ success: false, errors: ['허용되지 않는 페이지 경로입니다.'] });
    }

    // pageName 길이 검증
    if (!pageName || typeof pageName !== 'string' || pageName.trim().length === 0 || pageName.length > 50) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 페이지 이름입니다.'] });
    }

    // step 검증: /rental 경로에서만 허용, 0–6 범위
    let validatedStep = null;
    if (step !== undefined && step !== null) {
      if (pagePath !== '/rental') {
        return res.status(400).json({ success: false, errors: ['step은 대관예약 페이지에서만 허용됩니다.'] });
      }
      const stepNum = parseInt(step, 10);
      if (isNaN(stepNum) || stepNum < 0 || stepNum > 6) {
        return res.status(400).json({ success: false, errors: ['step은 0–6 사이여야 합니다.'] });
      }
      validatedStep = stepNum;
    }

    const { error } = await supabase
      .from('page_views')
      .insert({
        session_id: sessionId,
        page_path: pagePath,
        page_name: pageName.trim(),
        step: validatedStep,
      });

    if (error) {
      // DB 오류는 로그만 남기고 클라이언트에 성공 반환 (fire-and-forget)
      logger.error({ err: error }, '[Analytics] 방문 기록 저장 실패');
    }

    res.json({ success: true });
  } catch (err) {
    // 예외 발생 시에도 클라이언트 UX에 영향 없도록 성공 반환
    logger.error({ err }, '[Analytics] 예외 발생');
    res.json({ success: true });
  }
});

export default router;
