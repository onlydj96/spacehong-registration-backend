import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

/**
 * GET /api/testimonials
 * 공개 이용후기 조회 - 좋았던 점 + 별점만 반환 (개인정보 제외)
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('settlements')
      .select('id, good_points, rating')
      .not('good_points', 'is', null)
      .neq('good_points', '')
      .gte('rating', 4)
      .order('submitted_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const testimonials = (data || []).filter(
      (t) => t.good_points && t.good_points.trim().length >= 10
    );

    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
});

export default router;
