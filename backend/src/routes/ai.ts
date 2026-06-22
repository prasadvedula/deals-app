import { Router, Request, Response } from 'express';
import { ragProductSearch, getAIRecommendations } from '../services/ai/rag';
import { streamChatResponse, generateResponse } from '../services/ai/provider';
import { getDb } from '../database/db';
import { triggerManualMonitoring } from '../services/scheduler';
import { AI_PROVIDER, providerInfo } from '../services/ai/provider';
import { searchAcrossPlatforms } from '../services/agents/platformSearch';
import { Product } from '../models/types';
import { getSeasonalBanner } from '../services/agents/seasonalPatterns';

const router = Router();
const DEFAULT_USER = 'default_user';

// GET /api/ai/provider
router.get('/provider', (_req, res) => {
  res.json(providerInfo());
});

// POST /api/ai/search
router.post('/search', async (req: Request, res: Response) => {
  const { query, limit = 10 } = req.body as { query: string; limit?: number };
  if (!query?.trim()) { res.status(400).json({ error: 'query required' }); return; }
  try {
    res.json(await ragProductSearch(query.trim(), limit));
  } catch (err) {
    console.error('[AI Search]', err);
    res.status(500).json({ error: 'AI search failed', details: String(err) });
  }
});

// GET /api/ai/recommendations
router.get('/recommendations', async (req: Request, res: Response) => {
  const userId = (req.query.user_id as string) || DEFAULT_USER;
  const db = getDb();
  const favs = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(userId) as { product_id: number }[];
  try {
    res.json(await getAIRecommendations(userId, favs.map((f) => f.product_id)));
  } catch (err) {
    res.status(500).json({ error: 'Recommendations failed', details: String(err) });
  }
});

// POST /api/ai/chat  (SSE streaming)
router.post('/chat', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body as {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const db = getDb();

  // Fetch product with full cross-platform price data for context
  const top = db.prepare(`
    SELECT p.name, p.category, p.current_price, p.original_price, p.platform,
           GROUP_CONCAT(cp.platform || ':₹' || cp.price, ' | ') as cross_prices
    FROM products p
    LEFT JOIN cross_platform_prices cp ON cp.product_id = p.id
    GROUP BY p.id
    ORDER BY p.trending_score DESC
    LIMIT 15
  `).all() as {
    name: string; category: string; current_price: number;
    original_price: number; platform: string; cross_prices: string | null;
  }[];

  const productContext = top.map((p) => {
    const discount = Math.round(((p.original_price - p.current_price) / p.original_price) * 100);
    const crossInfo = p.cross_prices ? ` | Other platforms: ${p.cross_prices}` : '';
    return `• ${p.name} (${p.category}) — ₹${p.current_price.toLocaleString('en-IN')} on ${p.platform}${discount > 0 ? ` (${discount}% off MRP ₹${p.original_price.toLocaleString('en-IN')})` : ''}${crossInfo}`;
  }).join('\n');

  const system = `You are a helpful AI shopping assistant for DealsApp, an Indian e-commerce price comparison platform.

IMPORTANT RULES:
- ALL prices are in Indian Rupees (INR). ALWAYS use the ₹ symbol — NEVER use $ or USD.
- Indian platforms: Flipkart, Amazon India, Myntra, Meesho, Snapdeal, Nykaa, Ajio, Tata CLiQ.
- Format prices in Indian style: ₹1,299 or ₹17,999 or ₹1,29,999.
- When asked about a product's price on a specific platform, check the cross-platform data below.
- Be concise, helpful, and savings-focused.
- NEVER say "not listed" or "not in catalog". If a product is not in the catalog below, tell the user to use the AI Search page to find it across all platforms — it will search Flipkart, Amazon India, Myntra, Meesho, Snapdeal, and Nykaa and automatically add it to the catalog.

CURRENT PRODUCT CATALOG WITH PRICES:
${productContext}

If a product is not in the catalog above, say: "I don't have that product in our current catalog. Use the **AI Search** page (click 'AI Search' in the top navigation) to search for it across Flipkart, Amazon India, Myntra, Meesho, Snapdeal, and Nykaa — it will automatically add the best results to our catalog for price tracking."`;


  try {
    await streamChatResponse([...history, { role: 'user', content: message }], system, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`);
    res.end();
  }
});

// POST /api/ai/monitor
router.post('/monitor', async (_req, res) => {
  res.json({ success: true, provider: AI_PROVIDER, message: 'Price monitoring started' });
  triggerManualMonitoring().catch((e) => console.error('[Monitor]', e));
});

// POST /api/ai/platform-search — agent searches all platforms + saves to catalog
router.post('/platform-search', async (req: Request, res: Response) => {
  const { query, platforms } = req.body as { query: string; platforms?: string[] };
  if (!query?.trim()) { res.status(400).json({ error: 'query required' }); return; }

  try {
    const results = await searchAcrossPlatforms(query.trim(), platforms);
    const totalProducts = results.reduce((sum, r) => sum + r.products.length, 0);
    res.json({ query, results, totalProducts, provider: AI_PROVIDER });
  } catch (err) {
    console.error('[Platform Search]', err);
    res.status(500).json({ error: 'Platform search failed', details: String(err) });
  }
});

// GET /api/ai/agent-tasks
router.get('/agent-tasks', (_req, res) => {
  const tasks = getDb().prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT 20').all();
  res.json(tasks);
});

// POST /api/ai/mood-search — interpret a mood/intent query and return curated products
router.post('/mood-search', async (req: Request, res: Response) => {
  const { mood, budget } = req.body as { mood: string; budget?: number };
  if (!mood?.trim()) { res.status(400).json({ error: 'mood required' }); return; }

  const db = getDb();
  const catalog = db.prepare(`
    SELECT id, name, category, current_price, original_price, platform, image_url, description,
      ROUND((original_price - current_price) * 100.0 / original_price, 0) AS discount_pct,
      trending_score
    FROM products
    ${budget ? 'WHERE current_price <= ?' : ''}
    ORDER BY trending_score DESC
    LIMIT 30
  `).all(...(budget ? [budget] : [])) as (Product & { discount_pct: number })[];

  if (!catalog.length) {
    res.json({ mood, products: [], reasoning: 'No products in catalog yet.' });
    return;
  }

  const catalogText = catalog.map(p =>
    `ID:${p.id} | ${p.name} (${p.category}) | ₹${p.current_price.toLocaleString('en-IN')}${p.discount_pct > 0 ? ` (${p.discount_pct}% off)` : ''} on ${p.platform}`
  ).join('\n');

  const prompt = `You are a personal shopping curator for Indian e-commerce.

Customer's mood/request: "${mood}"${budget ? `\nBudget: ₹${budget.toLocaleString('en-IN')}` : ''}

Available products:
${catalogText}

Pick the 4–6 products that BEST match this mood/intent. Consider:
- Emotional fit (treat_myself → premium, gift_idea → presentable, budget_buy → best value, surprise_me → most exciting deal)
- Value for money and current discount
- Category relevance to the mood
- Trending score

Return a JSON with:
{
  "moodCategory": "treat_myself|gift_idea|budget_buy|practical|surprise_me|festival",
  "reasoning": "1-2 sentence explanation of your curation",
  "productIds": [array of selected product IDs in order of fit]
}`;

  try {
    const raw = await generateResponse(prompt, 'You are a personal shopping curator. Output only valid JSON.');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]) as {
      moodCategory?: string;
      reasoning?: string;
      productIds?: number[];
    };

    const selectedIds = new Set(parsed.productIds ?? []);
    const selectedProducts = catalog
      .filter(p => selectedIds.has(p.id))
      .sort((a, b) => (parsed.productIds?.indexOf(a.id) ?? 0) - (parsed.productIds?.indexOf(b.id) ?? 0));

    res.json({
      mood,
      moodCategory: parsed.moodCategory ?? 'general',
      reasoning: parsed.reasoning ?? '',
      products: selectedProducts,
    });
  } catch (err) {
    console.error('[MoodSearch]', err);
    // Fallback: return top discounted products
    res.json({
      mood,
      moodCategory: 'general',
      reasoning: 'Here are our top current deals that might match your mood.',
      products: catalog.sort((a, b) => b.discount_pct - a.discount_pct).slice(0, 5),
    });
  }
});

// GET /api/ai/seasonal — site-wide seasonal banner
router.get('/seasonal', (_req: Request, res: Response) => {
  res.json(getSeasonalBanner());
});

export default router;
