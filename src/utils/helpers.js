export function parseMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function calculatePrice(options) {
  let total = 0;
  if (options.extraCapacity) total += 100000;
  if (options.multitrack) total += 100000;
  if (options.personalMonitor) total += 100000;
  if (options.extraOperator) total += 20000 * (options.extraOperatorHours || 0);
  return total;
}
