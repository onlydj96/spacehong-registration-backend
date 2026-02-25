import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import reservationsRouter from './routes/reservations.js';
import siteVisitsRouter from './routes/siteVisits.js';
import settlementsRouter from './routes/settlements.js';
import adminRouter from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

app.use(express.json({ limit: '10kb' }));

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, errors: ['너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'] },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/health', healthRouter);
app.use('/api/reservations', submissionLimiter, reservationsRouter);
app.use('/api/site-visits', submissionLimiter, siteVisitsRouter);
app.use('/api/settlements', submissionLimiter, settlementsRouter);
app.use('/api/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errors: ['요청하신 경로를 찾을 수 없습니다.'],
  });
});

app.use(errorHandler);

export default app;
