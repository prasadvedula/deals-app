import { Router, Request, Response } from 'express';
import { runSupervisor } from '../services/agents/supervisor';
import { createGoal, listGoals, dismissGoal, huntGoal, DealGoal } from '../services/agents/dealHunter';
import { getProductReviews } from '../services/agents/reviewAggregator';
import { getBuyTimePrediction } from '../services/agents/buyTimePredictor';
import { getLatestWeeklyReport, generateWeeklyReport } from '../services/agents/weeklyReport';
import { optionalAuth, JwtPayload } from '../middleware/auth';

const router = Router();

function resolveUserId(req: Request): string {
  const u = (req as Request & { user?: JwtPayload }).user;
  if (u) return `user_${u.userId}`;
  return (req.query.user_id as string) || 'default_user';
}

// POST /api/agents/chat — LangGraph supervisor handles routing
router.post('/chat', async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }
  try {
    const result = await runSupervisor(message.trim());
    res.json(result);
  } catch (err) {
    console.error('[Agents/chat]', err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/goals — list deal goals
router.get('/goals', optionalAuth, (req: Request, res: Response) => {
  res.json(listGoals(resolveUserId(req)));
});

// POST /api/agents/goals — create a deal goal
router.post('/goals', optionalAuth, async (req: Request, res: Response) => {
  const { query, max_price, platforms } = req.body as {
    query?: string; max_price?: number; platforms?: string[];
  };
  if (!query?.trim()) { res.status(400).json({ error: 'query required' }); return; }
  try {
    const goal = createGoal({ query: query.trim(), max_price, platforms, user_id: resolveUserId(req) });
    huntGoal(goal).catch(e => console.error('[Goals] Hunt error:', e));
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/agents/goals/:id — dismiss a goal
router.delete('/goals/:id', (req: Request, res: Response) => {
  dismissGoal(parseInt(req.params.id));
  res.json({ success: true });
});

// GET /api/agents/reviews/:productId — get aggregated reviews
router.get('/reviews/:productId', async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: 'invalid product id' }); return; }
  try {
    const reviews = await getProductReviews(productId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/predict/:productId — buy-time prediction
router.get('/predict/:productId', async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: 'invalid product id' }); return; }
  try {
    const prediction = await getBuyTimePrediction(productId);
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/report — latest weekly report (generates if stale)
router.get('/report', async (_req: Request, res: Response) => {
  try {
    const report = await getLatestWeeklyReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/agents/report/generate — force regenerate
router.post('/report/generate', async (_req: Request, res: Response) => {
  try {
    const report = await generateWeeklyReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
