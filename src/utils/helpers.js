// Option prices (KRW)
export const OPTION_PRICES = {
  extraCapacity: 100000,
  multitrack: 100000,
  personalMonitor: 100000,
  extraOperator: 20000,  // per hour
};

// Time constants
export const TIME_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  MIN_RENTAL_HOURS: 2,
  MAX_RENTAL_HOURS: 12,
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  PHONE: /^01[016789]\d{7,8}$/,
  TIME: /^([01]\d|2[0-3]):([0-5]\d)$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
};

/**
 * Parse time string to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Minutes since midnight
 */
export function parseMinutes(timeStr) {
  if (!timeStr || !VALIDATION_PATTERNS.TIME.test(timeStr)) {
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
