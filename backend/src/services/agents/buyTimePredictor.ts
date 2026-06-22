/**
 * Buy-Time Predictor Agent
 *
 * Analyses 30-day price history for a product and uses AI to determine:
 *  - Price trend (rising / falling / stable / volatile)
 *  - Optimal buy recommendation (buy now / wait / already at low)
 *  - Predicted price movement in next 7 days
 *  - Confidence score
 */

import { getDb } from '../../database/db';
import { generateResponse } from '../ai/provider';

export interface PricePrediction {
  productId: number;
  currentPrice: number;
  lowestIn30d: number;
  highestIn30d: number;
  avgIn30d: number;
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
  recommendation: 'buy_now' | 'wait' | 'at_lowest' | 'uncertain';
  recommendationText: string;
  predictedNextWeek: number | null;
  savingsIfWait: number | null;
  confidence: 'high' | 'medium' | 'low';
  analysis: string;
}

interface PricePoint { price: number; recorded_at: string; }

function computeTrend(points: PricePoint[]): 'rising' | 'falling' | 'stable' | 'volatile' {
  if (points.length < 3) return 'stable';

  const half = Math.floor(points.length / 2);
  const firstHalf  = points.slice(0, half);
  const secondHalf = points.slice(half);

  const avg = (arr: PricePoint[]) => arr.reduce((s, p) => s + p.price, 0) / arr.length;
  const f = avg(firstHalf);
  const s = avg(secondHalf);

  const prices = points.map(p => p.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const volatility = (maxP - minP) / avg(points);

  if (volatility > 0.25) return 'volatile';
  if (s > f * 1.05)      return 'rising';
  if (s < f * 0.95)      return 'falling';
  return 'stable';
}

export async function getBuyTimePrediction(productId: number): Promise<PricePrediction> {
  const db = getDb();

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
    { id: number; name: string; current_price: number; original_price: number; platform: string } | undefined;
  if (!product) throw new Error('Product not found');

  const history = db.prepare(`
    SELECT price, recorded_at FROM price_history
    WHERE product_id = ?
    ORDER BY recorded_at ASC
  `).all(productId) as PricePoint[];

  const prices = history.map(h => h.price);
  const currentPrice  = product.current_price;
  const lowestIn30d   = prices.length ? Math.min(...prices) : currentPrice;
  const highestIn30d  = prices.length ? Math.max(...prices) : currentPrice;
  const avgIn30d      = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : currentPrice;
  const trend         = computeTrend(history);

  // Build price timeline for AI
  const recent = history.slice(-14); // last 14 data points
  const timeline = recent.map(p =>
    `${p.recorded_at.split(' ')[0]}: ₹${p.price}`
  ).join('\n');

  const prompt = `You are a price analyst for an Indian e-commerce app.

Product: ${product.name}
Current price: ₹${currentPrice}
30-day low: ₹${lowestIn30d}
30-day high: ₹${highestIn30d}
30-day average: ₹${Math.round(avgIn30d)}
MRP: ₹${product.original_price}
Trend: ${trend}

Recent price history (last 14 days):
${timeline || '(insufficient history)'}

Based on this data, provide:
1. recommendation: one of "buy_now", "wait", "at_lowest", "uncertain"
2. recommendationText: 1–2 sentence explanation with ₹ amounts
3. predictedNextWeek: estimated price in 7 days as a number (or null if uncertain)
4. savingsIfWait: estimated ₹ savings if user waits (null if recommendation is buy_now/uncertain)
5. confidence: "high", "medium", or "low"
6. analysis: 2–3 sentences of detailed price analysis

Rules:
- Use ₹ for all prices
- If price is already near 30-day low: recommend "at_lowest"
- If trend is falling and price is above 30-day avg: recommend "wait"
- If trend is rising or price near 30-day low: recommend "buy_now"
- If volatile or insufficient data: "uncertain"

Respond ONLY with JSON:
{"recommendation":"buy_now","recommendationText":"...","predictedNextWeek":1199,"savingsIfWait":null,"confidence":"high","analysis":"..."}`;

  let aiResult = {
    recommendation: 'uncertain' as PricePrediction['recommendation'],
    recommendationText: 'Insufficient data to make a confident recommendation.',
    predictedNextWeek: null as number | null,
    savingsIfWait: null as number | null,
    confidence: 'low' as PricePrediction['confidence'],
    analysis: `Current price of ₹${currentPrice} is ${currentPrice <= lowestIn30d ? 'at' : 'above'} the 30-day low of ₹${lowestIn30d}.`,
  };

  try {
    const raw = await generateResponse(prompt, 'You are a price prediction engine. Output only valid JSON.');
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Partial<typeof aiResult>;
      aiResult = { ...aiResult, ...parsed };
    }
  } catch { /* use defaults */ }

  return {
    productId,
    currentPrice,
    lowestIn30d,
    highestIn30d,
    avgIn30d: Math.round(avgIn30d),
    trend,
    recommendation:     aiResult.recommendation,
    recommendationText: aiResult.recommendationText,
    predictedNextWeek:  aiResult.predictedNextWeek,
    savingsIfWait:      aiResult.savingsIfWait,
    confidence:         aiResult.confidence,
    analysis:           aiResult.analysis,
  };
}
