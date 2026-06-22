/**
 * Bargain Finder Agent — plug-and-play
 *
 * Combines coupon stacking + seasonal timing + buy-time prediction
 * to answer: "What is the absolute lowest I can pay for this today?"
 */

import { generateResponse } from '../ai/provider';
import { getDb } from '../../database/db';
import { getCouponStack, CouponOffer } from './couponAdvisor';
import { getBuyTimePrediction } from './buyTimePredictor';
import { getSeasonalAlerts } from './seasonalPatterns';
import { Product } from '../../models/types';

export interface BargainStep {
  label: string;
  saving: number;
  description: string;
  type: 'bank' | 'coupon' | 'wallet' | 'seasonal' | 'emi';
}

export interface BargainResult {
  found: true;
  product: {
    id: number;
    name: string;
    current_price: number;
    platform: string;
    image_url?: string;
    platform_url?: string;
  };
  currentPrice: number;
  effectivePrice: number;
  totalSaving: number;
  savingPercent: number;
  steps: BargainStep[];
  summary: string;
  urgency: 'buy_now' | 'wait' | 'act_fast';
  timingAdvice: string;
}

export interface BargainNotFound {
  found: false;
  message: string;
}

function findProduct(query: string): Product | undefined {
  const db = getDb();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return undefined;
  const conditions = words.map(() => 'LOWER(name) LIKE ?').join(' OR ');
  return db.prepare(
    `SELECT * FROM products WHERE ${conditions} ORDER BY trending_score DESC LIMIT 1`
  ).get(...words.map(w => `%${w}%`)) as Product | undefined;
}

function offerTypeToStep(type: CouponOffer['type']): BargainStep['type'] {
  if (type === 'bank_card') return 'bank';
  if (type === 'wallet')    return 'wallet';
  if (type === 'emi')       return 'emi';
  return 'coupon';
}

export async function findBestBargain(query: string): Promise<BargainResult | BargainNotFound> {
  const product = findProduct(query);
  if (!product) {
    return {
      found: false,
      message: 'Could not find that product in the catalog. Use AI Search to add it first, then ask for the best bargain.',
    };
  }

  // Run all three sources in parallel
  const [couponData, prediction, seasonal] = await Promise.all([
    getCouponStack(product.id, product.name, product.platform, product.current_price),
    getBuyTimePrediction(product.id),
    getSeasonalAlerts(product.id, product.category),
  ]);

  const steps: BargainStep[] = [];
  let totalSaving = 0;

  // Coupon savings (top 3 by estimated saving)
  const sortedOffers = [...couponData.offers]
    .filter(o => o.estimatedSaving > 0)
    .sort((a, b) => b.estimatedSaving - a.estimatedSaving)
    .slice(0, 3);

  for (const offer of sortedOffers) {
    steps.push({
      label: offer.provider,
      saving: offer.estimatedSaving,
      description: offer.discount,
      type: offerTypeToStep(offer.type),
    });
    totalSaving += offer.estimatedSaving;
  }

  // Seasonal: add active sale's expected extra saving
  if (seasonal.currentlyInSale) {
    const sale = seasonal.currentlyInSale;
    const saleSaving = Math.round(product.current_price * sale.expectedDiscountPct / 100);
    if (saleSaving > 0) {
      steps.push({
        label: `${sale.name} (LIVE NOW)`,
        saving: saleSaving,
        description: `${sale.expectedDiscountPct}% extra off during active sale on ${sale.platform}`,
        type: 'seasonal',
      });
      totalSaving += saleSaving;
    }
  }

  const effectivePrice = Math.max(product.current_price * 0.5, product.current_price - totalSaving);
  const savingPercent  = Math.round((totalSaving / product.current_price) * 100);

  const urgency: BargainResult['urgency'] =
    prediction.recommendation === 'buy_now' || prediction.recommendation === 'at_lowest' ? 'buy_now' :
    prediction.recommendation === 'wait' ? 'wait' : 'act_fast';

  const timingAdvice = prediction.recommendationText;

  const prompt = `Product: ${product.name} (₹${product.current_price.toLocaleString('en-IN')} on ${product.platform})

Available deal stack:
${steps.map(s => `- ${s.label}: save ₹${s.saving.toLocaleString('en-IN')} via ${s.description}`).join('\n') || '- No stackable offers found'}
Effective price after stacking: ₹${Math.round(effectivePrice).toLocaleString('en-IN')} (saving ₹${totalSaving.toLocaleString('en-IN')})

Buy timing: ${timingAdvice}

Write 2 crisp sentences for an Indian shopper:
Sentence 1: How to stack these offers to hit ₹${Math.round(effectivePrice).toLocaleString('en-IN')}.
Sentence 2: Whether to buy today or wait, and why.
Use ₹ symbol. No bullet points.`;

  const summary = await generateResponse(prompt, 'You are a sharp Indian deals advisor. Use ₹ symbol.');

  return {
    found: true,
    product: {
      id: product.id,
      name: product.name,
      current_price: product.current_price,
      platform: product.platform,
      image_url: product.image_url,
      platform_url: product.platform_url,
    },
    currentPrice: product.current_price,
    effectivePrice: Math.round(effectivePrice),
    totalSaving,
    savingPercent,
    steps,
    summary,
    urgency,
    timingAdvice,
  };
}
