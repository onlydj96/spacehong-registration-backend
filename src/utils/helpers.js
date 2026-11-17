// Option prices (KRW)
export const OPTION_PRICES = {
  extraCapacity: 100000,
  multitrack: 100000,
  personalMonitor: 100000,
  keyboard: 70000,
  extraOperator: 20000,  // per hour
  drumCleanup: 100000,
};

// Time constants
export const TIME_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  MIN_RENTAL_HOURS: 5,
  MAX_RENTAL_HOURS: 12,
};

// 최소 대관 시간 — 프론트 rentalPricing.js(RATE_SEASONS)와 같은 값을 유지해야 함
const PEAK_MONTHS = [10, 11, 12];
const MIN_HOURS_BY_VENUE = { performance: 5, event: 5, studio: 4 };
const PEAK_WEEKEND_MIN_HOURS = 7;

/**
 * 대관 유형·날짜별 최소 대관 시간
 * - 공연·행사 5시간, 촬영(studio) 4시간
 * - 성수기(10~12월) 금~일은 7시간
 * @param {string} venueType - performance | event | studio
 * @param {string} rentalDate - YYYY-MM-DD
 * @returns {number}
 */
export function getMinRentalHours(venueType, rentalDate) {
  const base = MIN_HOURS_BY_VENUE[venueType] ?? TIME_CONSTANTS.MIN_RENTAL_HOURS;
  const match = typeof rentalDate === 'string' && rentalDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return base;
  const [, y, m, d] = match.map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일, 5=금, 6=토
  const isFriToSun = day === 5 || day === 6 || day === 0;
  if (PEAK_MONTHS.includes(m) && isFriToSun) return Math.max(base, PEAK_WEEKEND_MIN_HOURS);
  return base;
}

// Validation patterns
export const VALIDATION_PATTERNS = {
  PHONE: /^01[016789]\d{7,8}$/,
  TIME: /^([01]\d|2[0-3]):([0-5]\d)$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

/**
 * Parse time string to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format or "익일 HH:MM" format
 * @returns {number} Minutes since midnight (or since midnight + 24h for next day)
 */
export function parseMinutes(timeStr) {
  if (!timeStr) return 0;

  // "익일 HH:MM" 형식 처리
  if (timeStr.startsWith('익일 ')) {
    const actualTime = timeStr.replace('익일 ', '');
    if (!VALIDATION_PATTERNS.TIME.test(actualTime)) return 0;
    const [h, m] = actualTime.split(':').map(Number);
    return h * TIME_CONSTANTS.MINUTES_PER_HOUR + m + 24 * TIME_CONSTANTS.MINUTES_PER_HOUR;
  }

  if (!VALIDATION_PATTERNS.TIME.test(timeStr)) {
    return 0;
  }
  const [h, m] = timeStr.split(':').map(Number);
  return h * TIME_CONSTANTS.MINUTES_PER_HOUR + m;
}

/**
 * Calculate additional price based on selected options
 * @param {Object} options - Selected options object
 * @returns {number} Total additional price in KRW
 */
export function calculatePrice(options) {
  if (!options || typeof options !== 'object') {
    return 0;
  }

  let total = 0;
  if (options.extraCapacity) total += OPTION_PRICES.extraCapacity;
  if (options.multitrack) total += OPTION_PRICES.multitrack;
  if (options.personalMonitor) total += OPTION_PRICES.personalMonitor;
  if (options.drumCleanup) total += OPTION_PRICES.drumCleanup;
  if (options.keyboard) total += OPTION_PRICES.keyboard;
  if (options.extraOperator) {
    const hours = Math.max(0, parseInt(options.extraOperatorHours, 10) || 0);
    total += OPTION_PRICES.extraOperator * hours;
  }
  return total;
}

/**
 * Format phone number with dashes
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
