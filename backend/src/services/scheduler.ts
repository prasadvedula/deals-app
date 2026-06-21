import cron from 'node-cron';
import { monitorAllTrendingProducts } from './agents/priceMonitor';
import { getDb } from '../database/db';

let schedulerRunning = false;

export function startScheduler(): void {
  if (schedulerRunning) return;
  schedulerRunning = true;

  // Run price monitoring every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Running price monitoring cycle...');
    try {
      await monitorAllTrendingProducts();
    } catch (err) {
      console.error('[Scheduler] Price monitoring error:', err);
    }
  });

  // Update trending scores every hour
  cron.schedule('0 * * * *', () => {
    updateTrendingScores();
  });

  console.log('[Scheduler] Price monitoring scheduler started (every 30 min)');
}

function updateTrendingScores(): void {
  const db = getDb();

  // Increase trending score for products with recent price drops
  db.prepare(`
    UPDATE products SET trending_score = MIN(100, trending_score + 5)
    WHERE id IN (
      SELECT DISTINCT product_id FROM price_history
      WHERE recorded_at > datetime('now', '-1 hour')
    )
  `).run();

  // Decay trending scores slightly over time
  db.prepare(`
    UPDATE products SET trending_score = MAX(0, trending_score - 1)
    WHERE trending_score > 0
  `).run();

  console.log('[Scheduler] Trending scores updated');
}

export function triggerManualMonitoring(): Promise<void> {
  console.log('[Scheduler] Manual price monitoring triggered');
  return monitorAllTrendingProducts();
}
