/**
 * Autonomous Deal Hunter Agent
 *
 * Users set a "deal goal" (product + max price). The agent:
 *  1. Immediately searches across platforms
 *  2. Saves matched products to the catalog
 *  3. Marks the goal status: "found" if price ≤ max_price, else "watching"
 *  4. The scheduler re-runs all watching goals every 30 min
 *  5. When a match is found a WebSocket notification is fired
 */

import { getDb } from '../../database/db';
import { searchAcrossPlatforms } from './platformSearch';
import { generateResponse } from '../ai/provider';
import { broadcast } from '../websocket';

export interface DealGoal {
  id: number;
  user_id: string;
  query: string;
  max_price: number | null;
  target_platforms: string;
  status: 'watching' | 'found' | 'dismissed';
  best_match_id: number | null;
  best_price: number | null;
  notes: string;
  last_checked: string | null;
  created_at: string;
}

export interface CreateGoalInput {
  query: string;
  max_price?: number;
  platforms?: string[];
  user_id?: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export function createGoal(input: CreateGoalInput): DealGoal {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO deal_goals (user_id, query, max_price, target_platforms, status)
    VALUES (?, ?, ?, ?, 'watching')
  `).run(
    input.user_id ?? 'default_user',
    input.query,
    input.max_price ?? null,
    JSON.stringify(input.platforms ?? [])
  );
  return db.prepare('SELECT * FROM deal_goals WHERE id = ?').get(result.lastInsertRowid) as DealGoal;
}

export function listGoals(userId = 'default_user'): DealGoal[] {
  return getDb()
    .prepare("SELECT * FROM deal_goals WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as DealGoal[];
}

export function dismissGoal(id: number): void {
  getDb().prepare("UPDATE deal_goals SET status = 'dismissed' WHERE id = ?").run(id);
}

// ── Core hunt logic ───────────────────────────────────────────────────────────
export async function huntGoal(goal: DealGoal): Promise<void> {
  const db = getDb();
  const platforms = (() => {
    try { return JSON.parse(goal.target_platforms) as string[]; }
    catch { return []; }
  })();

  const results = await searchAcrossPlatforms(goal.query, platforms.length ? platforms : undefined);
  const allProducts = results.flatMap(r => r.products);

  db.prepare("UPDATE deal_goals SET last_checked = datetime('now') WHERE id = ?").run(goal.id);

  if (!allProducts.length) return;

  // Find cheapest matching product
  const cheapest = allProducts.reduce((best, p) =>
    p.current_price < best.current_price ? p : best
  );

  const isMatch = goal.max_price === null || cheapest.current_price <= goal.max_price;

  db.prepare(`
    UPDATE deal_goals
    SET best_match_id = ?, best_price = ?, status = ?
    WHERE id = ?
  `).run(
    cheapest.id ?? null,
    cheapest.current_price,
    isMatch ? 'found' : 'watching',
    goal.id
  );

  if (isMatch) {
    const msg = `🎯 Deal found! "${cheapest.name}" on ${cheapest.platform} for ₹${cheapest.current_price.toLocaleString('en-IN')}${goal.max_price ? ` (your target: ₹${goal.max_price.toLocaleString('en-IN')})` : ''}.`;

    db.prepare(`
      INSERT INTO notifications (user_id, product_id, type, message)
      VALUES (?, ?, 'deal_found', ?)
    `).run(goal.user_id, cheapest.id ?? null, msg);

    broadcast({ type: 'deal_found', goalId: goal.id, message: msg, product: cheapest });
  }
}

// ── Run all active goals (called by scheduler) ───────────────────────────────
export async function runAllGoals(): Promise<void> {
  const goals = getDb()
    .prepare("SELECT * FROM deal_goals WHERE status = 'watching'")
    .all() as DealGoal[];

  if (!goals.length) return;
  console.log(`[DealHunter] Checking ${goals.length} active goals...`);

  await Promise.allSettled(goals.map(huntGoal));
}

// ── Result for supervisor integration ────────────────────────────────────────
export async function getDealHunterResult(message: string): Promise<{
  action: string;
  goal?: DealGoal;
  goals?: DealGoal[];
  summary: string;
}> {
  // Detect if user wants to create a goal or list existing ones
  const isCreate = /alert|watch|notify|set.*goal|track|when.*drop|tell me when/i.test(message);
  const isList   = /show.*goal|list.*goal|my goal|what.*watch/i.test(message);

  if (isList) {
    const goals = listGoals();
    const summary = goals.length
      ? `You have ${goals.length} active deal goal${goals.length > 1 ? 's' : ''}:\n${goals.map(g => `• "${g.query}"${g.max_price ? ` under ₹${g.max_price.toLocaleString('en-IN')}` : ''} — ${g.status}`).join('\n')}`
      : 'No active deal goals. Tell me a product and your target price to start watching!';
    return { action: 'list', goals, summary };
  }

  if (isCreate) {
    // Extract product name and price from message using AI
    const extraction = await generateResponse(
      `Extract the product name and maximum price (if mentioned) from this message. Return JSON only.
Message: "${message}"
Format: {"query": "<product name>", "max_price": <number or null>}`,
      'You are a JSON extractor. Output only valid JSON, no markdown.'
    );

    let query = message;
    let max_price: number | undefined;

    try {
      const parsed = JSON.parse(extraction.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { query?: string; max_price?: number | null };
      if (parsed.query) query = parsed.query;
      if (parsed.max_price) max_price = parsed.max_price;
    } catch { /* use raw message */ }

    const goal = createGoal({ query, max_price });

    // Immediately hunt
    await huntGoal(goal);
    const fresh = getDb().prepare('SELECT * FROM deal_goals WHERE id = ?').get(goal.id) as DealGoal;

    const summary = fresh.status === 'found' && fresh.best_price
      ? `✅ Found a match right away! Best price for "${query}" is ₹${fresh.best_price.toLocaleString('en-IN')}. ${max_price ? (fresh.best_price <= max_price ? 'It meets your target!' : `It's above your ₹${max_price.toLocaleString('en-IN')} target — I'll keep watching.`) : ''}`
      : `👀 I'm now watching "${query}"${max_price ? ` for under ₹${max_price.toLocaleString('en-IN')}` : ''}. I'll alert you when a deal appears!`;

    return { action: 'create', goal: fresh, summary };
  }

  // Default: search for the product now
  const results = await searchAcrossPlatforms(message);
  const best = results.flatMap(r => r.products).sort((a, b) => a.current_price - b.current_price)[0];
  const summary = best
    ? `Best price found: "${best.name}" on ${best.platform} for ₹${best.current_price.toLocaleString('en-IN')}. Want me to watch this and alert you if it drops further?`
    : 'No products found. Try rephrasing your search.';

  return { action: 'search', summary };
}
