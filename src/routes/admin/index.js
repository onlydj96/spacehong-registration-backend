/**
 * Admin Router - 관리자 API 라우터 통합
 *
 * 구조:
 * - /reservations - 예약 관리
 * - /site-visits - 답사 관리
 * - /settlements - 정산 관리
 * - /stats - 대시보드 통계
 * - /search - 전역 검색
 * - /schedule - 일정 관리
 * - /statistics - 상세 통계
 * - /settings - 설정 관리
 */
import { Router } from 'express';
import { supabase } from '../../services/supabase.js';
import { getCached, setCached, deleteCached, CACHE_KEYS } from '../../utils/cache.js';
import { verifyAdmin, getPaginationParams, sanitizeSearchTerm, CACHE_TTL } from './utils.js';

// Import sub-routers
import reservationsRouter from './reservations.js';
import siteVisitsRouter from './siteVisits.js';
import settlementsRouter from './settlements.js';

const router = Router();

// Mount sub-routers
router.use('/reservations', reservationsRouter);
router.use('/site-visits', siteVisitsRouter);
router.use('/settlements', settlementsRouter);

// ===== Search =====

// GET /api/admin/search - Global search across all data
router.get('/search', verifyAdmin, async (req, res, next) => {
  try {
    const { query } = req.query;
    const searchLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: { reservations: [], siteVisits: [], settlements: [] },
      });
    }

    const searchTerm = sanitizeSearchTerm(query);

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({
        success: true,
        data: { reservations: [], siteVisits: [], settlements: [] },
      });
    }

    const [reservationsResult, siteVisitsResult, settlementsResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, name, organization, phone, rental_date, venue_type, status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(searchLimit),
      supabase
        .from('site_visits')
        .select('id, name, organization, phone, rental_date, has_rental, status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(searchLimit),
      supabase
        .from('settlements')
        .select('id, name, rental_date, bank_info, account_number, refund_status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,bank_info.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(searchLimit),
    ]);

    res.json({
      success: true,
      data: {
        reservations: reservationsResult.data || [],
        siteVisits: siteVisitsResult.data || [],
        settlements: settlementsResult.data || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== Dashboard Stats =====

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', verifyAdmin, async (req, res, next) => {
  try {
    const cached = getCached(CACHE_KEYS.STATISTICS);
    if (cached) {
      return res.json(cached);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [reservations, siteVisits, settlements] = await Promise.all([
      supabase.from('reservations').select('status, submitted_at, venue_type'),
      supabase.from('site_visits').select('status, submitted_at'),
      supabase.from('settlements').select('refund_status, submitted_at'),
    ]);

    const reservationsData = reservations.data || [];
    const siteVisitsData = siteVisits.data || [];
    const settlementsData = settlements.data || [];

    const getVenueStats = (data, venueType) => {
      const filtered = data.filter(r => r.venue_type === venueType);
      return {
        total: filtered.length,
        pending: filtered.filter(r => r.status === 'pending').length,
        recent: filtered.filter(r => r.submitted_at >= thirtyDaysAgo).length,
      };
    };

    const response = {
      success: true,
      data: {
        performance: getVenueStats(reservationsData, 'performance'),
        studio: getVenueStats(reservationsData, 'studio'),
        event: getVenueStats(reservationsData, 'event'),
        siteVisits: {
          total: siteVisitsData.length,
          pending: siteVisitsData.filter(s => s.status === 'pending').length,
          recent: siteVisitsData.filter(s => s.submitted_at >= thirtyDaysAgo).length,
        },
        settlements: {
          total: settlementsData.length,
          pending: settlementsData.filter(s => s.refund_status === 'pending').length,
          recent: settlementsData.filter(s => s.submitted_at >= thirtyDaysAgo).length,
        },
      },
    };

    setCached(CACHE_KEYS.STATISTICS, response, CACHE_TTL.STATS);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ===== Schedule =====

// GET /api/admin/schedule/monthly - Get monthly confirmed reservations
router.get('/schedule/monthly', verifyAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('reservations')
      .select('id, name, organization, rental_date, venue_type, start_time, end_time, status')
      .eq('status', 'confirmed')
      .gte('rental_date', firstDay)
      .lte('rental_date', lastDay)
      .order('rental_date', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
});

// ===== Settings =====

// GET /api/admin/settings - Get admin settings
router.get('/settings', verifyAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const settings = data || {
      phone_number: '',
      notification_reservation: true,
      notification_site_visit: true,
      notification_settlement: true,
    };

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings - Update admin settings
router.put('/settings', verifyAdmin, async (req, res, next) => {
  try {
    const { phone_number, notification_reservation, notification_site_visit, notification_settlement } = req.body;

    if (phone_number && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone_number.replace(/-/g, ''))) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 전화번호 형식입니다.'] });
    }

    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('admin_settings')
        .update({
          phone_number: phone_number || '',
          notification_reservation: notification_reservation ?? true,
          notification_site_visit: notification_site_visit ?? true,
          notification_settlement: notification_settlement ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', req.user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('admin_settings')
        .insert({
          user_id: req.user.id,
          phone_number: phone_number || '',
          notification_reservation: notification_reservation ?? true,
          notification_site_visit: notification_site_visit ?? true,
          notification_settlement: notification_settlement ?? true,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

// ===== Statistics =====

// GET /api/admin/statistics - Get detailed statistics data
router.get('/statistics', verifyAdmin, async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    const now = new Date();

    // Calculate date ranges based on period
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
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      labels = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return `${d.getMonth() + 1}월`;
      });
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    // 전월 대비 변화율 계산을 위한 날짜 범위
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const previousMonthStartStr = previousMonthStart.toISOString().split('T')[0];
    const previousMonthEndStr = previousMonthEnd.toISOString();

    const [reservations, siteVisits, settlements, prevReservations, prevSiteVisits, prevSettlements] = await Promise.all([
      supabase.from('reservations').select('id, status, venue_type, submitted_at').gte('submitted_at', startDateStr),
      supabase.from('site_visits').select('id, status, submitted_at').gte('submitted_at', startDateStr),
      supabase.from('settlements').select('id, refund_status, submitted_at').gte('submitted_at', startDateStr),
      supabase.from('reservations').select('id, status').gte('submitted_at', previousMonthStartStr).lte('submitted_at', previousMonthEndStr),
      supabase.from('site_visits').select('id, status').gte('submitted_at', previousMonthStartStr).lte('submitted_at', previousMonthEndStr),
      supabase.from('settlements').select('id, refund_status').gte('submitted_at', previousMonthStartStr).lte('submitted_at', previousMonthEndStr),
    ]);

    // Calculate reservations by period
    const reservationsByPeriod = labels.map((label, index) => {
      let count = 0;
      if (period === 'weekly') {
        const dayStart = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        count = (reservations.data || []).filter(r => {
          const d = new Date(r.submitted_at);
          return d >= dayStart && d < dayEnd;
        }).length;
      } else if (period === 'yearly') {
        count = (reservations.data || []).filter(r => {
          const d = new Date(r.submitted_at);
          return d.getMonth() === index;
        }).length;
      } else {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        count = (reservations.data || []).filter(r => {
          const d = new Date(r.submitted_at);
          return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
        }).length;
      }
      return { label, count };
    });

    // Calculate venue type distribution
    const venueTypeDistribution = [
      { type: 'performance', count: (reservations.data || []).filter(r => r.venue_type === 'performance').length },
      { type: 'event', count: (reservations.data || []).filter(r => r.venue_type === 'event').length },
      { type: 'studio', count: (reservations.data || []).filter(r => r.venue_type === 'studio').length },
    ];

    // Calculate status distribution
    const statusDistribution = {
      reservations: [
        { status: 'pending', statusLabel: '대기', count: (reservations.data || []).filter(r => r.status === 'pending').length },
        { status: 'confirmed', statusLabel: '확정', count: (reservations.data || []).filter(r => r.status === 'confirmed').length },
        { status: 'cancelled', statusLabel: '취소', count: (reservations.data || []).filter(r => r.status === 'cancelled').length },
        { status: 'completed', statusLabel: '완료', count: (reservations.data || []).filter(r => r.status === 'completed').length },
      ],
      siteVisits: [
        { status: 'pending', statusLabel: '대기', count: (siteVisits.data || []).filter(s => s.status === 'pending').length },
        { status: 'confirmed', statusLabel: '확정', count: (siteVisits.data || []).filter(s => s.status === 'confirmed').length },
        { status: 'cancelled', statusLabel: '취소', count: (siteVisits.data || []).filter(s => s.status === 'cancelled').length },
        { status: 'completed', statusLabel: '완료', count: (siteVisits.data || []).filter(s => s.status === 'completed').length },
      ],
      settlements: [
        { status: 'pending', statusLabel: '대기', count: (settlements.data || []).filter(s => s.refund_status === 'pending').length },
        { status: 'processing', statusLabel: '처리중', count: (settlements.data || []).filter(s => s.refund_status === 'processing').length },
        { status: 'completed', statusLabel: '완료', count: (settlements.data || []).filter(s => s.refund_status === 'completed').length },
      ],
    };

    // Calculate summary
    const totalReservations = reservations.data?.length || 0;
    const totalSiteVisits = siteVisits.data?.length || 0;
    const totalSettlements = settlements.data?.length || 0;
    const confirmedFromVisits = (siteVisits.data || []).filter(s => s.status === 'confirmed').length;
    const conversionRate = totalSiteVisits > 0 ? Math.round((confirmedFromVisits / totalSiteVisits) * 100) : 0;

    // 전월 데이터로 변화율 계산
    const prevReservationsCount = prevReservations.data?.length || 0;
    const prevSiteVisitsCount = prevSiteVisits.data?.length || 0;
    const prevSettlementsCount = prevSettlements.data?.length || 0;
    const prevConfirmedFromVisits = (prevSiteVisits.data || []).filter(s => s.status === 'confirmed').length;
    const prevConversionRate = prevSiteVisitsCount > 0 ? Math.round((prevConfirmedFromVisits / prevSiteVisitsCount) * 100) : 0;

    // 이번 달 데이터 필터링
    const currentMonthReservations = (reservations.data || []).filter(r => {
      const d = new Date(r.submitted_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const currentMonthSiteVisits = (siteVisits.data || []).filter(s => {
      const d = new Date(s.submitted_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const currentMonthSettlements = (settlements.data || []).filter(s => {
      const d = new Date(s.submitted_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    // 변화율 계산 함수
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const reservationsChange = calculateChange(currentMonthReservations, prevReservationsCount);
    const siteVisitsChange = calculateChange(currentMonthSiteVisits, prevSiteVisitsCount);
    const settlementsChange = calculateChange(currentMonthSettlements, prevSettlementsCount);
    const conversionChange = conversionRate - prevConversionRate;

    res.json({
      success: true,
      data: {
        summary: {
          totalReservations,
          totalSiteVisits,
          totalSettlements,
          conversionRate,
          reservationsChange,
          siteVisitsChange,
          settlementsChange,
          conversionChange,
        },
        reservationsByPeriod,
        venueTypeDistribution,
        statusDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;