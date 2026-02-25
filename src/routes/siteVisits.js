import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// POST /api/site-visits - Create new site visit request
router.post('/', async (req, res, next) => {
  try {
    const {
      name, organization, phone, rentalDate, startTime, endTime,
      purposes, purposeDetail, hasRental
    } = req.body;

    // Validation
    const errors = [];
    if (!name?.trim()) errors.push('성함을 입력해주세요.');
    if (!phone) errors.push('연락처를 입력해주세요.');
    if (!rentalDate) errors.push('대관 희망 날짜를 선택해주세요.');
    if (!startTime || !endTime) errors.push('대관 희망 시간을 선택해주세요.');
    if (!purposes || purposes.length === 0) errors.push('사용목적을 선택해주세요.');
    if (!purposeDetail?.trim()) errors.push('사용설명을 입력해주세요.');
    if (!hasRental) errors.push('대관 유무를 선택해주세요.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const insertData = {
      name: name.trim(),
      organization: organization?.trim() || null,
      phone: phone.replace(/[-\s]/g, ''),
      rental_date: rentalDate,
      start_time: startTime,
      end_time: endTime,
      purposes: purposes || [],
      purpose_detail: purposeDetail?.trim() || null,
      has_rental: hasRental,
    };

    const { data, error } = await supabase
      .from('site_visits')
      .insert(insertData)
      .select('id, submitted_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: '답사 예약이 완료되었습니다.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
