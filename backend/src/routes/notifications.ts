import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Notification } from '../models/types';
import { optionalAuth, JwtPayload } from '../middleware/auth';

const router = Router();

// JWT user → "user_1", query param → as-is, else default
function resolveUserId(req: Request): string {
  const u = (req as Request & { user?: JwtPayload }).user;
  if (u) return `user_${u.userId}`;
  return (req.query.user_id as string) || 'default_user';
}

// GET /api/notifications
router.get('/', optionalAuth, (req: Request, res: Response) => {
  const db        = getDb();
  const userId    = resolveUserId(req);
  const unreadOnly = req.query.unread === 'true';

  let query = `
    SELECT n.*, p.name as product_name, p.image_url, p.current_price
    FROM notifications n
    LEFT JOIN products p ON p.id = n.product_id
    WHERE n.user_id = ?
  `;
  if (unreadOnly) query += ' AND n.read = 0';
  query += ' ORDER BY n.created_at DESC LIMIT 50';

  const notifications = db.prepare(query).all(userId) as (Notification & {
    product_name: string;
    image_url: string;
  })[];

  const unreadCount = (
    db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(userId) as { count: number }
  ).count;

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', optionalAuth, (req: Request, res: Response) => {
  const db     = getDb();
  const userId = resolveUserId(req);

  const result = db.prepare(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'
  ).run(req.params.id, userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', optionalAuth, (req: Request, res: Response) => {
  const db     = getDb();
  const userId = resolveUserId(req);

  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  res.json({ success: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', optionalAuth, (req: Request, res: Response) => {
  const db     = getDb();
  const userId = resolveUserId(req);

  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .run(req.params.id, userId);
  res.json({ success: true });
});

export default router;
