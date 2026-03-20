import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import healthRouter from './routes/health.js';
import reservationsRouter from './routes/reservations.js';
import siteVisitsRouter from './routes/siteVisits.js';
import settlementsRouter from './routes/settlements.js';
import adminRouter from './routes/admin/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

const app = express();

// Trust proxy (needed for rate limiting behind reverse proxy like Vercel)
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(requestLogger);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

/**
 * Rate limit key generator
 * Uses combination of IP + User-Agent for better identification
 * Helps distinguish users behind same NAT
 * Uses ipKeyGenerator helper for proper IPv6 handling
 */
const generateRateLimitKey = (req, res) => {
  const ip = ipKeyGenerator(req, res);
  const userAgent = req.headers['user-agent'] || 'unknown';
  // Hash user-agent to reduce key size while maintaining uniqueness
  const uaHash = userAgent.slice(0, 50);
  return `${ip}-${uaHash}`;
};

// Rate limiter for public form submissions (strict)
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, errors: ['너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'] },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
  // Skip rate limiting in development
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiter for admin API (more permissive but still protected)
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { success: false, errors: ['요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'] },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
});

// Rate limiter for search endpoint (prevent abuse)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: { success: false, errors: ['검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'] },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
});

app.use('/api/health', healthRouter);
app.use('/api/reservations', submissionLimiter, reservationsRouter);
app.use('/api/site-visits', submissionLimiter, siteVisitsRouter);
app.use('/api/settlements', submissionLimiter, settlementsRouter);
app.use('/api/admin/search', searchLimiter); // Apply search limiter before admin router
app.use('/api/admin', adminLimiter, adminRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errors: ['요청하신 경로를 찾을 수 없습니다.'],
  });
});

app.use(errorHandler);

export default app;
