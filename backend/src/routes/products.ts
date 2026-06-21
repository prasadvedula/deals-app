import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Product, PriceHistory, CrossPlatformPrice } from '../models/types';

const router = Router();

// GET /api/products - list with filters
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { category, sort = 'trending', limit = '20', offset = '0' } = req.query;

  let query = 'SELECT * FROM products WHERE 1=1';
  const params: (string | number)[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category as string);
  }

  switch (sort) {
    case 'price_asc':
      query += ' ORDER BY current_price ASC';
      break;
    case 'price_desc':
      query += ' ORDER BY current_price DESC';
      break;
    case 'discount':
      query += ' ORDER BY ((original_price - current_price) / original_price) DESC';
      break;
    default:
      query += ' ORDER BY trending_score DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const products = db.prepare(query).all(...params) as Product[];
  const total = (db.prepare('SELECT COUNT(*) as count FROM products' + (category ? ' WHERE category = ?' : '')).get(...(category ? [category] : [])) as { count: number }).count;

  res.json({ products, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
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

export default router;
