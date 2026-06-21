import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { Notification } from '../models/types';

const router = Router();
const DEFAULT_USER = 'default_user';

// GET /api/notifications
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;
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
router.patch('/:id/read', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

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
router.patch('/read-all', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

  db.prepare(
    'UPDATE notifications SET read = 1 WHERE user_id = ?'
  ).run(userId);

  res.json({ success: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req.query.user_id as string) || DEFAULT_USER;

  db.prepare(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?'
  ).run(req.params.id, userId);

  res.json({ success: true });
});

export default router;
