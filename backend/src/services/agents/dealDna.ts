/**
 * Deal DNA — analyses full price history to surface seasonal patterns,
 * month-by-month averages, and the best historically cheap periods.
 * Maps price dips to known Indian sale events.
 */

import { getDb } from '../../database/db';
import { generateResponse } from '../ai/provider';
import { Product } from '../../models/types';

export interface MonthlyAvg {
  month: string;      // "2024-10"
  label: string;      // "Oct 2024"
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
  saleEvents: string[];
}

export interface DealDnaResult {
  productId: number;
  productName: string;
  allTimeHigh: number;
  allTimeLow: number;
  currentPrice: number;
  avgPrice: number;
  monthlyBreakdown: MonthlyAvg[];
  bestMonths: string[];
  worstMonths: string[];
  patternInsight: string;
  savingsOpportunity: number;
  cached?: boolean;
}

// Indian sale event calendar — month (1-based) → sale names
const INDIAN_SALE_CALENDAR: Record<number, string[]> = {
  1:  ['Republic Day Sale', 'New Year Sale'],
  2:  ["Valentine's Day Sale"],
  3:  ['Holi Sale', 'End of Season Sale'],
  4:  ['Summer Sale'],
  5:  ['Mother\'s Day Sale', 'Summer Clearance'],
  6:  ['Mid-Year Sale'],
  7:  ['Prime Day', 'Monsoon Sale'],
  8:  ['Independence Day Sale', 'Onam Sale'],
  9:  ['Navratri Pre-Sale', 'Onam Sale'],
  10: ['Navratri Sale', 'Diwali Sale', 'Great Indian Festival', 'Big Billion Days'],
  11: ['Diwali Sale', 'Singles Day', 'Black Friday'],
  12: ['Christmas Sale', 'Year-End Sale', 'New Year Sale'],
};

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

export async function getDealDna(productId: number): Promise<DealDnaResult> {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product | undefined;
  if (!product) throw new Error(`Product ${productId} not found`);

  // Full price history — no date limit
  const history = db.prepare(`
    SELECT price, recorded_at FROM price_history
    WHERE product_id = ?
    ORDER BY recorded_at ASC
  `).all(productId) as { price: number; recorded_at: string }[];

  // Also include the current price as a data point
  const allPrices = [
    ...history.map(h => ({ price: h.price, recorded_at: h.recorded_at })),
    { price: product.current_price, recorded_at: new Date().toISOString() },
  ];

  if (allPrices.length < 2) {
    // Not enough history — return AI-generated DNA based on product knowledge
    return buildKnowledgeDna(product);
  }

  // Group by month
  const byMonth = new Map<string, number[]>();
  for (const p of allPrices) {
    const ym = p.recorded_at.slice(0, 7); // "2024-10"
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym)!.push(p.price);
  }

  const monthlyBreakdown: MonthlyAvg[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, prices]) => {
      const month = parseInt(ym.split('-')[1]);
      return {
        month: ym,
        label: monthLabel(ym),
        avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        dataPoints: prices.length,
        saleEvents: INDIAN_SALE_CALENDAR[month] ?? [],
      };
    });

  const allPriceValues = allPrices.map(p => p.price);
  const allTimeHigh   = Math.max(...allPriceValues);
  const allTimeLow    = Math.min(...allPriceValues);
  const avgPrice      = Math.round(allPriceValues.reduce((s, p) => s + p, 0) / allPriceValues.length);

  // Cheapest and most expensive months — need enough distinct months to avoid overlap
  const sorted = [...monthlyBreakdown].sort((a, b) => a.avgPrice - b.avgPrice);
  const n = sorted.length;
  // Only show ranges when we have ≥3 months; take at most floor(n/2) from each end
  const take = n >= 3 ? Math.min(2, Math.floor(n / 2)) : 0;
  const bestMonths  = take > 0 ? sorted.slice(0, take).map(m => m.label) : [];
  const worstSet    = new Set(bestMonths);
  const worstMonths = take > 0
    ? sorted.slice(-take).reverse().map(m => m.label).filter(l => !worstSet.has(l))
    : [];

  const savingsOpportunity = product.current_price - allTimeLow;

  // AI pattern insight
  const summaryData = monthlyBreakdown
    .map(m => `${m.label}: avg ₹${m.avgPrice.toLocaleString('en-IN')}, low ₹${m.minPrice.toLocaleString('en-IN')}${m.saleEvents.length ? ` [${m.saleEvents[0]}]` : ''}`)
    .join('\n');

  const prompt = `Product: "${product.name}" (${product.category})
Current price: ₹${product.current_price.toLocaleString('en-IN')}
All-time low: ₹${allTimeLow.toLocaleString('en-IN')}
All-time high: ₹${allTimeHigh.toLocaleString('en-IN')}

Monthly price breakdown:
${summaryData}

Write a 2-sentence insight about this product's price DNA for an Indian shopper. Mention:
1. The best time of year to buy it and why (sale events, seasonal patterns)
2. How much they could save vs current price if they wait for the right moment
Be specific, data-driven, and actionable. No generic advice.`;

  let patternInsight = '';
  try {
    patternInsight = (await generateResponse(
      prompt,
      'You are a concise price analytics expert for Indian e-commerce. Give sharp, data-backed insights in 2 sentences.'
    )).trim();
  } catch {
    patternInsight = bestMonths.length
      ? `${product.name} typically hits its lowest price in ${bestMonths.join(' and ')}. The current price is ₹${(product.current_price - allTimeLow).toLocaleString('en-IN')} above the all-time low — waiting for a major sale could unlock significant savings.`
      : 'Not enough price history to detect patterns yet.';
  }

  return {
    productId,
    productName: product.name,
    allTimeHigh,
    allTimeLow,
    currentPrice: product.current_price,
    avgPrice,
    monthlyBreakdown,
    bestMonths,
    worstMonths,
    patternInsight,
    savingsOpportunity: Math.max(0, savingsOpportunity),
  };
}

async function buildKnowledgeDna(product: Product): Promise<DealDnaResult> {
  const prompt = `Product: "${product.name}" (${product.category}, price ₹${product.current_price.toLocaleString('en-IN')})

Based on your knowledge of this product type in the Indian market, write a 2-sentence insight:
1. Which months/sales events (Republic Day, Holi, Diwali, Great Indian Festival, Big Billion Days, etc.) typically have the best deals on this category
2. What percentage discount shoppers typically see and whether current price looks good

Be specific and actionable.`;

  let patternInsight = '';
  try {
    patternInsight = (await generateResponse(
      prompt,
      'You are a concise price analytics expert for Indian e-commerce. Give sharp, data-backed insights in 2 sentences.'
    )).trim();
  } catch {
    patternInsight = 'Not enough price history yet. Check back after a few weeks of tracking.';
  }

  return {
    productId: product.id,
    productName: product.name,
    allTimeHigh: product.original_price,
    allTimeLow: product.current_price,
    currentPrice: product.current_price,
    avgPrice: product.current_price,
    monthlyBreakdown: [],
    bestMonths: [],
    worstMonths: [],
    patternInsight,
    savingsOpportunity: 0,
  };
}
