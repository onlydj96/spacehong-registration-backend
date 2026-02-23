import { parseMinutes } from '../utils/helpers.js';

const PHONE_REGEX = /^01[016789]\d{7,8}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_REFERRALS = ['스페이스클라우드', '아워플레이스', '네이버', '인스타', '기타'];

const MAX_PERFORMERS = 200;
const MAX_OPERATOR_HOURS = 12;
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;

export function validateReservation(req, res, next) {
  const errors = [];
  const {
    name, phone, rentalDate, startTime, endTime,
    numPerformers, description, referralSources, options
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('성함은 필수입니다.');
  } else if (name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`성함은 ${MAX_NAME_LENGTH}자 이내로 입력해주세요.`);
  }

  if (!phone) {
    errors.push('전화번호는 필수입니다.');
  } else {
    const digits = phone.replace(/[-\s]/g, '');
    if (!PHONE_REGEX.test(digits)) {
      errors.push('올바른 전화번호 형식이 아닙니다.');
    }
  }

  if (!rentalDate) {
    errors.push('대관날짜는 필수입니다.');
  } else {
    const date = new Date(rentalDate);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(date.getTime()) || date <= today) {
      errors.push('대관날짜는 오늘 이후여야 합니다.');
    }
  }

  if (!startTime || !TIME_REGEX.test(startTime)) {
    errors.push('시작 시간이 올바르지 않습니다.');
  }
  if (!endTime || !TIME_REGEX.test(endTime)) {
    errors.push('종료 시간이 올바르지 않습니다.');
  }

  if (startTime && endTime && TIME_REGEX.test(startTime) && TIME_REGEX.test(endTime)) {
    const startMin = parseMinutes(startTime);
    const endMin = parseMinutes(endTime);
    const hours = (endMin - startMin) / 60;
    if (hours < 5) {
      errors.push('대관시간은 최소 5시간 이상이어야 합니다.');
    }
  }

  if (!numPerformers || !Number.isInteger(numPerformers) || numPerformers < 1) {
    errors.push('공연자 인원은 1명 이상이어야 합니다.');
  } else if (numPerformers > MAX_PERFORMERS) {
    errors.push(`공연자 인원은 ${MAX_PERFORMERS}명 이하여야 합니다.`);
  }

  if (description && typeof description === 'string' && description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`대관 설명은 ${MAX_DESCRIPTION_LENGTH}자 이내로 입력해주세요.`);
  }

  if (referralSources && Array.isArray(referralSources)) {
    for (const src of referralSources) {
      if (!ALLOWED_REFERRALS.includes(src)) {
        errors.push(`유입경로 "${src}"는 유효하지 않습니다.`);
      }
    }
  }

  if (options) {
    if (options.extraOperator) {
      if (!options.extraOperatorHours || options.extraOperatorHours < 1) {
        errors.push('추가 오퍼레이터 선택 시 시간을 입력해주세요.');
      } else if (options.extraOperatorHours > MAX_OPERATOR_HOURS) {
        errors.push(`추가 오퍼레이터 시간은 ${MAX_OPERATOR_HOURS}시간 이하여야 합니다.`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}
