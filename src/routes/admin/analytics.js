/**
 * Admin Analytics Router
 * GET /api/admin/analytics - 페이지 방문 통계 조회
 */
import { Router } from 'express';
import { supabase } from '../../services/supabase.js';
import { getCached, setCached, CACHE_KEYS } from '../../utils/cache.js';
import { verifyAdmin, CACHE_TTL } from './utils.js';

const router = Router();

const RENTAL_STEP_NAMES = {
  0: '공간선택',
  1: '기본정보',
  2: '약관동의',
  3: '옵션선택',
  4: 'FAQ',
  5: '최종확인',
  6: '제출완료',
};

const VALID_PERIODS = new Set(['weekly', 'monthly', 'yearly']);

// GET /api/admin/analytics?period=weekly|monthly|yearly
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const period = VALID_PERIODS.has(req.query.period) ? req.query.period : 'monthly';

    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${period}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const now = new Date();

    // 기간별 날짜 범위 및 레이블 계산 (기존 statistics 엔드포인트와 동일 패턴)
    let startDate, labels;
    if (period === 'weekly') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      labels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    } else {
      // monthly: 최근 6개월
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      labels = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return `${d.getMonth() + 1}월`;
      });
    }

    const startDateStr = startDate.toISOString();

    // page_views 테이블에서 기간 내 전체 데이터 조회
    const { data: rawViews, error } = await supabase
      .from('page_views')
      .select('session_id, page_path, page_name, step, created_at')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const views = rawViews || [];

    // 1. visitsByPeriod: 기간별 방문자(unique session) 수 및 페이지뷰 수
    const visitsByPeriod = labels.map((label, index) => {
      let periodViews;
      if (period === 'weekly') {
        const dayStart = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d >= dayStart && d < dayEnd;
        });
      } else if (period === 'yearly') {
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d.getMonth() === index;
        });
      } else {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
        });
      }
      const uniqueVisitors = new Set(periodViews.map(v => v.session_id)).size;
      return {
        label,
        visitors: uniqueVisitors,
        pageViews: periodViews.length,
      };
    });

    // 2. pageDistribution: 페이지별 방문 건수 집계
    const pathCounts = {};
    const pathNames = {};
    for (const v of views) {
      // /rental은 step별로 기록되므로 step=0 진입만 집계 (중복 제거)
      if (v.page_path === '/rental' && v.step !== 0) continue;
      pathCounts[v.page_path] = (pathCounts[v.page_path] || 0) + 1;
      if (!pathNames[v.page_path]) pathNames[v.page_path] = v.page_name;
    }
    const pageDistribution = Object.entries(pathCounts)
      .map(([pagePath, count]) => ({
        pagePath,
        pageName: pathNames[pagePath] || pagePath,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // 3. rentalFunnel: 대관 폼 단계별 도달 세션 수
    const rentalViews = views.filter(v => v.page_path === '/rental' && v.step !== null);
    const rentalFunnel = Array.from({ length: 7 }, (_, step) => {
      const stepSessions = new Set(
        rentalViews.filter(v => v.step === step).map(v => v.session_id)
      );
      return {
        step,
        stepName: RENTAL_STEP_NAMES[step],
        sessions: stepSessions.size,
      };
    });

    // 4. conversionSummary: 전환율 요약
    const totalVisitors = new Set(views.map(v => v.session_id)).size;
    const totalPageViews = views.length;
    const rentalStep0Sessions = new Set(
      rentalViews.filter(v => v.step === 0).map(v => v.session_id)
    ).size;
    const rentalStep6Sessions = new Set(
      rentalViews.filter(v => v.step === 6).map(v => v.session_id)
    ).size;

    const completionRate = rentalStep0Sessions > 0
      ? Math.round((rentalStep6Sessions / rentalStep0Sessions) * 1000) / 10
      : 0;
    const overallConversionRate = totalVisitors > 0
      ? Math.round((rentalStep6Sessions / totalVisitors) * 1000) / 10
      : 0;

    const response = {
      success: true,
      data: {
        visitsByPeriod,
        pageDistribution,
        rentalFunnel,
        conversionSummary: {
          totalVisitors,
          totalPageViews,
          rentalStarters: rentalStep0Sessions,
          rentalCompleters: rentalStep6Sessions,
          completionRate,
          overallConversionRate,
        },
      },
    };

    setCached(cacheKey, response, CACHE_TTL.STATISTICS);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
