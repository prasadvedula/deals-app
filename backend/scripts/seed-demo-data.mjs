#!/usr/bin/env node
/**
 * Seed demo data for user prasadvedula@gmail.com
 *
 * Creates:
 *  - User account (password: Deals@123)
 *  - 6 deal goals (product price targets)
 *  - 8 notifications (price drops, deal alerts, weekly summary)
 *  - 6 favorites with price alert thresholds
 *  - 5 agent tasks showing AI activity history
 *  - 1 weekly report with AI summary
 *  - Cross-platform prices for favorited products
 *
 * Safe to run multiple times — skips if user already exists.
 */

import Database from 'better-sqlite3';
import bcrypt    from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.resolve(__dirname, '../data/deals.db');

const PLAIN_PASSWORD = 'Deals@123';
const PASSWORD_HASH  = await bcrypt.hash(PLAIN_PASSWORD, 10);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 1. Upsert user ────────────────────────────────────────────────────────────
const EMAIL = 'prasadvedula@gmail.com';
let user = db.prepare('SELECT * FROM users WHERE email = ?').get(EMAIL);

if (user) {
  // Update password so "Deals@123" always works regardless of what was set before
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(PASSWORD_HASH, user.id);
  console.log(`[Seed] User ${EMAIL} already exists (id=${user.id}) — password reset, refreshing demo data.`);
} else {
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, avatar_initials)
    VALUES ('Prasad Vedula', ?, ?, 'PV')
  `).run(EMAIL, PASSWORD_HASH);
  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  console.log(`[Seed] ✓ Created user ${EMAIL} (id=${user.id})`);
}

const UID = `user_${user.id}`;   // e.g. "user_1"
console.log(`[Seed] Using user_id: ${UID}`);

// ── 2. Fetch real products from DB for realistic data ─────────────────────────
function pickProduct(category) {
  return db.prepare(
    'SELECT * FROM products WHERE category = ? ORDER BY trending_score DESC LIMIT 1'
  ).get(category);
}

const smartphones   = pickProduct('Smartphones');
const laptops       = pickProduct('Laptops');
const earbuds       = pickProduct('Audio & Earbuds');
const smartwatches  = pickProduct('Smart Watches');
const televisions   = pickProduct('Televisions');
const footwear      = pickProduct('Footwear');
const books         = pickProduct('Books');
const beauty        = pickProduct('Beauty & Skincare');
const sports        = pickProduct('Sports & Fitness');
const menClothing   = pickProduct("Men's Clothing");

// ── 3. Deal Goals (price targets / watchlist) ─────────────────────────────────
db.prepare("DELETE FROM deal_goals WHERE user_id = ?").run(UID);

const goals = [
  {
    query:     'Samsung Galaxy S24 Ultra 256GB',
    max_price: 99999,
    platforms: ['Amazon India', 'Flipkart'],
    status:    'watching',
    notes:     'Need 5G, prefer Titanium Black. Waiting for festive sale.',
  },
  {
    query:     'Apple MacBook Air M3 16GB',
    max_price: 119999,
    platforms: ['Amazon India'],
    status:    'watching',
    notes:     'For work — any colour. Will buy if drops ₹10k from MRP.',
  },
  {
    query:     `${earbuds?.name ?? 'boAt Airdopes 141'} wireless earbuds`,
    max_price: 1499,
    platforms: ['Flipkart', 'Amazon India', 'Meesho'],
    status:    'found',
    best_match_id: earbuds?.id ?? null,
    best_price:    earbuds?.current_price ?? 1199,
    notes:     'Found below target! Ready to purchase.',
  },
  {
    query:     'Nike Air Max 270 running shoes size 9',
    max_price: 7999,
    platforms: ['Myntra', 'Amazon India'],
    status:    'watching',
    notes:     'Need size 9 UK. Black or white.',
  },
  {
    query:     '55 inch 4K OLED Smart TV LG Sony',
    max_price: 59999,
    platforms: ['Flipkart', 'Amazon India'],
    status:    'watching',
    notes:     'Living room upgrade. OLED preferred.',
  },
  {
    query:     'Whey protein isolate 5kg chocolate',
    max_price: 3999,
    platforms: ['Amazon India', 'Flipkart'],
    status:    'watching',
    notes:     'MuscleBlaze or Optimum Nutrition preferred.',
  },
];

const insertGoal = db.prepare(`
  INSERT INTO deal_goals
    (user_id, query, max_price, target_platforms, status, best_match_id, best_price, notes, last_checked)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || (abs(random()) % 25 + 1) || ' minutes'))
`);

for (const g of goals) {
  insertGoal.run(
    UID, g.query, g.max_price,
    JSON.stringify(g.platforms),
    g.status,
    g.best_match_id ?? null,
    g.best_price    ?? null,
    g.notes,
  );
}
console.log(`[Seed] ✓ Created ${goals.length} deal goals`);

// ── 4. Favorites ──────────────────────────────────────────────────────────────
db.prepare("DELETE FROM favorites WHERE user_id = ?").run(UID);

const favProducts = [smartphones, laptops, earbuds, smartwatches, televisions, footwear].filter(Boolean);
const insertFav   = db.prepare(`
  INSERT OR IGNORE INTO favorites (user_id, product_id, price_alert_threshold)
  VALUES (?, ?, ?)
`);
const alertThresholds = [0.10, 0.15, 0.08, 0.12, 0.20, 0.15];
favProducts.forEach((p, i) => insertFav.run(UID, p.id, alertThresholds[i]));
console.log(`[Seed] ✓ Added ${favProducts.length} favorites`);

// ── 5. Cross-platform prices for favorite products ────────────────────────────
const insertCross = db.prepare(`
  INSERT OR REPLACE INTO cross_platform_prices (product_id, platform, price, url, last_checked)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

const PLATFORMS = ['Flipkart', 'Amazon India', 'Meesho', 'Snapdeal'];
for (const prod of favProducts) {
  const base = prod.current_price;
  const variances = [0, 0.05, -0.08, 0.12];
  PLATFORMS.forEach((plat, i) => {
    const price = Math.round(base * (1 + variances[i]));
    const slug  = encodeURIComponent(prod.name);
    const urlMap = {
      'Flipkart':    `https://www.flipkart.com/search?q=${slug}`,
      'Amazon India':`https://www.amazon.in/s?k=${slug}`,
      'Meesho':      `https://meesho.com/search?q=${slug}`,
      'Snapdeal':    `https://www.snapdeal.com/search?keyword=${slug}`,
    };
    insertCross.run(prod.id, plat, price, urlMap[plat]);
  });
}
console.log(`[Seed] ✓ Added cross-platform prices for ${favProducts.length} products`);

// ── 6. Notifications ──────────────────────────────────────────────────────────
db.prepare("DELETE FROM notifications WHERE user_id = ?").run(UID);

const insertNotif = db.prepare(`
  INSERT INTO notifications (user_id, product_id, type, message, read, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', ? || ' hours'))
`);

const notifications = [
  // Unread — recent
  {
    product: smartphones, type: 'price_drop', read: 0, hoursAgo: -0.5,
    msg: (p) =>
      `🔥 Price Drop! ${p.name} fell to ₹${p.current_price.toLocaleString('en-IN')} ` +
      `(${Math.round((1 - p.current_price/p.original_price)*100)}% off) on Amazon India. ` +
      `Your alert threshold was 10%. Act fast — only 3 left!`,
  },
  {
    product: earbuds, type: 'deal_found', read: 0, hoursAgo: -1,
    msg: (p) =>
      `🎯 Deal Found! Your goal "${p.name}" matched at ₹${p.current_price.toLocaleString('en-IN')} ` +
      `on Flipkart — below your ₹1,499 target. Click to view deal.`,
  },
  {
    product: laptops, type: 'price_drop', read: 0, hoursAgo: -2,
    msg: (p) =>
      `💻 Laptop Alert! ${p.name} dropped by ₹${(p.original_price - p.current_price).toLocaleString('en-IN')} ` +
      `to ₹${p.current_price.toLocaleString('en-IN')} on Flipkart. ` +
      `It's ₹4,000 cheaper than Amazon India right now.`,
  },
  {
    product: televisions, type: 'price_drop', read: 0, hoursAgo: -3,
    msg: (p) =>
      `📺 TV Deal! ${p.name} is ₹${p.current_price.toLocaleString('en-IN')} on Meesho — ` +
      `₹${(p.original_price - p.current_price).toLocaleString('en-IN')} off. ` +
      `Trend score: 94/100. Historically low price this month.`,
  },
  // Read — older
  {
    product: null, type: 'weekly_report', read: 1, hoursAgo: -24,
    msg: () =>
      `📊 Weekly Report Ready! This week: 847 price drops across 100,002 products. ` +
      `Top category: Smartphones (312 drops). Best deal: 68% off on Sony WH-1000XM5. ` +
      `Your 6 saved products saved ₹12,340 vs. original prices.`,
  },
  {
    product: smartwatches, type: 'price_drop', read: 1, hoursAgo: -30,
    msg: (p) =>
      `⌚ Smartwatch Alert! ${p.name} dropped to ₹${p.current_price.toLocaleString('en-IN')} ` +
      `(12% off original ₹${p.original_price.toLocaleString('en-IN')}). ` +
      `AMOLED display + GPS. Limited stock.`,
  },
  {
    product: footwear, type: 'bargain_alert', read: 1, hoursAgo: -48,
    msg: (p) =>
      `👟 Bargain Finder Result! Best time to buy ${p.name}: ` +
      `Apply coupon MYNTRA20 + bank offer → effective price ₹${Math.round(p.current_price * 0.78).toLocaleString('en-IN')} ` +
      `(total 22% savings). Sale ends in 18 hours.`,
  },
  {
    product: books, type: 'comparison_result', read: 1, hoursAgo: -72,
    msg: (p) =>
      `📚 AI Comparison Done! ${p.name} vs. competitor: Our pick wins on price ` +
      `(₹${p.current_price.toLocaleString('en-IN')} vs ₹${(p.current_price + 200).toLocaleString('en-IN')}) ` +
      `and review score (4.7 vs 4.2 stars). Recommend buying this week before restock.`,
  },
];

for (const n of notifications) {
  insertNotif.run(
    UID,
    n.product?.id ?? null,
    n.type,
    n.msg(n.product),
    n.read,
    String(n.hoursAgo),
  );
}
console.log(`[Seed] ✓ Created ${notifications.length} notifications (${notifications.filter(n=>!n.read).length} unread)`);

// ── 7. Agent Tasks ────────────────────────────────────────────────────────────
db.prepare("DELETE FROM agent_tasks WHERE type != 'price_monitor' OR status = 'pending'").run();

const insertTask = db.prepare(`
  INSERT INTO agent_tasks (type, status, payload, result, created_at, completed_at)
  VALUES (?, ?, ?, ?, datetime('now', ? || ' minutes'), datetime('now', ? || ' minutes'))
`);

const tasks = [
  {
    type: 'price_monitor', status: 'completed',
    payload: JSON.stringify({ product_count: 6, provider: 'groq' }),
    result:  JSON.stringify({ updated: 6, drops: 2, platforms_checked: 24 }),
    startOffset: '-32', endOffset: '-30',
  },
  {
    type: 'deal_hunt', status: 'completed',
    payload: JSON.stringify({ goal_id: 3, query: 'boAt Airdopes wireless earbuds', max_price: 1499 }),
    result:  JSON.stringify({
      found: true, product_id: earbuds?.id,
      price: earbuds?.current_price, platform: 'Flipkart',
      message: `Found "${earbuds?.name}" at ₹${earbuds?.current_price} — below ₹1,499 target!`,
    }),
    startOffset: '-63', endOffset: '-61',
  },
  {
    type: 'review_aggregation', status: 'completed',
    payload: JSON.stringify({ product_id: smartphones?.id }),
    result:  JSON.stringify({
      platform_count: 4,
      avg_rating: 4.3,
      trust_score: 87,
      pros: ['Excellent camera', 'Long battery life', 'Fast charging'],
      cons: ['Gets warm under load', 'No headphone jack'],
      summary: 'Strong mid-range performer with best-in-class camera for the price.',
    }),
    startOffset: '-125', endOffset: '-122',
  },
  {
    type: 'weekly_report', status: 'completed',
    payload: JSON.stringify({ week_start: getLastMonday() }),
    result:  JSON.stringify({ products: 100002, price_drops: 847, ai_summary_length: 412 }),
    startOffset: '-1440', endOffset: '-1436',
  },
  {
    type: 'deal_hunt', status: 'running',
    payload: JSON.stringify({ goal_id: 1, query: 'Samsung Galaxy S24 Ultra 256GB', max_price: 99999 }),
    result:  null,
    startOffset: '-3', endOffset: '-3',
  },
];

for (const t of tasks) {
  db.prepare(`
    INSERT INTO agent_tasks (type, status, payload, result, created_at, completed_at)
    VALUES (?, ?, ?, ?, datetime('now', '${t.startOffset} minutes'),
            ${t.status === 'running' ? 'NULL' : `datetime('now', '${t.endOffset} minutes')`})
  `).run(t.type, t.status, t.payload, t.result);
}
console.log(`[Seed] ✓ Created ${tasks.length} agent tasks`);

// ── 8. Weekly Report ──────────────────────────────────────────────────────────
const weekStart = getLastMonday();
const existing  = db.prepare('SELECT id FROM weekly_reports WHERE week_start = ?').get(weekStart);
if (!existing) {
  const topDeals = [smartphones, laptops, televisions, earbuds, smartwatches]
    .filter(Boolean)
    .map(p => ({
      id: p.id, name: p.name, category: p.category,
      current_price: p.current_price, original_price: p.original_price,
      discount_pct: Math.round((1 - p.current_price / p.original_price) * 100),
    }));

  const categoryInsights = [
    { category: 'Smartphones',    drops: 312, avg_drop_pct: 14, best_deal: 'Samsung Galaxy S24 — ₹12,000 off' },
    { category: 'Laptops',        drops: 189, avg_drop_pct: 11, best_deal: 'HP Pavilion — ₹8,500 off' },
    { category: 'Audio & Earbuds',drops: 98,  avg_drop_pct: 22, best_deal: 'Sony WH-1000XM5 — 68% off' },
    { category: 'Smart Watches',  drops: 67,  avg_drop_pct: 18, best_deal: 'Apple Watch SE — ₹3,000 off' },
    { category: 'Footwear',       drops: 143, avg_drop_pct: 25, best_deal: 'Nike Air Max — ₹2,800 off' },
  ];

  db.prepare(`
    INSERT INTO weekly_reports
      (week_start, total_products, price_drops, new_products, top_deals, category_insights, ai_summary, generated_at)
    VALUES (?, 100002, 847, 234, ?, ?, ?, datetime('now', '-23 hours'))
  `).run(
    weekStart,
    JSON.stringify(topDeals),
    JSON.stringify(categoryInsights),
    `This week saw 847 price drops across 100,002 products — a 23% increase over last week. ` +
    `Smartphones led with 312 drops, driven by festive season preparation. ` +
    `The standout deal was Sony WH-1000XM5 at 68% off on Flipkart (₹8,999 vs MRP ₹29,990). ` +
    `Your 6 saved products collectively saved ₹12,340 vs. original prices. ` +
    `Recommended action: Samsung Galaxy S24 Ultra historically drops 18% in the next 2 weeks — ` +
    `hold off purchase until this weekend's flash sale.`,
  );
  console.log(`[Seed] ✓ Created weekly report for ${weekStart}`);
} else {
  console.log(`[Seed] Weekly report for ${weekStart} already exists — skipped`);
}

// ── Done ──────────────────────────────────────────────────────────────────────
const stats = {
  user:          db.prepare('SELECT COUNT(*) as n FROM users WHERE email = ?').get(EMAIL).n,
  goals:         db.prepare('SELECT COUNT(*) as n FROM deal_goals WHERE user_id = ?').get(UID).n,
  favorites:     db.prepare('SELECT COUNT(*) as n FROM favorites WHERE user_id = ?').get(UID).n,
  notifications: db.prepare('SELECT COUNT(*) as n FROM notifications WHERE user_id = ?').get(UID).n,
  unread:        db.prepare("SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND read = 0").get(UID).n,
  agent_tasks:   db.prepare('SELECT COUNT(*) as n FROM agent_tasks').get().n,
  weekly_reports:db.prepare('SELECT COUNT(*) as n FROM weekly_reports').get().n,
};

console.log('\n╔═══════════════════════════════════════╗');
console.log('║   Demo Data Seed — Complete            ║');
console.log('╚═══════════════════════════════════════╝');
console.log(`  User           : ${EMAIL}`);
console.log(`  Password       : Deals@123`);
console.log(`  User ID        : ${UID}`);
console.log(`  Deal Goals     : ${stats.goals} (targets/watchlist)`);
console.log(`  Favorites      : ${stats.favorites} products saved`);
console.log(`  Notifications  : ${stats.notifications} total, ${stats.unread} unread`);
console.log(`  Agent Tasks    : ${stats.agent_tasks} total`);
console.log(`  Weekly Reports : ${stats.weekly_reports}`);
console.log('');
console.log('  Login at /login with above credentials.');
console.log('  Unread notifications appear in the bell icon.');
console.log('');

db.close();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLastMonday() {
  const d   = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
