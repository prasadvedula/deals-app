/**
 * LangGraph Supervisor — orchestrates 11 specialist agents using StateGraph.
 * Requires Node ≥20 (bare `crypto` global needed by @langchain/core uuid rng).
 *
 * Graph topology:
 *   START → supervisor → (price_search | deal_hunter | review | budget |
 *                         predictor | report | deal_dna | coupon_stack |
 *                         seasonal | mood | general) → END
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { generateResponse } from '../ai/provider';
import { searchAcrossPlatforms } from './platformSearch';
import { getDealHunterResult } from './dealHunter';
import { getProductReviews } from './reviewAggregator';
import { getBuyTimePrediction } from './buyTimePredictor';
import { getLatestWeeklyReport } from './weeklyReport';
import { getDealDna } from './dealDna';
import { getCouponStack } from './couponAdvisor';
import { getSeasonalAlerts } from './seasonalPatterns';
import { getDb } from '../../database/db';
import { Product } from '../../models/types';

// ── State definition ──────────────────────────────────────────────────────────
const AgentState = Annotation.Root({
  userMessage: Annotation<string>(),
  intent:      Annotation<string>(),
  next:        Annotation<string>(),
  agentOutput: Annotation<unknown>(),
  error:       Annotation<string | null>(),
});

type State = typeof AgentState.State;

// ── Intent classifier ─────────────────────────────────────────────────────────
const INTENTS = [
  'price_search',
  'deal_hunter',
  'review',
  'budget',
  'predictor',
  'report',
  'deal_dna',
  'coupon_stack',
  'seasonal',
  'mood',
  'general',
] as const;

type Intent = typeof INTENTS[number];

async function classifyIntent(message: string): Promise<Intent> {
  const prompt = `Classify this user message into exactly one intent from this list:
${INTENTS.join(', ')}

Rules:
- price_search: searching for products, comparing prices, "find me X", "show me X on Y platform"
- deal_hunter: set a price alert, watch a product, "alert me when X drops below Y"
- review: asking for reviews, ratings, "is this product good?", "what do people say about X?"
- budget: best options within a budget, "under ₹5000", "best for ₹10000"
- predictor: when to buy, price prediction, "will price drop?", "should I buy now?"
- report: weekly summary, top deals, "what are the best deals this week?"
- deal_dna: price history, monthly price trends, cheapest month, "when was X cheapest?", "price analysis for X"
- coupon_stack: coupons, cashback, bank card offers, "how to save on X", "best offer on X", "HDFC cashback"
- seasonal: upcoming sales, Diwali sale, Big Billion Days, "next sale for X", "when is Flipkart sale?"
- mood: feeling-based shopping, "treat myself", "stressed", "gift for mom", "I'm bored", "cheer me up"
- general: anything else

Message: "${message}"
Intent (one word only):`;

  try {
    const result = await generateResponse(prompt, 'You are an intent classifier. Output exactly one word from the provided list.');
    const word = result.trim().toLowerCase().split(/\s+/)[0] as Intent;
    return INTENTS.includes(word) ? word : 'general';
  } catch {
    return 'general';
  }
}

// ── Supervisor node ───────────────────────────────────────────────────────────
async function supervisorNode(state: State): Promise<Partial<State>> {
  const intent = await classifyIntent(state.userMessage);
  return { intent, next: intent };
}

// ── Helper: find product by keywords ─────────────────────────────────────────
async function findProduct(message: string): Promise<Product | undefined> {
  const db = getDb();
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return undefined;
  return db.prepare(
    `SELECT * FROM products WHERE ${words.map(() => 'LOWER(name) LIKE ?').join(' OR ')} LIMIT 1`
  ).get(...words.map(w => `%${w}%`)) as Product | undefined;
}

function parseBudget(message: string): number {
  const kMatch    = message.match(/(\d[\d,.]*)\s*[kK]\b/);
  if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g, '')) * 1000);
  const lakhMatch = message.match(/(\d[\d,.]*)\s*(?:lakh|lac|L)\b/i);
  if (lakhMatch) return Math.round(parseFloat(lakhMatch[1].replace(/,/g, '')) * 100000);
  const numMatch  = message.match(/₹\s*(\d[\d,]+)|(\d{3,}[\d,]*)/);
  if (numMatch) return parseInt((numMatch[1] ?? numMatch[2]).replace(/,/g, ''));
  return 5000;
}

// ── Specialist nodes ──────────────────────────────────────────────────────────
async function priceSearchNode(state: State): Promise<Partial<State>> {
  try {
    const results = await searchAcrossPlatforms(state.userMessage);
    return { agentOutput: { type: 'price_search', results }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function dealHunterNode(state: State): Promise<Partial<State>> {
  try {
    const result = await getDealHunterResult(state.userMessage);
    return { agentOutput: { type: 'deal_hunter', ...result }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function reviewNode(state: State): Promise<Partial<State>> {
  try {
    const db = getDb();
    const words = state.userMessage.toLowerCase().split(' ');
    const product = db.prepare(
      `SELECT * FROM products WHERE ${words.map(() => 'LOWER(name) LIKE ?').join(' OR ')} LIMIT 1`
    ).get(...words.map(w => `%${w}%`)) as { id: number; name: string } | undefined;

    if (!product) {
      const summary = await generateResponse(
        `The user asked: "${state.userMessage}". No matching product found in catalog. Suggest they use AI Search to find it.`,
        'You are a helpful shopping assistant.'
      );
      return { agentOutput: { type: 'review', found: false, message: summary }, next: END };
    }
    const reviews = await getProductReviews(product.id, product.name);
    return { agentOutput: { type: 'review', found: true, product, reviews }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function budgetNode(state: State): Promise<Partial<State>> {
  try {
    const extractPrompt = `From this shopping query: "${state.userMessage}"
Extract:
1. budget: the amount in INR as a number (convert "25k"→25000, "1 lakh"→100000, "50K"→50000)
2. productType: the exact product the user wants (e.g. "smartphone", "laptop", "earphones")
3. keywords: 2-4 specific lowercase search keywords. Avoid short substrings that cause false matches.
   - For smartphone/phone → ["smartphone", "android", "5g phone"] NOT ["phone"] (matches "headphone")
   - For laptop → ["laptop", "notebook"] NOT ["top"]
   - For TV → ["television", "smart tv"] NOT ["tv"] alone
4. exclusions: 2-4 lowercase terms that should NOT appear in results.
   - For smartphone → ["headphone", "earphone", "bluetooth headphone"]
   - For laptop → ["phone", "tablet", "headphone"]
5. useCase: any mentioned use case or empty string

Respond with ONLY valid JSON:
{"budget":25000,"productType":"smartphone","keywords":["smartphone","android","5g phone"],"exclusions":["headphone","earphone"],"useCase":"IT professional"}`;

    let budget = parseBudget(state.userMessage);
    let productType = '';
    let keywords: string[] = [];
    let exclusions: string[] = [];
    let useCase = '';

    try {
      const raw = await generateResponse(extractPrompt, 'You are a query parser. Output only valid JSON.');
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]) as { budget?: number; productType?: string; keywords?: string[]; exclusions?: string[]; useCase?: string };
        if (Number(p.budget) > 0) budget = Number(p.budget);
        productType = String(p.productType ?? '');
        keywords    = Array.isArray(p.keywords)   ? p.keywords.filter(Boolean)   as string[] : [];
        exclusions  = Array.isArray(p.exclusions) ? p.exclusions.filter(Boolean) as string[] : [];
        useCase     = String(p.useCase ?? '');
      }
    } catch { /* fall through */ }

    if (keywords.length === 0 && productType) keywords = [productType];

    const db = getDb();

    const buildKeywordFilter = (kws: string[]) => {
      if (!kws.length) return { clause: '', params: [] as string[] };
      const conditions = kws.map(() => '(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?)').join(' OR ');
      return { clause: `AND (${conditions})`, params: kws.flatMap(kw => [`%${kw}%`, `%${kw}%`, `%${kw}%`]) };
    };

    const buildExclusionFilter = (exs: string[]) => {
      if (!exs.length) return { clause: '', params: [] as string[] };
      const conditions = exs.map(() => 'LOWER(name) NOT LIKE ? AND LOWER(category) NOT LIKE ?').join(' AND ');
      return { clause: `AND (${conditions})`, params: exs.flatMap(ex => [`%${ex}%`, `%${ex}%`]) };
    };

    const { clause: kClause, params: kparams } = buildKeywordFilter(keywords);
    const { clause: exClause, params: exparams } = buildExclusionFilter(exclusions);

    const products = db.prepare(`
      SELECT *, ROUND((original_price - current_price) * 100.0 / original_price, 1) AS discount_pct
      FROM products
      WHERE current_price <= ? ${kClause} ${exClause}
      ORDER BY trending_score DESC, discount_pct DESC
      LIMIT 6
    `).all(budget, ...kparams, ...exparams) as Array<{ id: number; name: string; current_price: number; platform: string; discount_pct: number; image_url?: string }>;

    if (products.length === 0) {
      const suggestion = await generateResponse(
        `The user asked: "${state.userMessage}". Budget: ₹${budget.toLocaleString('en-IN')}. Product type: "${productType}". No matching products found. Tell the user in 2 sentences to use the AI Search / Find tab to discover it across platforms.`,
        'You are a helpful Indian shopping assistant. Use ₹ symbol.'
      );
      return { agentOutput: { type: 'budget', budget, productType, useCase, products: [], summary: suggestion, noResults: true }, next: END };
    }

    const summary = await generateResponse(
      `User request: "${state.userMessage}"\nInterpreted as: ${productType || 'any product'} under ₹${budget.toLocaleString('en-IN')}${useCase ? ` for ${useCase}` : ''}.\n\nProducts found:\n${products.map(p => `- ${p.name} on ${p.platform}: ₹${p.current_price.toLocaleString('en-IN')} (${p.discount_pct}% off)`).join('\n')}\n\nWrite 2-3 sentences recommending the best pick. Use ₹ symbol.`,
      'You are a knowledgeable Indian tech shopping advisor. Use ₹ symbol for all prices.'
    );
    return { agentOutput: { type: 'budget', budget, productType, useCase, products, summary }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function predictorNode(state: State): Promise<Partial<State>> {
  try {
    const db = getDb();
    const words = state.userMessage.toLowerCase().split(' ');
    const product = db.prepare(
      `SELECT * FROM products WHERE ${words.map(() => 'LOWER(name) LIKE ?').join(' OR ')} LIMIT 1`
    ).get(...words.map(w => `%${w}%`)) as { id: number; name: string; current_price: number } | undefined;

    if (!product) return { agentOutput: { type: 'predictor', found: false, message: 'Could not find that product. Search for it first using AI Search.' }, next: END };
    const prediction = await getBuyTimePrediction(product.id);
    return { agentOutput: { type: 'predictor', found: true, product, prediction }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function reportNode(state: State): Promise<Partial<State>> {
  try {
    const report = await getLatestWeeklyReport();
    return { agentOutput: { type: 'report', report }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function dealDnaNode(state: State): Promise<Partial<State>> {
  try {
    const product = await findProduct(state.userMessage);
    if (!product) {
      const msg = await generateResponse(
        `User asked: "${state.userMessage}" — no product found. Tell them in 1 sentence to search first using AI Search, then ask for price analysis.`,
        'You are a helpful Indian shopping assistant.'
      );
      return { agentOutput: { type: 'deal_dna', found: false, message: msg }, next: END };
    }
    const dna = await getDealDna(product.id);
    return { agentOutput: { type: 'deal_dna', found: true, product, dna }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function couponStackNode(state: State): Promise<Partial<State>> {
  try {
    const product = await findProduct(state.userMessage);
    if (!product) {
      const msg = await generateResponse(
        `User asked: "${state.userMessage}" for coupons — no product found. Tell them in 1 sentence to find the product first.`,
        'You are a helpful Indian shopping assistant.'
      );
      return { agentOutput: { type: 'coupon_stack', found: false, message: msg }, next: END };
    }
    const coupons = await getCouponStack(product.id, product.name, product.platform, product.current_price);
    return { agentOutput: { type: 'coupon_stack', found: true, product, coupons }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function seasonalNode(state: State): Promise<Partial<State>> {
  try {
    const product = await findProduct(state.userMessage);
    const db = getDb();
    const p = product ?? (db.prepare('SELECT * FROM products ORDER BY trending_score DESC LIMIT 1').get() as Product | undefined);
    if (!p) return { agentOutput: { type: 'seasonal', found: false, message: 'No products in catalog yet. Add some via AI Search first.' }, next: END };
    const alerts = await getSeasonalAlerts(p.id, p.category);
    return { agentOutput: { type: 'seasonal', found: true, product: p, alerts }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function moodNode(state: State): Promise<Partial<State>> {
  try {
    const parsePrompt = `From this message: "${state.userMessage}"
Extract:
1. mood: one short phrase describing the shopping vibe
2. budget: optional max price in INR as a number, or 0 if not mentioned
Respond with ONLY valid JSON: {"mood":"treat myself","budget":2000}`;

    let mood = 'happy';
    let budget = 5000;
    try {
      const raw = await generateResponse(parsePrompt, 'You are a query parser. Output only valid JSON.');
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]) as { mood?: string; budget?: number };
        if (p.mood) mood = String(p.mood);
        if (Number(p.budget) > 0) budget = Number(p.budget);
      }
    } catch { /* use defaults */ }

    const db = getDb();
    const products = db.prepare(`
      SELECT *, ROUND((original_price - current_price) * 100.0 / original_price, 1) AS discount_pct
      FROM products
      ${budget > 0 ? 'WHERE current_price <= ?' : ''}
      ORDER BY trending_score DESC, discount_pct DESC
      LIMIT 8
    `).all(...(budget > 0 ? [budget] : [])) as Array<{ id: number; name: string; current_price: number; platform: string; discount_pct: number; image_url?: string }>;

    const summary = await generateResponse(
      `User mood: "${mood}". Budget: ₹${budget > 0 ? budget.toLocaleString('en-IN') : 'any'}.\nProducts: ${products.slice(0, 6).map(p => `${p.name} (₹${p.current_price}, ${p.discount_pct}% off on ${p.platform})`).join('; ')}\nWrite a warm 2-sentence intro matching their vibe. Use ₹ symbol.`,
      'You are a warm, empathetic Indian shopping advisor who matches picks to emotional state.'
    );
    return { agentOutput: { type: 'mood', found: true, mood, budget, products: products.slice(0, 4), summary }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

async function generalNode(state: State): Promise<Partial<State>> {
  try {
    const db = getDb();
    const stats = db.prepare('SELECT COUNT(*) as total, AVG(current_price) as avg_price FROM products').get() as { total: number; avg_price: number };
    const top = db.prepare('SELECT name, current_price, platform FROM products ORDER BY trending_score DESC LIMIT 5').all() as Array<{ name: string; current_price: number; platform: string }>;
    const answer = await generateResponse(
      `User asked: "${state.userMessage}"\n\nCatalog: ${stats.total} products, avg price ₹${Math.round(stats.avg_price)}.\nTop trending: ${top.map(p => `${p.name} (₹${p.current_price} on ${p.platform})`).join(', ')}`,
      'You are DealsApp AI assistant for Indian e-commerce. Be helpful, concise, use ₹ for prices. Suggest specific features when relevant.'
    );
    return { agentOutput: { type: 'general', answer }, next: END };
  } catch (e) { return { error: String(e), next: END }; }
}

// ── Build graph ───────────────────────────────────────────────────────────────
function buildGraph() {
  const graph = new StateGraph(AgentState)
    .addNode('supervisor',   supervisorNode)
    .addNode('price_search', priceSearchNode)
    .addNode('deal_hunter',  dealHunterNode)
    .addNode('review',       reviewNode)
    .addNode('budget',       budgetNode)
    .addNode('predictor',    predictorNode)
    .addNode('report',       reportNode)
    .addNode('deal_dna',     dealDnaNode)
    .addNode('coupon_stack', couponStackNode)
    .addNode('seasonal',     seasonalNode)
    .addNode('mood',         moodNode)
    .addNode('general',      generalNode)
    .addEdge(START, 'supervisor')
    .addConditionalEdges('supervisor', (s) => s.next, {
      price_search: 'price_search',
      deal_hunter:  'deal_hunter',
      review:       'review',
      budget:       'budget',
      predictor:    'predictor',
      report:       'report',
      deal_dna:     'deal_dna',
      coupon_stack: 'coupon_stack',
      seasonal:     'seasonal',
      mood:         'mood',
      general:      'general',
    })
    .addEdge('price_search',  END)
    .addEdge('deal_hunter',   END)
    .addEdge('review',        END)
    .addEdge('budget',        END)
    .addEdge('predictor',     END)
    .addEdge('report',        END)
    .addEdge('deal_dna',      END)
    .addEdge('coupon_stack',  END)
    .addEdge('seasonal',      END)
    .addEdge('mood',          END)
    .addEdge('general',       END);

  return graph.compile();
}

let _graph: ReturnType<typeof buildGraph> | null = null;
function getGraph() {
  if (!_graph) _graph = buildGraph();
  return _graph;
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface SupervisorResult {
  intent: string;
  output: unknown;
  error?: string;
}

export async function runSupervisor(userMessage: string): Promise<SupervisorResult> {
  const graph = getGraph();
  const result = await graph.invoke({
    userMessage,
    intent: '',
    next: '',
    agentOutput: null,
    error: null,
  });
  return {
    intent: result.intent,
    output: result.agentOutput,
    error:  result.error ?? undefined,
  };
}
