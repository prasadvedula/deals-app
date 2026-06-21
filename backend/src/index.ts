import 'dotenv/config';
import http from 'http';
import app from './app';
import { initWebSocket } from './services/websocket';
import { startScheduler } from './services/scheduler';
import { getDb } from './database/db';
import { AI_PROVIDER, providerInfo } from './services/ai/provider';
import { indexProductEmbeddings } from './services/ai/rag';

const PORT = process.env.PORT || 3001;

async function main() {
  getDb();
  console.log(`[DB] Database initialized`);
  console.log(`[AI] Provider: ${AI_PROVIDER} —`, JSON.stringify(providerInfo()));

  const server = http.createServer(app);
  initWebSocket(server);
  startScheduler();

  server.listen(PORT, async () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket on ws://localhost:${PORT}/ws`);

    // Index embeddings in background (Ollama only)
    if (AI_PROVIDER === 'ollama') {
      indexProductEmbeddings().catch((e) => console.warn('[RAG] Embedding index failed:', e));
    }
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
