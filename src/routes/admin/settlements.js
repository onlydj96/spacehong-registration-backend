/**
 * Admin Settlements Router
 * 정산 관리 관련 라우트
 */
import { Router } from 'express';
import { supabase } from '../../services/supabase.js';
import { deleteCached, CACHE_KEYS } from '../../utils/cache.js';
import { verifyAdmin, getPaginationParams, sanitizeSearchTerm } from './utils.js';

const router = Router();

// GET /settlements - Get all settlements with search
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const { search, startDate, endDate, refundStatus } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    let query = supabase
      .from('settlements')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    if (search) {
      const sanitized = sanitizeSearchTerm(search);
      if (sanitized) {
        query = query.or(`name.ilike.%${sanitized}%,bank_info.ilike.%${sanitized}%`);
      }
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

// GET /settlements/:id - Get single settlement
router.get('/:id', verifyAdmin, async (req, res, next) => {
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

// PATCH /settlements/:id - Update settlement refund status
router.patch('/:id', verifyAdmin, async (req, res, next) => {
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

    deleteCached(CACHE_KEYS.STATISTICS);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;