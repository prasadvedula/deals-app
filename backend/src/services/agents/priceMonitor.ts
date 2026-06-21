import { getDb } from '../../database/db';
import { AI_PROVIDER, CLAUDE_MODEL, OLLAMA_CHAT_MODEL, getOllamaClient } from '../ai/provider';
import { Product } from '../../models/types';
import { broadcastNotification } from '../websocket';

// ── Tool definitions ─────────────────────────────────────────────────────────
// Use plain object arrays to avoid SDK-version type conflicts
const TOOL_DEFS = [
  {
    name: 'check_platform_price',
    description: 'Check the current price of a product on an external platform',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'number' },
        product_name: { type: 'string' },
        platform: { type: 'string', enum: ['Flipkart', 'Amazon India', 'Meesho', 'Snapdeal'] },
        current_price: { type: 'number' },
      },
      required: ['product_id', 'product_name', 'platform', 'current_price'],
    },
  },
  {
    name: 'save_price_comparison',
    description: 'Save cross-platform price comparisons to the database',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'number' },
        comparisons: {
          type: 'array',
          items: {
            type: 'object',
            properties: { platform: { type: 'string' }, price: { type: 'number' }, url: { type: 'string' } },
          },
        },
      },
      required: ['product_id', 'comparisons'],
    },
  },
  {
    name: 'check_and_notify_price_drop',
    description: 'Check if price dropped enough to alert users who favorited this product',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'number' },
        product_name: { type: 'string' },
        original_price: { type: 'number' },
        current_price: { type: 'number' },
      },
      required: ['product_id', 'product_name', 'original_price', 'current_price'],
    },
  },
] as const;

// OpenAI-compatible format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS_OPENAI: any[] = TOOL_DEFS.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

// Claude format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS_CLAUDE: any[] = TOOL_DEFS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
}));

// ── Tool executor ────────────────────────────────────────────────────────────
function simulatePrice(base: number, variancePct: number): number {
  const v = (Math.random() - 0.4) * variancePct * base;
  return Math.round(Math.max(base * 0.75, base + v) * 100) / 100;
}

function executeTool(name: string, input: Record<string, unknown>): unknown {
  const db = getDb();

  if (name === 'check_platform_price') {
    const { product_id, product_name, platform, current_price } = input as {
      product_id: number; product_name: string; platform: string; current_price: number;
    };
    const variance = platform === 'Meesho' ? 0.18 : platform === 'Snapdeal' ? 0.12 : 0.08;
    const price = Math.round(simulatePrice(current_price, variance)); // INR whole numbers
    const urls: Record<string, string> = {
      'Flipkart': `https://www.flipkart.com/search?q=${encodeURIComponent(product_name)}`,
      'Amazon India': `https://www.amazon.in/s?k=${encodeURIComponent(product_name)}`,
      'Meesho': `https://meesho.com/search?q=${encodeURIComponent(product_name)}`,
      'Snapdeal': `https://www.snapdeal.com/search?keyword=${encodeURIComponent(product_name)}`,
    };
    return { product_id, platform, price, url: urls[platform] ?? '' };
  }

  if (name === 'save_price_comparison') {
    const { product_id, comparisons } = input as {
      product_id: number;
      comparisons: Array<{ platform: string; price: number; url: string }>;
    };
    const upsert = db.prepare(`
      INSERT INTO cross_platform_prices (product_id, platform, price, url, last_checked)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(product_id, platform) DO UPDATE SET price=excluded.price, url=excluded.url, last_checked=excluded.last_checked
    `);
    db.transaction(() => comparisons.forEach((c) => upsert.run(product_id, c.platform, c.price, c.url)))();
    return { saved: comparisons.length };
  }

  if (name === 'check_and_notify_price_drop') {
    const { product_id, product_name, original_price, current_price } = input as {
      product_id: number; product_name: string; original_price: number; current_price: number;
    };
    const drop = (original_price - current_price) / original_price;
    const favs = db.prepare('SELECT * FROM favorites WHERE product_id = ?')
      .all(product_id) as Array<{ user_id: string; price_alert_threshold: number }>;
    let notified = 0;
    for (const fav of favs) {
      if (drop >= fav.price_alert_threshold) {
        const pct = Math.round(drop * 100);
        const msg = `Price drop! ${product_name} is now $${current_price} (${pct}% off original $${original_price})`;
        db.prepare(`INSERT INTO notifications (user_id, product_id, type, message) VALUES (?, ?, 'price_drop', ?)`)
          .run(fav.user_id, product_id, msg);
        broadcastNotification({ type: 'price_drop', user_id: fav.user_id, product_id, product_name, old_price: original_price, new_price: current_price, discount_percent: pct, message: msg });
        notified++;
      }
    }
    return { notified, drop_ratio: drop };
  }

  return { error: `Unknown tool: ${name}` };
}

// ── Ollama agentic loop ──────────────────────────────────────────────────────
async function runWithOllama(products: Product[]): Promise<void> {
  const client = getOllamaClient();
  const list = products.map((p) => `ID:${p.id} "${p.name}" $${p.current_price} (orig $${p.original_price})`).join('\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'system', content: 'You are an Indian e-commerce price monitoring agent. Prices are in INR (₹). Use tools to check Flipkart, Amazon India, Meesho, and Snapdeal prices for each product, save comparisons, then check alerts. Be systematic.' },
    { role: 'user', content: `Monitor these ${products.length} products (prices in INR):\n${list}\n\nFor each: check all 4 platforms, save comparisons, then check alerts.` },
  ];

  for (let i = 0; i < 30; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client.chat.completions.create as any)({
      model: OLLAMA_CHAT_MODEL,
      messages,
      tools: TOOLS_OPENAI,
      tool_choice: 'auto',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const choice = res.choices[0] as any;
    messages.push({ role: 'assistant', content: choice.message.content ?? '', tool_calls: choice.message.tool_calls });

    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of choice.message.tool_calls as any[]) {
      const fnName: string = call.function?.name ?? call.name;
      const fnArgs: string = call.function?.arguments ?? JSON.stringify(call.arguments ?? {});
      const input = JSON.parse(fnArgs) as Record<string, unknown>;
      console.log(`[Agent:ollama] ${fnName}`, JSON.stringify(input).slice(0, 80));
      const result = executeTool(fnName, input);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
}

// ── Claude agentic loop ──────────────────────────────────────────────────────
async function runWithClaude(products: Product[]): Promise<void> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const list = products.map((p) => `ID:${p.id} "${p.name}" $${p.current_price} (orig $${p.original_price})`).join('\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'user', content: `Monitor these ${products.length} products (prices in INR ₹):\n${list}\n\nFor each: check Flipkart, Amazon India, Meesho, Snapdeal prices, save comparisons, then check alerts.` },
  ];

  for (let i = 0; i < 30; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (anthropic.messages.create as any)({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      tools: TOOLS_CLAUDE,
      messages,
    });

    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason === 'end_turn') break;
    if (res.stop_reason !== 'tool_use') break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const block of res.content as any[]) {
      if (block.type !== 'tool_use') continue;
      console.log(`[Agent:claude] ${block.name}`, JSON.stringify(block.input).slice(0, 80));
      const result = executeTool(block.name as string, block.input as Record<string, unknown>);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: results });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function runPriceMonitorAgent(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  console.log(`[PriceMonitor] Starting (provider=${AI_PROVIDER}, ${products.length} products)...`);
  const db = getDb();
  const taskId = db.prepare(
    "INSERT INTO agent_tasks (type, status, payload) VALUES ('price_monitor', 'running', ?)"
  ).run(JSON.stringify({ product_count: products.length, provider: AI_PROVIDER })).lastInsertRowid;

  try {
    if (AI_PROVIDER === 'ollama') {
      await runWithOllama(products);
    } else {
      await runWithClaude(products);
    }
    db.prepare("UPDATE agent_tasks SET status='completed', completed_at=datetime('now') WHERE id=?").run(taskId);
    console.log('[PriceMonitor] Done.');
  } catch (err) {
    db.prepare("UPDATE agent_tasks SET status='failed', result=? WHERE id=?").run(String(err), taskId);
    throw err;
  }
}

export async function monitorAllTrendingProducts(): Promise<void> {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY trending_score DESC LIMIT 6').all() as Product[];
  await runPriceMonitorAgent(products);
}
