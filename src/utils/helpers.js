const OPTION_PRICES = {
  extraCapacity: 100000,
  multitrack: 100000,
  personalMonitor: 100000,
  extraOperator: 20000,  // per hour
};

export function parseMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function calculatePrice(options) {
  let total = 0;
  if (options.extraCapacity) total += OPTION_PRICES.extraCapacity;
  if (options.multitrack) total += OPTION_PRICES.multitrack;
  if (options.personalMonitor) total += OPTION_PRICES.personalMonitor;
  if (options.extraOperator) total += OPTION_PRICES.extraOperator * (options.extraOperatorHours || 0);
  return total;
}
