/**
 * Review Aggregator Agent
 *
 * Uses AI knowledge-based synthesis to generate accurate pros/cons/trust scores
 * for any product. Optionally enriches with scraped page text when accessible.
 * Results are cached in product_reviews for 24h.
 */

import { getDb } from '../../database/db';
import { generateResponse } from '../ai/provider';
import { Product } from '../../models/types';

export interface ReviewSummary {
  product_id: number;
  platform: string;
  rating: number | null;
  review_count: number;
  pros: string[];
  cons: string[];
  summary: string;
  trust_score: number;
  fetched_at: string;
  source?: 'ai_knowledge' | 'scraped';
}

export interface AggregatedReview {
  overallTrustScore: number;
  verdict: string;
  platforms: ReviewSummary[];
  recommendation: string;
}

// ── Try to fetch page text (best-effort; many sites block bots) ───────────────
async function tryFetchSnippet(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Only useful if we got meaningful content (not just a bot-check page)
    if (text.length < 200) return '';
    return text.slice(0, 3000);
  } catch {
    return '';
  }
}

// ── Core AI synthesis — knowledge-based with optional page context ─────────────
async function synthesiseReview(
  productName: string,
  category: string,
  platform: string,
  pageText: string,
): Promise<{ pros: string[]; cons: string[]; summary: string; trust_score: number; rating: number | null; review_count: number; source: 'ai_knowledge' | 'scraped' }> {

  const hasPageContent = pageText.length > 200;
  const source: 'ai_knowledge' | 'scraped' = hasPageContent ? 'scraped' : 'ai_knowledge';

  const contextBlock = hasPageContent
    ? `Page content from ${platform}:\n"""\n${pageText}\n"""\n\nUse the above page content to inform your analysis.`
    : `No live page content available. Use your training knowledge about this product and similar products in the "${category}" category to provide an informed analysis.`;

  const prompt = `You are a senior product review analyst specialising in Indian e-commerce.

Product: "${productName}"
Category: ${category}
Platform: ${platform}

${contextBlock}

Provide a balanced, specific analysis:
1. Top 3 genuine pros (specific to this product/brand, not generic)
2. Top 3 real cons or known complaints (specific issues, not "price may vary")
3. One-sentence customer sentiment summary
4. Trust score 0–10 (based on brand reputation, category standing, typical review patterns on ${platform})
5. Typical rating out of 5 on this platform (use null if unknown)
6. Approximate review count (use 0 if unknown)

Respond ONLY with valid JSON — no markdown, no extra text:
{"pros":["...","...","..."],"cons":["...","...","..."],"summary":"...","trust_score":7.5,"rating":4.2,"review_count":1250}`;

  try {
    const raw = await generateResponse(prompt, 'You are a product review analyst. Output only valid JSON without any markdown formatting.');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const parsed = JSON.parse(match[0]) as {
      pros?: unknown; cons?: unknown; summary?: unknown;
      trust_score?: unknown; rating?: unknown; review_count?: unknown;
    };
    return {
      pros:         Array.isArray(parsed.pros) ? (parsed.pros as string[]).filter(Boolean) : [],
      cons:         Array.isArray(parsed.cons) ? (parsed.cons as string[]).filter(Boolean) : [],
      summary:      String(parsed.summary ?? ''),
      trust_score:  Math.min(10, Math.max(0, Number(parsed.trust_score) || 5)),
      rating:       parsed.rating != null && parsed.rating !== '' ? Number(parsed.rating) : null,
      review_count: Number(parsed.review_count) || 0,
      source,
    };
  } catch (err) {
    console.error('[ReviewAggregator] AI parse error:', err);
    return { pros: [], cons: [], summary: 'Analysis unavailable.', trust_score: 5, rating: null, review_count: 0, source };
  }
}

// ── Cache read ────────────────────────────────────────────────────────────────
function getCachedReviews(productId: number): ReviewSummary[] {
  const rows = getDb().prepare(`
    SELECT * FROM product_reviews
    WHERE product_id = ? AND fetched_at >= datetime('now', '-24 hours')
    ORDER BY fetched_at DESC
  `).all(productId) as (ReviewSummary & { pros: string; cons: string })[];

  return rows.map(r => ({
    ...r,
    pros: typeof r.pros === 'string' ? (JSON.parse(r.pros) as string[]) : r.pros,
    cons: typeof r.cons === 'string' ? (JSON.parse(r.cons) as string[]) : r.cons,
  }));
}

// ── Persist one platform review ───────────────────────────────────────────────
function saveReview(db: ReturnType<typeof getDb>, rev: ReviewSummary): void {
  db.prepare(`
    INSERT OR REPLACE INTO product_reviews
    (product_id, platform, rating, review_count, pros, cons, summary, trust_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rev.product_id, rev.platform, rev.rating, rev.review_count,
    JSON.stringify(rev.pros), JSON.stringify(rev.cons),
    rev.summary, rev.trust_score,
  );
}

// ── Main public function ───────────────────────────────────────────────────────
export async function getProductReviews(productId: number, productName?: string): Promise<AggregatedReview> {
  const db = getDb();

  // Return 24h cache if available
  const cached = getCachedReviews(productId);
  if (cached.length) return buildAggregation(productName ?? '', cached);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product | undefined;
  if (!product) throw new Error(`Product ${productId} not found`);

  const name     = productName ?? product.name;
  const category = product.category ?? 'Electronics';

  // Try to fetch page text (best-effort — many sites block bots)
  const primarySnippet = await tryFetchSnippet(product.platform_url ?? '');

  // Analyse primary platform
  const primaryAnalysis = await synthesiseReview(name, category, product.platform, primarySnippet);

  const primaryReview: ReviewSummary = {
    product_id:   productId,
    platform:     product.platform,
    rating:       primaryAnalysis.rating,
    review_count: primaryAnalysis.review_count,
    pros:         primaryAnalysis.pros,
    cons:         primaryAnalysis.cons,
    summary:      primaryAnalysis.summary,
    trust_score:  primaryAnalysis.trust_score,
    fetched_at:   new Date().toISOString(),
    source:       primaryAnalysis.source,
  };
  saveReview(db, primaryReview);

  // Get cross-platform URLs
  const crossPlatforms = db.prepare(`
    SELECT platform, url FROM cross_platform_prices WHERE product_id = ? LIMIT 2
  `).all(productId) as { platform: string; url: string }[];

  // Generate cross-platform reviews in parallel
  const crossReviews = await Promise.all(
    crossPlatforms
      // Avoid duplicating the primary platform
      .filter(cp => cp.platform !== product.platform)
      .map(async cp => {
        const snippet  = await tryFetchSnippet(cp.url ?? '');
        const analysis = await synthesiseReview(name, category, cp.platform, snippet);
        const rev: ReviewSummary = {
          product_id:   productId,
          platform:     cp.platform,
          rating:       analysis.rating,
          review_count: analysis.review_count,
          pros:         analysis.pros,
          cons:         analysis.cons,
          summary:      analysis.summary,
          trust_score:  analysis.trust_score,
          fetched_at:   new Date().toISOString(),
          source:       analysis.source,
        };
        saveReview(db, rev);
        return rev;
      })
  );

  // If no cross-platform data, synthesise a second opinion from a different common platform
  const allReviews = [primaryReview, ...crossReviews];
  if (allReviews.length === 1) {
    const altPlatform = product.platform === 'Amazon' ? 'Flipkart' : 'Amazon';
    const altAnalysis = await synthesiseReview(name, category, altPlatform, '');
    const altReview: ReviewSummary = {
      product_id:   productId,
      platform:     altPlatform,
      rating:       altAnalysis.rating,
      review_count: altAnalysis.review_count,
      pros:         altAnalysis.pros,
      cons:         altAnalysis.cons,
      summary:      altAnalysis.summary,
      trust_score:  altAnalysis.trust_score,
      fetched_at:   new Date().toISOString(),
      source:       'ai_knowledge',
    };
    saveReview(db, altReview);
    allReviews.push(altReview);
  }

  return buildAggregation(name, allReviews);
}

function buildAggregation(productName: string, reviews: ReviewSummary[]): AggregatedReview {
  const avgTrust = reviews.reduce((s, r) => s + r.trust_score, 0) / reviews.length;

  const verdict =
    avgTrust >= 8 ? 'Highly Recommended' :
    avgTrust >= 6.5 ? 'Generally Positive' :
    avgTrust >= 4.5 ? 'Mixed Reviews' : 'Proceed with Caution';

  // Deduplicate and surface most-mentioned pros/cons
  const allPros = [...new Set(reviews.flatMap(r => r.pros))].slice(0, 5);
  const allCons = [...new Set(reviews.flatMap(r => r.cons))].slice(0, 5);

  const recommendation = reviews.length
    ? `${productName ? `"${productName}" ` : ''}scores ${avgTrust.toFixed(1)}/10 across ${reviews.length} platform${reviews.length > 1 ? 's' : ''}. ${verdict}.${allPros[0] ? ` Praised for: ${allPros[0].toLowerCase()}.` : ''}${allCons[0] ? ` Common concern: ${allCons[0].toLowerCase()}.` : ''}`
    : 'No review data available.';

  return {
    overallTrustScore: Math.round(avgTrust * 10) / 10,
    verdict,
    platforms: reviews,
    recommendation,
  };
}
