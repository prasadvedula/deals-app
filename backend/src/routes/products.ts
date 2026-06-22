import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Product, PriceHistory, CrossPlatformPrice } from '../models/types';
import { getDealDna } from '../services/agents/dealDna';
import { getSeasonalAlerts } from '../services/agents/seasonalPatterns';
import { getCouponStack } from '../services/agents/couponAdvisor';

const router = Router();

// GET /api/products - list with filters
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { category, search, sort = 'trending', limit = '20', offset = '0' } = req.query;

  let where = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (category) {
    where += ' AND category = ?';
    params.push(category as string);
  }
  if (search) {
    where += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))';
    params.push(`%${search}%`, `%${search}%`);
  }

  let orderBy: string;
  switch (sort) {
    case 'price_asc': orderBy = 'current_price ASC'; break;
    case 'price_desc': orderBy = 'current_price DESC'; break;
    case 'discount':  orderBy = '((original_price - current_price) / original_price) DESC'; break;
    case 'newest':    orderBy = 'created_at DESC'; break;
    default:          orderBy = 'trending_score DESC';
  }

  const limitN = parseInt(limit as string);
  const offsetN = parseInt(offset as string);
  const products = db.prepare(`SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limitN, offsetN) as Product[];
  const total = (db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params) as { count: number }).count;

  res.json({ products, total, limit: limitN, offset: offsetN });
});

// GET /api/products/best-deals - products with biggest price drop vs 30-day high
router.get('/best-deals', (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt((req.query.limit as string) || '20');

  const deals = db.prepare(`
    SELECT
      p.*,
      MAX(ph.price)  AS high_30d,
      MIN(ph.price)  AS low_30d,
      AVG(ph.price)  AS avg_30d,
      COUNT(ph.id)   AS price_points,
      ROUND((MAX(ph.price) - p.current_price) * 100.0 / MAX(ph.price), 1) AS deal_score,
      ROUND(MAX(ph.price) - p.current_price, 0)  AS savings_vs_30d_high
    FROM products p
    JOIN price_history ph ON ph.product_id = p.id
    WHERE ph.recorded_at >= datetime('now', '-30 days')
    GROUP BY p.id
    HAVING deal_score > 0
    ORDER BY deal_score DESC
    LIMIT ?
  `).all(limit) as (Product & {
    high_30d: number;
    low_30d: number;
    avg_30d: number;
    price_points: number;
    deal_score: number;
    savings_vs_30d_high: number;
  })[];

  res.json(deals);
});

// GET /api/products/trending - top trending
router.get('/trending', (_req: Request, res: Response) => {
  const db = getDb();
  const products = db.prepare(
    'SELECT * FROM products ORDER BY trending_score DESC LIMIT 12'
  ).all() as Product[];
  res.json(products);
});

// GET /api/products/categories - list categories
router.get('/categories', (_req: Request, res: Response) => {
  const db = getDb();
  const cats = db.prepare(
    'SELECT DISTINCT category, COUNT(*) as count FROM products GROUP BY category ORDER BY count DESC'
  ).all() as { category: string; count: number }[];
  res.json(cats);
});

// GET /api/products/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Product | undefined;

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const priceHistory = db.prepare(
    'SELECT * FROM price_history WHERE product_id = ? ORDER BY recorded_at DESC LIMIT 30'
  ).all(req.params.id) as PriceHistory[];

  const crossPrices = db.prepare(
    'SELECT * FROM cross_platform_prices WHERE product_id = ? ORDER BY price ASC'
  ).all(req.params.id) as CrossPlatformPrice[];

  res.json({ product, priceHistory, crossPrices });
});

// GET /api/products/:id/price-history
router.get('/:id/price-history', (req: Request, res: Response) => {
  const db = getDb();
  const history = db.prepare(
    'SELECT * FROM price_history WHERE product_id = ? ORDER BY recorded_at ASC'
  ).all(req.params.id) as PriceHistory[];
  res.json(history);
});

// GET /api/products/:id/cross-prices
router.get('/:id/cross-prices', (req: Request, res: Response) => {
  const db = getDb();
  const prices = db.prepare(
    'SELECT * FROM cross_platform_prices WHERE product_id = ? ORDER BY price ASC'
  ).all(req.params.id) as CrossPlatformPrice[];
  res.json(prices);
});

// GET /api/products/:id/deal-dna — price pattern analysis
router.get('/:id/deal-dna', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  try {
    res.json(await getDealDna(id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/products/:id/seasonal — seasonal sale alerts
router.get('/:id/seasonal', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const db = getDb();
  const product = db.prepare('SELECT category FROM products WHERE id = ?').get(id) as { category: string } | undefined;
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json(getSeasonalAlerts(id, product.category));
});

// GET /api/products/:id/coupons — coupon stack for this product
router.get('/:id/coupons', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  try {
    res.json(await getCouponStack(id, product.name, product.platform, product.current_price));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
