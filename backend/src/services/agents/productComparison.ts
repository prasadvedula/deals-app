import { generateResponse } from '../ai/provider';
import { getDb } from '../../database/db';
import { Product } from '../../models/types';

export interface CompareProduct {
  id: number;
  name: string;
  current_price: number;
  original_price: number;
  platform: string;
  category: string;
  discount_pct: number;
  trending_score: number;
  image_url?: string;
  platform_url?: string;
}

export interface CompareResult {
  found: boolean;
  products: CompareProduct[];
  winner: string;
  verdict: 'a' | 'b' | 'tie' | 'incomplete';
  summary: string;
  scores: { a: number; b: number };
}

async function extractProductNames(query: string): Promise<string[]> {
  const prompt = `From this query: "${query}"
Extract exactly the product names being compared (usually 2).
Examples:
  "compare iPhone 15 vs Samsung S24" → ["iPhone 15", "Samsung S24"]
  "which is better boAt earbuds or Sony WH-1000XM5" → ["boAt earbuds", "Sony WH-1000XM5"]
  "iPhone 14 vs iPhone 15 which to buy" → ["iPhone 14", "iPhone 15"]
Respond with ONLY valid JSON array of strings: ["name1", "name2"]`;

  try {
    const raw = await generateResponse(prompt, 'You are a query parser. Output only a JSON array of strings.');
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as unknown[];
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, 2);
    }
  } catch { /* fall through */ }
  return [];
}

function findBestMatch(name: string): Product | undefined {
  const db = getDb();
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return undefined;
  const conditions = words.map(() => 'LOWER(name) LIKE ?').join(' OR ');
  return db.prepare(`SELECT * FROM products WHERE ${conditions} ORDER BY trending_score DESC LIMIT 1`)
    .get(...words.map(w => `%${w}%`)) as Product | undefined;
}

export async function compareProducts(query: string): Promise<CompareResult> {
  const names = await extractProductNames(query);

  const found: CompareProduct[] = [];
  for (const name of names) {
    const p = findBestMatch(name);
    if (p) {
      const discount_pct = p.original_price > p.current_price
        ? Math.round(((p.original_price - p.current_price) / p.original_price) * 100)
        : 0;
      found.push({ ...p, discount_pct });
    }
  }

  if (found.length < 2) {
    return {
      found: false,
      products: found,
      winner: '',
      verdict: 'incomplete',
      scores: { a: 0, b: 0 },
      summary: found.length === 0
        ? 'Could not find either product in the catalog. Use AI Search to add them first.'
        : `Found "${found[0].name}" but couldn't find the second product. Add it via AI Search, then compare again.`,
    };
  }

  const [a, b] = found;

  // Score = discount weight + trending weight + price advantage
  const priceAdv = a.current_price < b.current_price ? 20 : 0;
  const scoreA = Math.round(a.discount_pct * 0.4 + a.trending_score * 0.4 + priceAdv);
  const scoreB = Math.round(b.discount_pct * 0.4 + b.trending_score * 0.4 + (20 - priceAdv));

  const verdict: CompareResult['verdict'] =
    Math.abs(scoreA - scoreB) < 5 ? 'tie' : scoreA > scoreB ? 'a' : 'b';
  const winner = verdict === 'a' ? a.name : verdict === 'b' ? b.name : '';

  const prompt = `Compare these two products for an Indian shopper:
Product A: ${a.name} — ₹${a.current_price.toLocaleString('en-IN')} on ${a.platform} (${a.discount_pct}% off, popularity ${a.trending_score}/100)
Product B: ${b.name} — ₹${b.current_price.toLocaleString('en-IN')} on ${b.platform} (${b.discount_pct}% off, popularity ${b.trending_score}/100)

Write exactly 3 short sentences:
1. Which is cheaper and by how much in ₹.
2. Which has better discount and popularity.
3. Final verdict — which one to buy and the single strongest reason.
Use ₹ symbol. No bullet points.`;

  const summary = await generateResponse(prompt, 'You are a concise Indian shopping advisor. Use ₹ symbol.');

  return { found: true, products: found, winner, verdict, scores: { a: scoreA, b: scoreB }, summary };
}
