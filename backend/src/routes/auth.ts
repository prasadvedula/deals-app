import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database/db';
import { signToken, requireAuth, JwtPayload } from '../middleware/auth';

const router = Router();

interface DbUser {
  id: number; name: string; email: string;
  password_hash: string; avatar_initials: string; created_at: string;
}

function safe(user: DbUser) {
  return { id: user.id, name: user.name, email: user.email, avatar_initials: user.avatar_initials, created_at: user.created_at };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: 'name, email and password are required' }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' }); return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }

  try {
    const hash = await bcrypt.hash(password, 10);
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, avatar_initials) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.toLowerCase().trim(), hash, initials);

    const user: DbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as DbUser;
    const token = signToken({ userId: user.id, email: user.email, name: user.name });
    res.status(201).json({ token, user: safe(user) });
  } catch (err) {
    console.error('[Auth/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'email and password are required' }); return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as DbUser | undefined;
  if (!user) { res.status(401).json({ error: 'Invalid email or password' }); return; }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }

  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  res.json({ token, user: safe(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const jwtUser = (req as Request & { user?: JwtPayload }).user!;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(jwtUser.userId) as DbUser | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ user: safe(user) });
});

export default router;
