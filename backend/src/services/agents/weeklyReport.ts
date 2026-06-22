/**
 * Weekly Report Agent
 *
 * Generates a structured deal intelligence digest covering:
 *  - Top price drops in the last 7 days
 *  - Newly discovered products
 *  - Category-level insights
 *  - AI executive summary
 *
 * Called by the scheduler every Monday (or on-demand via API).
 * Results cached in weekly_reports table.
 */

import { getDb } from '../../database/db';
import { generateResponse } from '../ai/provider';

export interface TopDeal {
  id: number;
  name: string;
  platform: string;
  current_price: number;
  original_price: number;
  discount_pct: number;
  image_url: string;
}

export interface CategoryInsight {
  category: string;
  product_count: number;
  avg_price: number;
  avg_discount: number;
  top_product: string;
}

export interface WeeklyReport {
  id?: number;
  week_start: string;
  total_products: number;
  price_drops: number;
  new_products: number;
  top_deals: TopDeal[];
  category_insights: CategoryInsight[];
  ai_summary: string;
  generated_at: string;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const db = getDb();
  const weekStart = getWeekStart();

  // Total products
  const { total } = db.prepare('SELECT COUNT(*) as total FROM products').get() as { total: number };

  // New products this week
  const { new_products } = db.prepare(`
    SELECT COUNT(*) as new_products FROM products
    WHERE created_at >= datetime('now', '-7 days')
  `).get() as { new_products: number };

  // Price drops this week
  const { price_drops } = db.prepare(`
    SELECT COUNT(DISTINCT product_id) as price_drops FROM price_history
    WHERE recorded_at >= datetime('now', '-7 days')
  `).get() as { price_drops: number };

  // Top deals by discount
  const top_deals = db.prepare(`
    SELECT
      p.id, p.name, p.platform, p.current_price, p.original_price, p.image_url,
      ROUND((p.original_price - p.current_price) * 100.0 / p.original_price, 1) as discount_pct
    FROM products p
    WHERE p.original_price > p.current_price
    ORDER BY discount_pct DESC
    LIMIT 6
  `).all() as TopDeal[];

  // Category insights
  const category_insights = db.prepare(`
    SELECT
      category,
      COUNT(*) as product_count,
      ROUND(AVG(current_price), 0) as avg_price,
      ROUND(AVG((original_price - current_price) * 100.0 / original_price), 1) as avg_discount,
      (SELECT name FROM products p2 WHERE p2.category = p.category ORDER BY trending_score DESC LIMIT 1) as top_product
    FROM products p
    GROUP BY category
    ORDER BY product_count DESC
    LIMIT 6
  `).all() as CategoryInsight[];

  // AI executive summary
  const dealsText = top_deals.slice(0, 3)
    .map(d => `• ${d.name} on ${d.platform}: ₹${d.current_price} (${d.discount_pct}% off MRP ₹${d.original_price})`)
    .join('\n');

  const categoryText = category_insights
    .map(c => `• ${c.category}: ${c.product_count} products, avg ₹${c.avg_price}, avg ${c.avg_discount}% off`)
    .join('\n');

  const summaryPrompt = `Generate a concise executive summary (3-4 sentences) for a weekly deals intelligence report for an Indian e-commerce platform.

Key metrics:
- Total products tracked: ${total}
- New products added this week: ${new_products}
- Products with price changes: ${price_drops}

Top deals:
${dealsText}

Category breakdown:
${categoryText}

Write a professional but engaging summary highlighting the most significant deals and trends. Use ₹ for prices.`;

  let ai_summary = `This week DealsApp tracked ${total} products with ${new_products} new additions and ${price_drops} price changes. ${top_deals[0] ? `Top deal: ${top_deals[0].name} at ${top_deals[0].discount_pct}% off.` : ''}`;

  try {
    ai_summary = await generateResponse(summaryPrompt, 'You are a deal intelligence analyst writing for a CEO audience. Be concise and data-driven.');
  } catch { /* use default */ }

  const report: WeeklyReport = {
    week_start:         weekStart,
    total_products:     total,
    price_drops,
    new_products,
    top_deals,
    category_insights,
    ai_summary,
    generated_at:       new Date().toISOString(),
  };

  // Upsert into DB
  db.prepare(`
    INSERT OR REPLACE INTO weekly_reports
    (week_start, total_products, price_drops, new_products, top_deals, category_insights, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    weekStart, total, price_drops, new_products,
    JSON.stringify(top_deals),
    JSON.stringify(category_insights),
    ai_summary
  );

  console.log(`[WeeklyReport] Generated report for week of ${weekStart}`);
  return report;
}

export async function getLatestWeeklyReport(): Promise<WeeklyReport> {
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM weekly_reports ORDER BY generated_at DESC LIMIT 1'
  ).get() as (WeeklyReport & { top_deals: string; category_insights: string }) | undefined;

  // Return cached if generated today
  if (existing) {
    const generatedDate = existing.generated_at.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    if (generatedDate === today) {
      return {
        ...existing,
        top_deals:         JSON.parse(existing.top_deals) as TopDeal[],
        category_insights: JSON.parse(existing.category_insights) as CategoryInsight[],
      };
    }
  }

  return generateWeeklyReport();
}
