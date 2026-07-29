import { parseMinutes } from '../utils/helpers.js';

const PHONE_REGEX = /^01[016789]\d{7,8}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const NEXT_DAY_TIME_REGEX = /^익일 ([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// XSS 방지를 위한 위험 패턴
// Note: g 플래그 미사용 — .test()로 존재 여부만 확인하므로 stateful lastIndex 불필요
// g 플래그가 있으면 연속 호출 시 lastIndex가 전진하여 교대로 검증이 우회됨
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
];

/**
 * XSS 위험 패턴 검사
 * @param {string} value - 검사할 문자열
 * @returns {boolean} - 위험 패턴 포함 여부
 */
function containsDangerousPatterns(value) {
  if (!value || typeof value !== 'string') return false;
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * 문자열 sanitization (HTML 태그 제거)
 * @param {string} value - 정제할 문자열
 * @returns {string} - 정제된 문자열
 */
function sanitizeString(value) {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

// 환경변수에서 설정값 로드 (기본값 제공)
const ALLOWED_REFERRALS = (process.env.ALLOWED_REFERRALS || '스페이스클라우드,아워플레이스,네이버,인스타,지인 추천,기타')
  .split(',')
  .map(s => s.trim());
const ALLOWED_VENUE_TYPES = (process.env.ALLOWED_VENUE_TYPES || 'performance,event,studio')
  .split(',')
  .map(s => s.trim());

const MAX_PERFORMERS = parseInt(process.env.MAX_PERFORMERS, 10) || 200;
const MAX_OPERATOR_HOURS = parseInt(process.env.MAX_OPERATOR_HOURS, 10) || 12;
const MAX_NAME_LENGTH = parseInt(process.env.MAX_NAME_LENGTH, 10) || 50;
const MAX_DESCRIPTION_LENGTH = parseInt(process.env.MAX_DESCRIPTION_LENGTH, 10) || 500;
const MAX_SIGNATURE_SIZE = parseInt(process.env.MAX_SIGNATURE_SIZE, 10) || 500000; // 500KB (실제 바이트 기준)

/**
 * Base64 Data URL에서 실제 바이트 크기 계산
 * Base64는 원본보다 약 33% 더 크므로 정확한 크기 계산 필요
 * @param {string} dataUrl - data:image/png;base64,... 형식의 문자열
 * @returns {number} - 실제 바이트 크기
 */
function getBase64ByteSize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;

  // data:image/png;base64, 부분 제거
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index === -1) return dataUrl.length;

  const base64String = dataUrl.substring(base64Index + 7);

  // Base64 패딩(=) 개수 확인
  let padding = 0;
  if (base64String.endsWith('==')) padding = 2;
  else if (base64String.endsWith('=')) padding = 1;

  // 실제 바이트 크기 계산: (base64길이 * 3 / 4) - 패딩
  return Math.floor((base64String.length * 3) / 4) - padding;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateReservation(req, res, next) {
  const errors = [];
  const {
    venueType, name, phone, email, rentalDate, startTime, endTime,
    numPerformers, description, referralSources, options
  } = req.body;

  if (!venueType || !ALLOWED_VENUE_TYPES.includes(venueType)) {
    errors.push('대관 유형을 선택해주세요.');
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('성함은 필수입니다.');
  } else if (name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`성함은 ${MAX_NAME_LENGTH}자 이내로 입력해주세요.`);
  }

  if (req.body.organization && typeof req.body.organization === 'string' && req.body.organization.trim().length > 200) {
    errors.push('소속은 200자 이내로 입력해주세요.');
  }

  if (!phone) {
    errors.push('전화번호는 필수입니다.');
  } else {
    const digits = phone.replace(/[-\s]/g, '');
    if (!PHONE_REGEX.test(digits)) {
      errors.push('올바른 전화번호 형식이 아닙니다.');
    }
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('이메일은 필수입니다.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('올바른 이메일 형식이 아닙니다.');
  } else if (email.trim().length > 254) {
    errors.push('이메일은 254자 이내로 입력해주세요.');
  }

  if (!rentalDate) {
    errors.push('대관날짜는 필수입니다.');
  } else if (!DATE_REGEX.test(rentalDate)) {
    errors.push('대관날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
  } else {
    const date = new Date(rentalDate);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(date.getTime()) || date <= today) {
      errors.push('대관날짜는 오늘 이후여야 합니다.');
    }
    // 너무 먼 미래 날짜 제한 (1년 이내)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    if (date > maxDate) {
      errors.push('대관날짜는 1년 이내로 선택해주세요.');
    }
  }

  if (!startTime || !TIME_REGEX.test(startTime)) {
    errors.push('시작 시간이 올바르지 않습니다.');
  }

  // 종료 시간: 일반 형식 또는 "익일 HH:MM" 형식 허용
  const isValidEndTime = endTime && (TIME_REGEX.test(endTime) || NEXT_DAY_TIME_REGEX.test(endTime));
  if (!isValidEndTime) {
    errors.push('종료 시간이 올바르지 않습니다.');
  }

  if (startTime && isValidEndTime && TIME_REGEX.test(startTime)) {
    const startMin = parseMinutes(startTime);

    // 익일 시간 처리: "익일 HH:MM" → 24시간 추가
    let endMin;
    if (NEXT_DAY_TIME_REGEX.test(endTime)) {
      const actualEndTime = endTime.replace('익일 ', '');
      endMin = parseMinutes(actualEndTime) + 24 * 60;
    } else {
      endMin = parseMinutes(endTime);
    }

    // 종료 시간이 시작 시간보다 늦어야 함
    if (endMin <= startMin) {
      errors.push('종료 시간은 시작 시간보다 늦어야 합니다.');
    } else {
      const hours = (endMin - startMin) / 60;
      if (hours < 5) {
        errors.push('대관시간은 최소 5시간 이상이어야 합니다.');
      }
    }
  }

  if (!numPerformers || !Number.isInteger(numPerformers) || numPerformers < 1) {
    errors.push('공연자 인원은 1명 이상이어야 합니다.');
  } else if (numPerformers > MAX_PERFORMERS) {
    errors.push(`공연자 인원은 ${MAX_PERFORMERS}명 이하여야 합니다.`);
  }

  if (description && typeof description === 'string') {
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`대관 설명은 ${MAX_DESCRIPTION_LENGTH}자 이내로 입력해주세요.`);
    }
    if (containsDangerousPatterns(description)) {
      errors.push('대관 설명에 허용되지 않는 내용이 포함되어 있습니다.');
    }
  }

  if (referralSources && Array.isArray(referralSources)) {
    for (const src of referralSources) {
      if (!ALLOWED_REFERRALS.includes(src)) {
        errors.push(`유입경로 "${src}"는 유효하지 않습니다.`);
      }
    }
  }

  if (options && typeof options === 'object') {
    const boolFields = ['extraCapacity', 'multitrack', 'personalMonitor', 'extraOperator', 'barOperation', 'prompter', 'drumCleanup', 'taxInvoice'];
    for (const field of boolFields) {
      if (options[field] !== undefined && typeof options[field] !== 'boolean') {
        errors.push(`옵션 "${field}"는 true/false 값이어야 합니다.`);
      }
    }
    if (options.extraOperator) {
      if (!options.extraOperatorHours || options.extraOperatorHours < 1) {
        errors.push('추가 오퍼레이터 선택 시 시간을 입력해주세요.');
      } else if (options.extraOperatorHours > MAX_OPERATOR_HOURS) {
        errors.push(`추가 오퍼레이터 시간은 ${MAX_OPERATOR_HOURS}시간 이하여야 합니다.`);
      }
    }
  }

  // termsAgreed 필수 검증
  const { termsAgreed } = req.body;
  if (termsAgreed !== true) {
    errors.push('이용약관에 동의해주세요.');
  }

  // signatureData 형식 검증 (Base64 Data URL 형식)
  const { signatureData } = req.body;
  if (signatureData) {
    if (typeof signatureData !== 'string') {
      errors.push('서명 데이터 형식이 올바르지 않습니다.');
    } else if (!signatureData.startsWith('data:image/')) {
      errors.push('서명 데이터는 이미지 형식이어야 합니다.');
    } else {
      // Base64 인코딩된 데이터의 실제 바이트 크기 계산
      const actualByteSize = getBase64ByteSize(signatureData);
      if (actualByteSize > MAX_SIGNATURE_SIZE) {
        errors.push(`서명 데이터가 너무 큽니다. (최대 ${Math.round(MAX_SIGNATURE_SIZE / 1024)}KB)`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}
