import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products';
import favoritesRouter from './routes/favorites';
import notificationsRouter from './routes/notifications';
import aiRouter from './routes/ai';
import importRouter from './routes/import';
import agentsRouter from './routes/agents';
import authRouter from './routes/auth';
import { providerInfo } from './services/ai/provider';

const app = express();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  if (!origin || ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) return cb(null, true);
  cb(new Error(`CORS blocked: ${origin}`));
}}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ai: providerInfo() });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/import', importRouter);
app.use('/api/agents', agentsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;
