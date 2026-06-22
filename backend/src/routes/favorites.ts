import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Favorite, Product } from '../models/types';
import { optionalAuth, requireAuth, JwtPayload } from '../middleware/auth';

const router = Router();

// Extract user_id: JWT user → fallback to query param → fallback to default
function userId(req: Request): string {
  const u = (req as Request & { user?: JwtPayload }).user;
  return u ? `user_${u.userId}` : ((req.query.user_id as string) || 'default_user');
}

// GET /api/favorites
router.get('/', optionalAuth, (req: Request, res: Response) => {
  const db = getDb();
  const uid = userId(req);
  const favorites = db.prepare(`
    SELECT f.*, p.name, p.description, p.category, p.current_price, p.original_price,
           p.image_url, p.platform, p.trending_score
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    WHERE f.user_id = ?
    ORDER BY f.added_at DESC
  `).all(uid) as (Favorite & Product)[];
  res.json(favorites);
});

// POST /api/favorites — requires login
router.post('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const uid = userId(req);
  const { product_id, price_alert_threshold = 0.15 } = req.body as {
    product_id: number; price_alert_threshold?: number;
  };
  if (!product_id) { res.status(400).json({ error: 'product_id is required' }); return; }

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id) as Product | undefined;
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  try {
    db.prepare('INSERT INTO favorites (user_id, product_id, price_alert_threshold) VALUES (?, ?, ?)')
      .run(uid, product_id, price_alert_threshold);
    res.status(201).json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Already in wishlist' });
    } else {
      res.status(500).json({ error: 'Failed to add to wishlist' });
    }
  }
});

// DELETE /api/favorites/:productId — requires login
router.delete('/:productId', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const uid = userId(req);
  const result = db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?')
    .run(uid, req.params.productId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not in wishlist' }); return; }
  res.json({ success: true });
});

// PATCH /api/favorites/:productId/threshold
router.patch('/:productId/threshold', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const uid = userId(req);
  const { price_alert_threshold } = req.body as { price_alert_threshold: number };
  if (price_alert_threshold === undefined || price_alert_threshold < 0 || price_alert_threshold > 1) {
    res.status(400).json({ error: 'threshold must be 0–1' }); return;
  }
  const result = db.prepare('UPDATE favorites SET price_alert_threshold = ? WHERE user_id = ? AND product_id = ?')
    .run(price_alert_threshold, uid, req.params.productId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not in wishlist' }); return; }
  res.json({ success: true, price_alert_threshold });
});

// GET /api/favorites/check/:productId
router.get('/check/:productId', optionalAuth, (req: Request, res: Response) => {
  const db = getDb();
  const uid = userId(req);
  const fav = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND product_id = ?')
    .get(uid, req.params.productId) as Favorite | undefined;
  res.json({ is_favorite: !!fav });
});

export default router;
