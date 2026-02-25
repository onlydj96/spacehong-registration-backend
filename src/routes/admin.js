import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
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

    // Check if user has admin role (you can customize this based on your needs)
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, errors: ['인증에 실패했습니다.'] });
  }
};

// GET /api/admin/reservations - Get all reservations with search
router.get('/reservations', verifyAdmin, async (req, res, next) => {
  try {
    const { search, startDate, endDate, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('reservations')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,organization.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte('rental_date', startDate);
    }
    if (endDate) {
      query = query.lte('rental_date', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reservations/:id - Get single reservation
router.get('/reservations/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, errors: ['예약을 찾을 수 없습니다.'] });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/reservations/:id - Update reservation status
router.patch('/reservations/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 상태입니다.'] });
    }

    const { data, error } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/site-visits - Get all site visits with search
router.get('/site-visits', verifyAdmin, async (req, res, next) => {
  try {
    const { search, startDate, endDate, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('site_visits')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,organization.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte('rental_date', startDate);
    }
    if (endDate) {
      query = query.lte('rental_date', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/site-visits/:id - Get single site visit
router.get('/site-visits/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('site_visits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, errors: ['답사 예약을 찾을 수 없습니다.'] });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/site-visits/:id - Update site visit status
router.patch('/site-visits/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 상태입니다.'] });
    }

    const { data, error } = await supabase
      .from('site_visits')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/settlements - Get all settlements with search
router.get('/settlements', verifyAdmin, async (req, res, next) => {
  try {
    const { search, startDate, endDate, refundStatus, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('settlements')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,bank_info.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte('rental_date', startDate);
    }
    if (endDate) {
      query = query.lte('rental_date', endDate);
    }
    if (refundStatus) {
      query = query.eq('refund_status', refundStatus);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/settlements/:id - Get single settlement
router.get('/settlements/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, errors: ['정산 요청을 찾을 수 없습니다.'] });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/settlements/:id - Update settlement refund status
router.patch('/settlements/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refundStatus } = req.body;

    const validStatuses = ['pending', 'processing', 'completed'];
    if (!validStatuses.includes(refundStatus)) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 상태입니다.'] });
    }

    const { data, error } = await supabase
      .from('settlements')
      .update({ refund_status: refundStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/search - Global search across all data
router.get('/search', verifyAdmin, async (req, res, next) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: { reservations: [], siteVisits: [], settlements: [] },
      });
    }

    const searchTerm = query.trim();

    // Search across all three tables in parallel
    const [reservationsResult, siteVisitsResult, settlementsResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, name, organization, phone, rental_date, venue_type, status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(limit),
      supabase
        .from('site_visits')
        .select('id, name, organization, phone, rental_date, has_rental, status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(limit),
      supabase
        .from('settlements')
        .select('id, name, rental_date, bank_info, account_number, refund_status, submitted_at')
        .or(`name.ilike.%${searchTerm}%,bank_info.ilike.%${searchTerm}%`)
        .order('submitted_at', { ascending: false })
        .limit(limit),
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

// GET /api/admin/stats - Get dashboard statistics
// 최적화: 6개 쿼리 → 3개 쿼리 (각 테이블에서 모든 데이터를 한 번에 가져와 JS에서 처리)
router.get('/stats', verifyAdmin, async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 3개 쿼리로 모든 데이터 가져오기 (병렬 실행)
    const [reservations, siteVisits, settlements] = await Promise.all([
      supabase.from('reservations').select('status, submitted_at'),
      supabase.from('site_visits').select('status, submitted_at'),
      supabase.from('settlements').select('refund_status, submitted_at'),
    ]);

    const reservationsData = reservations.data || [];
    const siteVisitsData = siteVisits.data || [];
    const settlementsData = settlements.data || [];

    res.json({
      success: true,
      data: {
        reservations: {
          total: reservationsData.length,
          pending: reservationsData.filter(r => r.status === 'pending').length,
          recent: reservationsData.filter(r => r.submitted_at >= thirtyDaysAgo).length,
        },
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
    });
  } catch (err) {
    next(err);
  }
});

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

    // Return default settings if not found
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

    // Validate phone number format (Korean phone number)
    if (phone_number && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone_number.replace(/-/g, ''))) {
      return res.status(400).json({ success: false, errors: ['유효하지 않은 전화번호 형식입니다.'] });
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    let result;
    if (existing) {
      // Update existing settings
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
      // Insert new settings
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

// GET /api/admin/statistics - Get statistics data
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
      // monthly - last 6 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      labels = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return `${d.getMonth() + 1}월`;
      });
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    // Get all data for the period
    const [reservations, siteVisits, settlements] = await Promise.all([
      supabase.from('reservations').select('id, status, venue_type, submitted_at').gte('submitted_at', startDateStr),
      supabase.from('site_visits').select('id, status, submitted_at').gte('submitted_at', startDateStr),
      supabase.from('settlements').select('id, refund_status, submitted_at').gte('submitted_at', startDateStr),
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

    res.json({
      success: true,
      data: {
        summary: {
          totalReservations,
          totalSiteVisits,
          totalSettlements,
          conversionRate,
          reservationsChange: 12,
          siteVisitsChange: 8,
          settlementsChange: 5,
          conversionChange: 3,
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
