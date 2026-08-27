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
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// 이번 주 월요일 계산
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/admin/analytics?period=weekly|monthly|yearly&year=2024&month=8&weekStart=YYYY-MM-DD
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const period = VALID_PERIODS.has(req.query.period) ? req.query.period : 'monthly';
    const now = new Date();

    // 날짜 파라미터 파싱
    const paramYear = parseInt(req.query.year) || now.getFullYear();
    const paramMonth = parseInt(req.query.month) || (now.getMonth() + 1); // 1-12
    const paramWeekStart = req.query.weekStart; // YYYY-MM-DD

    // 캐시 키: 기간 + 날짜 파라미터 포함
    let dateKey;
    if (period === 'weekly') dateKey = paramWeekStart || 'current';
    else if (period === 'monthly') dateKey = `${paramYear}-${String(paramMonth).padStart(2, '0')}`;
    else dateKey = `${paramYear}`;
    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${period}:${dateKey}`;

    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // 기간별 날짜 범위 및 레이블 계산
    let startDate, endDate, labels, prevStartDate, prevEndDate;

    if (period === 'weekly') {
      // 선택한 주의 월요일 기준 7일
      const weekBase = paramWeekStart
        ? new Date(paramWeekStart + 'T00:00:00')
        : getMondayOfWeek(now);
      startDate = new Date(weekBase);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        return `${DAY_LABELS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
      });

      prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEndDate = new Date(startDate);

    } else if (period === 'monthly') {
      // 선택한 달의 일별 분석
      const targetYear = paramYear;
      const targetMonth = paramMonth - 1; // 0-indexed
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0);
      endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}일`);

      // 이전 달
      prevStartDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);
      prevEndDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    } else {
      // yearly: 선택한 연도의 월별 분석
      startDate = new Date(paramYear, 0, 1, 0, 0, 0);
      endDate = new Date(paramYear, 11, 31, 23, 59, 59);
      labels = MONTH_LABELS;

      // 이전 연도
      prevStartDate = new Date(paramYear - 1, 0, 1, 0, 0, 0);
      prevEndDate = new Date(paramYear - 1, 11, 31, 23, 59, 59);
    }

    // 현재 기간 + 이전 기간 동시 조회
    const [{ data: rawViews, error }, { data: prevRawViews }] = await Promise.all([
      supabase
        .from('page_views')
        .select('session_id, page_path, page_name, step, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('page_views')
        .select('session_id')
        .gte('created_at', prevStartDate.toISOString())
        .lte('created_at', prevEndDate.toISOString()),
    ]);

    if (error) throw error;

    const views = rawViews || [];

    // 1. visitsByPeriod: 기간 단위별 방문자(unique session) 수 및 페이지뷰 수
    const visitsByPeriod = labels.map((label, index) => {
      let periodViews;

      if (period === 'weekly') {
        const dayStart = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d >= dayStart && d < dayEnd;
        });

      } else if (period === 'monthly') {
        const dayStart = new Date(paramYear, paramMonth - 1, index + 1, 0, 0, 0);
        const dayEnd = new Date(paramYear, paramMonth - 1, index + 2, 0, 0, 0);
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d >= dayStart && d < dayEnd;
        });

      } else {
        periodViews = views.filter(v => {
          const d = new Date(v.created_at);
          return d.getFullYear() === paramYear && d.getMonth() === index;
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

    // 4. conversionSummary: 전환율 + 추가 지표
    const totalVisitors = new Set(views.map(v => v.session_id)).size;
    const totalPageViews = views.length;

    // 세션별 페이지뷰 수 집계 (bounce rate 계산용)
    const sessionPageCounts = {};
    for (const v of views) {
      sessionPageCounts[v.session_id] = (sessionPageCounts[v.session_id] || 0) + 1;
    }
    const singlePageSessions = Object.values(sessionPageCounts).filter(c => c === 1).length;
    const bounceRate = totalVisitors > 0
      ? Math.round((singlePageSessions / totalVisitors) * 100)
      : 0;
    const pagesPerVisit = totalVisitors > 0
      ? Math.round((totalPageViews / totalVisitors) * 10) / 10
      : 0;

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

    // 이전 기간 방문자 수 (비교용)
    const previousPeriodVisitors = new Set((prevRawViews || []).map(v => v.session_id)).size;

    const response = {
      success: true,
      data: {
        visitsByPeriod,
        pageDistribution,
        rentalFunnel,
        conversionSummary: {
          totalVisitors,
          totalPageViews,
          pagesPerVisit,
          bounceRate,
          previousPeriodVisitors,
          rentalStarters: rentalStep0Sessions,
          rentalCompleters: rentalStep6Sessions,
          completionRate,
          overallConversionRate,
        },
        meta: {
          period,
          dateKey,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
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
