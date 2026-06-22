/**
 * Coupon Stack Advisor
 *
 * Given a product + platform + price, generates a complete coupon stacking
 * strategy: bank card cashback, platform coupons, wallet offers, EMI no-cost.
 * Fully AI-knowledge-based — no scraping required.
 */

import { generateResponse } from '../ai/provider';

export interface CouponOffer {
  type: 'bank_card' | 'platform_coupon' | 'wallet' | 'emi' | 'exchange' | 'referral';
  provider: string;
  discount: string;
  condition: string;
  stackable: boolean;
  estimatedSaving: number;
}

export interface CouponStackResult {
  productName: string;
  platform: string;
  originalPrice: number;
  offers: CouponOffer[];
  bestStack: CouponOffer[];
  totalPotentialSaving: number;
  effectivePrice: number;
  stackingTip: string;
}

const OFFER_TYPE_LABELS: Record<CouponOffer['type'], string> = {
  bank_card:       'Bank Card',
  platform_coupon: 'Platform Coupon',
  wallet:          'Wallet Cashback',
  emi:             'No-Cost EMI',
  exchange:        'Exchange Offer',
  referral:        'Referral Bonus',
};
export { OFFER_TYPE_LABELS };

export async function getCouponStack(
  productId: number,
  productName: string,
  platform: string,
  currentPrice: number,
): Promise<CouponStackResult> {

  const prompt = `You are an expert at stacking deals on Indian e-commerce platforms.

Product: "${productName}"
Platform: ${platform}
Current Price: ₹${currentPrice.toLocaleString('en-IN')}

Generate a realistic coupon/offer stacking strategy. Include:
1. Bank card offers (HDFC, ICICI, SBI, Axis, Kotak, IDFC — typically 5-10% cashback or flat ₹ off)
2. Platform-specific coupon codes or offers on ${platform}
3. Wallet cashback (Paytm, PhonePe, Google Pay, Amazon Pay — typically 2-5%)
4. No-cost EMI options if product > ₹5000
5. Exchange offers if applicable (electronics/appliances)
6. Referral/first-order coupons

For each offer include:
- type: one of [bank_card, platform_coupon, wallet, emi, exchange, referral]
- provider: e.g. "HDFC Bank Credit Card", "Paytm", "${platform} Coupon"
- discount: e.g. "10% off up to ₹1500" or "₹200 cashback"
- condition: e.g. "Minimum order ₹2000, max 1 per user"
- stackable: true/false (whether it can stack with other offers)
- estimatedSaving: realistic INR saving for this product's price

Also determine the best 2-3 stackable offers together.

Respond ONLY with valid JSON:
{
  "offers": [...],
  "bestStack": [array of best stackable offer objects],
  "stackingTip": "one practical sentence on how to stack these"
}`;

  try {
    const raw = await generateResponse(
      prompt,
      'You are a deal-stacking expert for Indian e-commerce. Output only valid JSON. Be realistic with savings amounts.'
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const parsed = JSON.parse(match[0]) as {
      offers?: unknown[];
      bestStack?: unknown[];
      stackingTip?: string;
    };

    const offers = (Array.isArray(parsed.offers) ? parsed.offers : []) as CouponOffer[];
    const bestStack = (Array.isArray(parsed.bestStack) ? parsed.bestStack : offers.filter(o => o.stackable).slice(0, 3)) as CouponOffer[];
    const totalPotentialSaving = bestStack.reduce((s, o) => s + (Number(o.estimatedSaving) || 0), 0);

    return {
      productName,
      platform,
      originalPrice: currentPrice,
      offers,
      bestStack,
      totalPotentialSaving,
      effectivePrice: Math.max(0, currentPrice - totalPotentialSaving),
      stackingTip: parsed.stackingTip ?? 'Stack bank card cashback with platform coupons for maximum savings.',
    };
  } catch (err) {
    console.error('[CouponAdvisor] error:', err);
    // Fallback generic response
    const genericOffers: CouponOffer[] = [
      {
        type: 'bank_card', provider: 'HDFC Bank Credit Card',
        discount: '10% off up to ₹1500', condition: 'Min. order ₹5000',
        stackable: true, estimatedSaving: Math.min(1500, Math.round(currentPrice * 0.10)),
      },
      {
        type: 'wallet', provider: 'Paytm',
        discount: '3% cashback', condition: 'Pay via Paytm wallet',
        stackable: true, estimatedSaving: Math.round(currentPrice * 0.03),
      },
      {
        type: 'platform_coupon', provider: platform,
        discount: '₹100–₹300 off', condition: 'Check platform offers page',
        stackable: false, estimatedSaving: 200,
      },
    ];
    const saving = genericOffers[0].estimatedSaving + genericOffers[1].estimatedSaving;
    return {
      productName, platform, originalPrice: currentPrice,
      offers: genericOffers,
      bestStack: [genericOffers[0], genericOffers[1]],
      totalPotentialSaving: saving,
      effectivePrice: currentPrice - saving,
      stackingTip: 'Pay with HDFC Credit Card via Paytm for a double-dip: bank cashback + wallet cashback.',
    };
  }
}
