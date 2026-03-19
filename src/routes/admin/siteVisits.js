/**
 * Admin Site Visits Router
 * 답사 예약 관리 관련 라우트
 */
import { Router } from 'express';
import { supabase } from '../../services/supabase.js';
import { deleteCached, CACHE_KEYS } from '../../utils/cache.js';
import { verifyAdmin, getPaginationParams, sanitizeSearchTerm } from './utils.js';

const router = Router();

// GET /site-visits - Get all site visits with search
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const { search, startDate, endDate, status } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    let query = supabase
      .from('site_visits')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (search) {
      const sanitized = sanitizeSearchTerm(search);
      if (sanitized) {
        query = query.or(`name.ilike.%${sanitized}%,organization.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
      }
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

// GET /site-visits/:id - Get single site visit
router.get('/:id', verifyAdmin, async (req, res, next) => {
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

// PATCH /site-visits/:id - Update site visit status
router.patch('/:id', verifyAdmin, async (req, res, next) => {
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

    deleteCached(CACHE_KEYS.STATISTICS);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;