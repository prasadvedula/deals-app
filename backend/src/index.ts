import './polyfill';
import 'dotenv/config';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import app from './app';
import { initWebSocket } from './services/websocket';
import { startScheduler } from './services/scheduler';
import { getDb } from './database/db';
import { AI_PROVIDER, providerInfo } from './services/ai/provider';
import { indexProductEmbeddings } from './services/ai/rag';
import { seed } from './utils/seed';
import { initTelegramBot } from './services/telegramBot';

const PORT = process.env.PORT || 3001;

/**
 * On Railway (production) with persistent volume attached:
 * if the DB has fewer than 100 products, trigger the 100k bulk import
 * in the background so the server stays available immediately.
 * --skip-history keeps the first run fast (~20s); history builds up over time.
 */
function autoImportIfEmpty(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const db  = getDb();
  const row = db.prepare('SELECT COUNT(*) as n FROM products').get() as { n: number };
  if (row.n >= 100) {
    console.log(`[Import] ${row.n.toLocaleString()} products already loaded — skipping bulk import.`);
    return;
  }

  const script = path.join(process.cwd(), 'scripts', 'import-100k.mjs');
  console.log(`[Import] Only ${row.n} products found. Starting background bulk import…`);
  console.log(`[Import] Script: ${script}`);

  const child = spawn('node', [script, '--clear', '--skip-history'], {
    cwd:   process.cwd(),
    stdio: 'inherit',
    detached: false,
  });

  child.on('error', (err) => console.error('[Import] Failed to start:', err.message));
  child.on('close', (code) => {
    if (code === 0) {
      const after = db.prepare('SELECT COUNT(*) as n FROM products').get() as { n: number };
      console.log(`[Import] ✓ Complete — ${after.n.toLocaleString()} products now available.`);
    } else {
      console.error(`[Import] ✗ Exited with code ${code}`);
    }
  });
}

async function main() {
  getDb();
  console.log(`[DB] Database initialized`);
  console.log(`[AI] Provider: ${AI_PROVIDER} —`, JSON.stringify(providerInfo()));

  // Seed 30 sample products locally; on Railway the volume keeps real data
  await seed();

  // On Railway: bulk-import 100k products in background if DB is near-empty
  autoImportIfEmpty();

  const server = http.createServer(app);
  initWebSocket(server);
  startScheduler();
  initTelegramBot();

  server.listen(PORT, async () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket on ws://localhost:${PORT}/ws`);

    if (AI_PROVIDER === 'ollama') {
      indexProductEmbeddings().catch((e) => console.warn('[RAG] Embedding index failed:', e));
    }
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
