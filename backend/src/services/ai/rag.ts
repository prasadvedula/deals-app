import { getDb } from '../../database/db';
import { generateResponse, embed, cosineSimilarity, AI_PROVIDER } from './provider';
import { Product } from '../../models/types';

// ── Vector search (Ollama) ────────────────────────────────────────────────────
async function vectorSearch(query: string, limit: number): Promise<Product[]> {
  const db = getDb();
  const queryVec = await embed(query);
  if (!queryVec) return [];

  const rows = db.prepare(
    'SELECT * FROM products WHERE embedding IS NOT NULL'
  ).all() as (Product & { embedding: string })[];

  const scored = rows
    .map((row) => {
      try {
        const vec = JSON.parse(row.embedding) as number[];
        return { product: row as unknown as Product, score: cosineSimilarity(queryVec, vec) };
      } catch { return null; }
    })
    .filter(Boolean) as { product: Product; score: number }[];

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.product);
}

// ── FTS5 search (Claude / fallback) ──────────────────────────────────────────
function ftsSearch(query: string, limit: number): Product[] {
  const db = getDb();
  const safe = query.replace(/['"*()]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' OR ');
  try {
    return db.prepare(`
      SELECT p.* FROM products p
      JOIN products_fts ON products_fts.product_id = p.id
      WHERE products_fts MATCH ?
      ORDER BY bm25(products_fts)
      LIMIT ?
    `).all(safe, limit) as Product[];
  } catch { return []; }
}

function likeSearch(query: string, limit: number): Product[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM products
    WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
    ORDER BY trending_score DESC LIMIT ?
  `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as Product[];
}

// ── Main RAG function ─────────────────────────────────────────────────────────
export async function ragProductSearch(
  query: string,
  limit = 10
): Promise<{ products: Product[]; aiInsights: string }> {
  const db = getDb();

  // Retrieve
  let products: Product[] = AI_PROVIDER === 'ollama'
    ? await vectorSearch(query, limit)
    : ftsSearch(query, limit);

  if (products.length < 3) {
    const extra = ftsSearch(query, limit);
    const ids = new Set(products.map((p) => p.id));
    products.push(...extra.filter((p) => !ids.has(p.id)));
  }
  if (products.length < 3) {
    const extra = likeSearch(query, limit);
    const ids = new Set(products.map((p) => p.id));
    products.push(...extra.filter((p) => !ids.has(p.id)));
  }
  if (products.length === 0) {
    products = db.prepare('SELECT * FROM products ORDER BY trending_score DESC LIMIT ?').all(limit) as Product[];
  }

  // Augment with AI
  const aiInsights = await generateAIInsights(query, products.slice(0, 5));
  return { products: products.slice(0, limit), aiInsights };
}

async function generateAIInsights(query: string, products: Product[]): Promise<string> {
  const list = products
    .map((p) => `- ${p.name} (${p.category}): ₹${p.current_price.toLocaleString('en-IN')} (${Math.round(((p.original_price - p.current_price) / p.original_price) * 100)}% off MRP ₹${p.original_price.toLocaleString('en-IN')})`)
    .join('\n');

  const system = `You are an Indian e-commerce shopping assistant. All prices are in INR (₹). Give a concise, helpful insight (under 100 words) about the deals found. Always use ₹ symbol, never $ or USD.`;
  const prompt = `User searched: "${query}"\n\nFound on Indian platforms:\n${list}\n\nBrief insight about value and best picks in INR?`;

  try {
    return await generateResponse(prompt, system);
  } catch {
    return `Found ${products.length} products matching "${query}".`;
  }
}

// ── AI Recommendations ────────────────────────────────────────────────────────
export async function getAIRecommendations(
  _userId: string,
  favoriteProductIds: number[]
): Promise<{ products: Product[]; reasoning: string }> {
  const db = getDb();

  const favorites = favoriteProductIds.length > 0
    ? (db.prepare(`SELECT * FROM products WHERE id IN (${favoriteProductIds.join(',')})`).all() as Product[])
    : [];

  const allProducts = db.prepare('SELECT * FROM products ORDER BY trending_score DESC LIMIT 50').all() as Product[];
  const pool = allProducts.filter((p) => !favoriteProductIds.includes(p.id));
  const favCategories = [...new Set(favorites.map((p) => p.category))];

  const system = `You are an Indian e-commerce recommendation AI. All prices are in INR (₹). Return ONLY valid JSON:
{"recommended_ids": [<up to 6 product IDs>], "reasoning": "<one sentence using ₹ for prices>"}`;

  const prompt = `User favorites: ${favorites.length > 0 ? favorites.map((p) => p.name).join(', ') : 'none yet'}
Favorite categories: ${favCategories.join(', ') || 'none'}

Available Indian products (prices in INR):
${pool.slice(0, 20).map((p) => `ID:${p.id} ${p.name} (${p.category}) ₹${p.current_price.toLocaleString('en-IN')}`).join('\n')}

Recommend the top 6 most relevant products as JSON.`;

  try {
    const text = await generateResponse(prompt, system);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    const parsed = JSON.parse(match[0]) as { recommended_ids: number[]; reasoning: string };
    const recommended = parsed.recommended_ids
      .map((id) => pool.find((p) => p.id === id))
      .filter(Boolean) as Product[];
    return { products: recommended.slice(0, 6), reasoning: parsed.reasoning };
  } catch {
    const fallback = pool
      .filter((p) => favCategories.length === 0 || favCategories.includes(p.category))
      .slice(0, 6);
    return { products: fallback, reasoning: 'Showing top trending products based on your interests.' };
  }
}

// ── Index embeddings for all products (run once after seeding) ────────────────
export async function indexProductEmbeddings(): Promise<void> {
  if (AI_PROVIDER !== 'ollama') {
    console.log('[RAG] Skipping embedding index (provider=claude, using FTS5)');
    return;
  }
  const db = getDb();
  const products = db.prepare('SELECT * FROM products WHERE embedding IS NULL').all() as Product[];
  if (products.length === 0) { console.log('[RAG] All products already indexed.'); return; }

  console.log(`[RAG] Indexing embeddings for ${products.length} products...`);
  const update = db.prepare('UPDATE products SET embedding = ? WHERE id = ?');

  for (const p of products) {
    try {
      const text = `${p.name} ${p.category} ${p.description}`;
      const vec = await embed(text);
      if (vec) update.run(JSON.stringify(vec), p.id);
    } catch (e) {
      console.warn(`[RAG] Failed to embed product ${p.id}:`, e);
    }
  }
  console.log('[RAG] Embedding index complete.');
}
