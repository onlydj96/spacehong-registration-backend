import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import reservationsRouter from './routes/reservations.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/reservations', reservationsRouter);

app.use(errorHandler);

export default app;
