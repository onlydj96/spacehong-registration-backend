import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { VALIDATION_PATTERNS } from '../utils/helpers.js';

const router = Router();

// Input validation constants
const VALIDATION = {
  NAME_MAX_LENGTH: 50,
  ORGANIZATION_MAX_LENGTH: 100,
  PURPOSE_DETAIL_MAX_LENGTH: 1000,
  PHONE_REGEX: VALIDATION_PATTERNS.PHONE,
  TIME_REGEX: VALIDATION_PATTERNS.TIME,
  DATE_REGEX: VALIDATION_PATTERNS.DATE,
  VALID_HAS_RENTAL: ['yes', 'no', 'considering'],
};

// POST /api/site-visits - Create new site visit request
router.post('/', async (req, res, next) => {
  try {
    const {
      name, organization, phone, rentalDate, startTime, endTime,
      purposes, purposeDetail, hasRental
    } = req.body;

    // Validation
    const errors = [];

    // Required fields
    if (!name?.trim()) {
      errors.push('성함을 입력해주세요.');
    } else if (name.trim().length > VALIDATION.NAME_MAX_LENGTH) {
      errors.push(`성함은 ${VALIDATION.NAME_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

    // Phone validation with format check
    if (!phone) {
      errors.push('연락처를 입력해주세요.');
    } else {
      const phoneDigits = phone.replace(/[-\s]/g, '');
      if (!VALIDATION.PHONE_REGEX.test(phoneDigits)) {
        errors.push('올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)');
      }
    }

    // Date validation
    if (!rentalDate) {
      errors.push('대관 희망 날짜를 선택해주세요.');
    } else if (!VALIDATION.DATE_REGEX.test(rentalDate)) {
      errors.push('올바른 날짜 형식이 아닙니다.');
    }

    // Time validation
    if (!startTime || !endTime) {
      errors.push('대관 희망 시간을 선택해주세요.');
    } else if (!VALIDATION.TIME_REGEX.test(startTime) || !VALIDATION.TIME_REGEX.test(endTime)) {
      errors.push('올바른 시간 형식이 아닙니다.');
    }

    // Purposes validation
    if (!purposes || !Array.isArray(purposes) || purposes.length === 0) {
      errors.push('사용목적을 선택해주세요.');
    }

    // Purpose detail validation
    if (!purposeDetail?.trim()) {
      errors.push('사용설명을 입력해주세요.');
    } else if (purposeDetail.trim().length > VALIDATION.PURPOSE_DETAIL_MAX_LENGTH) {
      errors.push(`사용설명은 ${VALIDATION.PURPOSE_DETAIL_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

    // Has rental validation
    if (!hasRental) {
      errors.push('대관 유무를 선택해주세요.');
    } else if (!VALIDATION.VALID_HAS_RENTAL.includes(hasRental)) {
      errors.push('올바른 대관 유무 값이 아닙니다.');
    }

    // Organization length check (optional field)
    if (organization && organization.trim().length > VALIDATION.ORGANIZATION_MAX_LENGTH) {
      errors.push(`소속(단체)명은 ${VALIDATION.ORGANIZATION_MAX_LENGTH}자 이내로 입력해주세요.`);
    }

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
