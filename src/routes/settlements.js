import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// POST /api/settlements - Create new settlement request
router.post('/', async (req, res, next) => {
  try {
    const {
      name, rentalDate, bankName, accountHolder, accountNumber,
      rating, goodPoints, improvements,
      mediaFiles, instagramConsent, instagramRequest
    } = req.body;

    // Validation
    const errors = [];
    if (!name?.trim()) errors.push('성함을 입력해주세요.');
    if (!rentalDate) errors.push('대관날짜를 선택해주세요.');
    if (!bankName?.trim()) errors.push('은행명을 입력해주세요.');
    if (!accountHolder?.trim()) errors.push('예금주명을 입력해주세요.');
    if (!accountNumber?.trim()) errors.push('계좌번호를 입력해주세요.');
    if (!rating || rating < 1 || rating > 5) errors.push('만족도를 선택해주세요.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const insertData = {
      name: name.trim(),
      rental_date: rentalDate,
      bank_name: bankName.trim(),
      account_holder: accountHolder.trim(),
      account_number: accountNumber.trim(),
      rating,
      good_points: goodPoints?.trim() || null,
      improvements: improvements?.trim() || null,
      media_urls: [], // Media files will be handled separately via storage
      instagram_consent: instagramConsent || false,
      instagram_request: instagramRequest?.trim() || null,
    };

    const { data, error } = await supabase
      .from('settlements')
      .insert(insertData)
      .select('id, submitted_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: '정산 요청이 완료되었습니다.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
