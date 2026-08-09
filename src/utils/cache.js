import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  useClones: false,
});

export function getCached(key) {
  return cache.get(key);
}

export function setCached(key, value, ttl = 600) {
  return cache.set(key, value, ttl);
}

export function deleteCached(key) {
  return cache.del(key);
}

export function clearCache() {
  return cache.flushAll();
}

export const CACHE_KEYS = {
  STATISTICS: 'admin:statistics',
  RESERVATIONS_LIST: 'admin:reservations:list',
  SITE_VISITS_LIST: 'admin:sitevisits:list',
  SETTLEMENTS_LIST: 'admin:settlements:list',
  ANALYTICS: 'admin:analytics',
};

export default cache;