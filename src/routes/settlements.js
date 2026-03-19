import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { VALIDATION_PATTERNS } from '../utils/helpers.js';

const router = Router();

// Input validation constants
const VALIDATION = {
  NAME_MAX_LENGTH: 50,
  BANK_NAME_MAX_LENGTH: 30,
  ACCOUNT_HOLDER_MAX_LENGTH: 30,
  ACCOUNT_NUMBER_MIN_LENGTH: 10,
  ACCOUNT_NUMBER_MAX_LENGTH: 20,
  FEEDBACK_MAX_LENGTH: 2000,
  INSTAGRAM_REQUEST_MAX_LENGTH: 500,
  DATE_REGEX: VALIDATION_PATTERNS.DATE,
  ACCOUNT_NUMBER_REGEX: /^\d{10,20}$/, // Korean bank account: 10-20 digits
  VALID_BANKS: [
    '국민은행', 'KB국민은행', '신한은행', '우리은행', '하나은행', 'KEB하나은행',
    '농협은행', 'NH농협은행', '기업은행', 'IBK기업은행', 'SC제일은행',
    '카카오뱅크', '케이뱅크', '토스뱅크', '새마을금고', '신협', '우체국',
    '수협은행', '부산은행', '경남은행', '대구은행', '광주은행', '전북은행', '제주은행',
  ],
};

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

    // Name validation
    if (!name?.trim()) {
      errors.push('성함을 입력해주세요.');
    } else if (name.trim().length > VALIDATION.NAME_MAX_LENGTH) {
      errors.push(`성함은 ${VALIDATION.NAME_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

    // Date validation
    if (!rentalDate) {
      errors.push('대관날짜를 선택해주세요.');
    } else if (!VALIDATION.DATE_REGEX.test(rentalDate)) {
      errors.push('올바른 날짜 형식이 아닙니다.');
    }

    // Bank name validation
    if (!bankName?.trim()) {
      errors.push('은행명을 입력해주세요.');
    } else if (bankName.trim().length > VALIDATION.BANK_NAME_MAX_LENGTH) {
      errors.push(`은행명은 ${VALIDATION.BANK_NAME_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

    // Account holder validation
    if (!accountHolder?.trim()) {
      errors.push('예금주명을 입력해주세요.');
    } else if (accountHolder.trim().length > VALIDATION.ACCOUNT_HOLDER_MAX_LENGTH) {
      errors.push(`예금주명은 ${VALIDATION.ACCOUNT_HOLDER_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

    // Account number validation (digits only, proper length)
    if (!accountNumber?.trim()) {
      errors.push('계좌번호를 입력해주세요.');
    } else {
      const accountDigits = accountNumber.replace(/[-\s]/g, '');
      if (!VALIDATION.ACCOUNT_NUMBER_REGEX.test(accountDigits)) {
        errors.push('계좌번호는 10-20자리 숫자로 입력해주세요.');
      }
    }

    // Rating validation
    const ratingNum = parseInt(rating, 10);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      errors.push('만족도를 선택해주세요. (1-5)');
    }

    // Feedback length validation (optional fields)
    if (goodPoints && goodPoints.trim().length > VALIDATION.FEEDBACK_MAX_LENGTH) {
      errors.push(`좋았던 점은 ${VALIDATION.FEEDBACK_MAX_LENGTH}자 이내로 입력해주세요.`);
    }
    if (improvements && improvements.trim().length > VALIDATION.FEEDBACK_MAX_LENGTH) {
      errors.push(`개선사항은 ${VALIDATION.FEEDBACK_MAX_LENGTH}자 이내로 입력해주세요.`);
    }
    if (instagramRequest && instagramRequest.trim().length > VALIDATION.INSTAGRAM_REQUEST_MAX_LENGTH) {
      errors.push(`인스타그램 요청사항은 ${VALIDATION.INSTAGRAM_REQUEST_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

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
