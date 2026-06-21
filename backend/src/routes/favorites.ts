import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Favorite, Product } from '../models/types';

const router = Router();

const DEFAULT_USER = 'default_user';

// GET /api/favorites
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

  const favorites = db.prepare(`
    SELECT f.*, p.name, p.description, p.category, p.current_price, p.original_price,
           p.image_url, p.platform, p.trending_score
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    WHERE f.user_id = ?
    ORDER BY f.added_at DESC
  `).all(userId) as (Favorite & Product)[];

  res.json(favorites);
});

// POST /api/favorites
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { product_id, user_id = DEFAULT_USER, price_alert_threshold = 0.15 } = req.body as {
    product_id: number;
    user_id?: string;
    price_alert_threshold?: number;
  };

  if (!product_id) {
    res.status(400).json({ error: 'product_id is required' });
    return;
  }

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id) as Product | undefined;
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  try {
    db.prepare(`
      INSERT INTO favorites (user_id, product_id, price_alert_threshold)
      VALUES (?, ?, ?)
    `).run(user_id, product_id, price_alert_threshold);

    res.status(201).json({ success: true, message: 'Added to favorites' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Already in favorites' });
    } else {
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  }
});

// DELETE /api/favorites/:productId
router.delete('/:productId', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

  const result = db.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND product_id = ?'
  ).run(userId, req.params.productId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Favorite not found' });
    return;
  }

  res.json({ success: true, message: 'Removed from favorites' });
});

// PATCH /api/favorites/:productId/threshold
router.patch('/:productId/threshold', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;
  const { price_alert_threshold } = req.body as { price_alert_threshold: number };

  if (price_alert_threshold === undefined || price_alert_threshold < 0 || price_alert_threshold > 1) {
    res.status(400).json({ error: 'price_alert_threshold must be between 0 and 1' });
    return;
  }

  const result = db.prepare(`
    UPDATE favorites SET price_alert_threshold = ?
    WHERE user_id = ? AND product_id = ?
  `).run(price_alert_threshold, userId, req.params.productId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Favorite not found' });
    return;
  }

  res.json({ success: true, price_alert_threshold });
});

// GET /api/favorites/check/:productId
router.get('/check/:productId', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

  const fav = db.prepare(
    'SELECT * FROM favorites WHERE user_id = ? AND product_id = ?'
  ).get(userId, req.params.productId) as Favorite | undefined;

  res.json({ is_favorite: !!fav, favorite: fav || null });
});

export default router;
