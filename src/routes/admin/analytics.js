/**
 * Admin Analytics Router
 * GET /api/admin/analytics - 페이지 방문 통계 조회
 *
 * 집계 계산은 모두 PostgreSQL 함수에서 처리합니다.
 * SQL 함수 정의: supabase/analytics_functions.sql
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
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

// 날짜 컴포넌트(년/월/일)를 KST 자정 UTC로 변환
function kstMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS);
}

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

    const paramYear = parseInt(req.query.year) || now.getFullYear();
    const paramMonth = parseInt(req.query.month) || (now.getMonth() + 1); // 1-12
    const paramWeekStart = req.query.weekStart; // YYYY-MM-DD

    // 캐시 키
    let dateKey;
    if (period === 'weekly') dateKey = paramWeekStart || 'current';
    else if (period === 'monthly') dateKey = `${paramYear}-${String(paramMonth).padStart(2, '0')}`;
    else dateKey = `${paramYear}`;
    const cacheKey = `${CACHE_KEYS.ANALYTICS}:${period}:${dateKey}`;

    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // 날짜 범위 계산 (반개구간 [start, end) 사용)
    let startDate, endDateExclusive, labels, prevStartDate, prevEndDateExclusive;

    if (period === 'weekly') {
      const weekBase = paramWeekStart
        ? new Date(paramWeekStart + 'T00:00:00')
        : getMondayOfWeek(now);
      // weekBase의 날짜 컴포넌트를 KST 자정 UTC로 변환
      startDate = kstMidnight(weekBase.getFullYear(), weekBase.getMonth(), weekBase.getDate());
      endDateExclusive = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      labels = Array.from({ length: 7 }, (_, i) => {
        // KST 날짜 기준으로 레이블 생성
        const kstDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000 + KST_OFFSET_MS);
        return `${DAY_LABELS[kstDate.getUTCDay()]} ${kstDate.getUTCMonth() + 1}/${kstDate.getUTCDate()}`;
      });

      prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEndDateExclusive = new Date(startDate);

    } else if (period === 'monthly') {
      const targetMonth = paramMonth - 1; // 0-indexed
      const daysInMonth = new Date(paramYear, targetMonth + 1, 0).getDate();
      startDate = kstMidnight(paramYear, targetMonth, 1);
      endDateExclusive = kstMidnight(paramYear, targetMonth + 1, 1);

      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}일`);

      prevStartDate = kstMidnight(paramYear, targetMonth - 1, 1);
      prevEndDateExclusive = kstMidnight(paramYear, targetMonth, 1);

    } else { // yearly
      startDate = kstMidnight(paramYear, 0, 1);
      endDateExclusive = kstMidnight(paramYear + 1, 0, 1);
      labels = MONTH_LABELS;

      prevStartDate = kstMidnight(paramYear - 1, 0, 1);
      prevEndDateExclusive = kstMidnight(paramYear, 0, 1);
    }

    const p_start = startDate.toISOString();
    const p_end = endDateExclusive.toISOString();
    const p_prev_start = prevStartDate.toISOString();
    const p_prev_end = prevEndDateExclusive.toISOString();

    // 4개 PostgreSQL 집계 함수 병렬 호출
    const [periodResult, pageDistResult, funnelResult, summaryResult] = await Promise.all([
      supabase.rpc('analytics_visits_by_period', { p_start, p_end, p_period: period }),
      supabase.rpc('analytics_page_distribution', { p_start, p_end }),
      supabase.rpc('analytics_rental_funnel', { p_start, p_end }),
      supabase.rpc('analytics_conversion_summary', { p_start, p_end, p_prev_start, p_prev_end }),
    ]);

    for (const { error } of [periodResult, pageDistResult, funnelResult, summaryResult]) {
      if (error) throw error;
    }

    const periodRows = periodResult.data ?? [];
    const pageDistRows = pageDistResult.data ?? [];
    const funnelRows = funnelResult.data ?? [];
    const summaryRow = summaryResult.data?.[0] ?? {};

    // visitsByPeriod: DB에 없는 bucket(방문 0)은 0으로 채움
    const periodMap = new Map(periodRows.map(r => [r.bucket_index, r]));
    const visitsByPeriod = labels.map((label, i) => {
      const row = periodMap.get(i);
      return {
        label,
        visitors: Number(row?.visitors ?? 0),
        pageViews: Number(row?.page_views ?? 0),
      };
    });

    // pageDistribution: DB에서 이미 count DESC 정렬됨
    const pageDistribution = pageDistRows.map(r => ({
      pagePath: r.page_path,
      pageName: r.page_name,
      count: Number(r.count),
    }));

    // rentalFunnel: DB에 없는 step(방문 0)은 0으로 채움
    const funnelMap = new Map(funnelRows.map(r => [r.step, r]));
    const rentalFunnel = Array.from({ length: 7 }, (_, step) => ({
      step,
      stepName: RENTAL_STEP_NAMES[step],
      sessions: Number(funnelMap.get(step)?.sessions ?? 0),
    }));

    const conversionSummary = {
      totalVisitors: Number(summaryRow.total_visitors ?? 0),
      totalPageViews: Number(summaryRow.total_page_views ?? 0),
      pagesPerVisit: Number(summaryRow.pages_per_visit ?? 0),
      bounceRate: Number(summaryRow.bounce_rate ?? 0),
      previousPeriodVisitors: Number(summaryRow.previous_period_visitors ?? 0),
      rentalStarters: Number(summaryRow.rental_starters ?? 0),
      rentalCompleters: Number(summaryRow.rental_completers ?? 0),
      completionRate: Number(summaryRow.completion_rate ?? 0),
      overallConversionRate: Number(summaryRow.overall_conversion_rate ?? 0),
    };

    const response = {
      success: true,
      data: {
        visitsByPeriod,
        pageDistribution,
        rentalFunnel,
        conversionSummary,
        meta: {
          period,
          dateKey,
          startDate: startDate.toISOString(),
          endDate: endDateExclusive.toISOString(),
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
