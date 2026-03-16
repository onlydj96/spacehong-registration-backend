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

export function cacheMiddleware(keyGenerator, ttl = 300) {
  return (req, res, next) => {
    const key = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : keyGenerator;

    const cached = getCached(key);
    if (cached) {
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && data.success !== false) {
        setCached(key, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

export const CACHE_KEYS = {
  STATISTICS: 'admin:statistics',
  RESERVATIONS_LIST: 'admin:reservations:list',
  SITE_VISITS_LIST: 'admin:sitevisits:list',
  SETTLEMENTS_LIST: 'admin:settlements:list',
};

export default cache;