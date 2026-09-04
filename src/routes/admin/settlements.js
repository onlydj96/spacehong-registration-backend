/**
 * Admin Settlements Router
 * 정산 관리 관련 라우트
 */
import { Router } from 'express';
import * as XLSX from 'xlsx';
import { supabase } from '../../services/supabase.js';
import { deleteCached, CACHE_KEYS } from '../../utils/cache.js';
import { verifyAdmin, getPaginationParams, sanitizeSearchTerm , validateId } from './utils.js';

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
        query = query.or(`name.ilike.%${sanitized}%,bank_name.ilike.%${sanitized}%`);
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

// GET /settlements/export - Export settlements reviews as Excel
router.get('/export', verifyAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('settlements')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (startDate) query = query.gte('rental_date', startDate);
    if (endDate) query = query.lte('rental_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    const REFUND_STATUS_MAP = { pending: '대기중', processing: '처리중', completed: '완료' };

    const rows = data.map((s) => ({
      '제출일시': s.submitted_at
        ? new Date(s.submitted_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '',
      '이름': s.name || '',
      '대여일': s.rental_date || '',
      '만족도(숫자)': s.rating ?? '',
      '좋았던 점': s.good_points || '',
      '개선사항': s.improvements || '',
      '인스타그램 동의': s.instagram_consent ? '동의' : '미동의',
      '인스타그램 요청': s.instagram_request || '',
      '은행명': s.bank_name || '',
      '예금주': s.account_holder || '',
      '계좌번호': s.account_number || '',
      '환급상태': REFUND_STATUS_MAP[s.refund_status] || s.refund_status || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // 컬럼 너비 자동 조정
    const colWidths = [
      { wch: 22 }, // 제출일시
      { wch: 10 }, // 이름
      { wch: 12 }, // 대여일
      { wch: 12 }, // 만족도
      { wch: 40 }, // 좋았던 점
      { wch: 40 }, // 개선사항
      { wch: 16 }, // 인스타그램 동의
      { wch: 30 }, // 인스타그램 요청
      { wch: 12 }, // 은행명
      { wch: 10 }, // 예금주
      { wch: 20 }, // 계좌번호
      { wch: 10 }, // 환급상태
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '정산 리뷰');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `정산리뷰_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /settlements/:id - Get single settlement
router.get('/:id', verifyAdmin, validateId, async (req, res, next) => {
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

    // 미확인 상태일 경우 viewed_at 업데이트 (확인 처리)
    if (!data.viewed_at) {
      await supabase
        .from('settlements')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', id);

      // 통계 캐시 무효화
      deleteCached(CACHE_KEYS.STATISTICS);
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /settlements/:id - Update settlement refund status
router.patch('/:id', verifyAdmin, validateId, async (req, res, next) => {
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