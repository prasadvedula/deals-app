import OpenAI from 'openai';

// ── Provider selection ────────────────────────────────────────────────────────
// AI_PROVIDER env var: "ollama" | "groq" | "claude"
// - ollama: local Ollama (dev only, not available on Railway)
// - groq:   free Groq cloud API (console.groq.com — OpenAI-compatible, very fast)
// - claude: Anthropic Claude API (best quality, ~$3/1M tokens)
export type ProviderName = 'claude' | 'ollama' | 'groq';
export const AI_PROVIDER: ProviderName =
  (process.env.AI_PROVIDER as ProviderName) || 'ollama';

// ── Models ────────────────────────────────────────────────────────────────────
export const OLLAMA_CHAT_MODEL  = 'qwen2.5:3b-instruct';
export const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
export const GROQ_CHAT_MODEL    = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
export const CLAUDE_MODEL       = 'claude-opus-4-8';

// Allow overriding Ollama host (e.g. remote VM or ngrok tunnel)
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');

// ── Ollama availability (checked once, cached) ────────────────────────────────
let _ollamaAvailable: boolean | null = null;

export async function isOllamaAvailable(): Promise<boolean> {
  if (_ollamaAvailable !== null) return _ollamaAvailable;
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    _ollamaAvailable = res.ok;
  } catch {
    _ollamaAvailable = false;
  }
  if (!_ollamaAvailable)
    console.warn(`[AI] Ollama not reachable at ${OLLAMA_BASE_URL} — AI features degraded`);
  return _ollamaAvailable;
}

// ── Lazy clients ──────────────────────────────────────────────────────────────
let _ollamaClient: OpenAI | null = null;
let _groqClient:   OpenAI | null = null;
let _anthropic: import('@anthropic-ai/sdk').default | null = null;

export function getOllamaClient(): OpenAI {
  if (!_ollamaClient)
    _ollamaClient = new OpenAI({ baseURL: `${OLLAMA_BASE_URL}/v1`, apiKey: 'ollama' });
  return _ollamaClient;
}

function getGroqClient(): OpenAI {
  if (!_groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is required when AI_PROVIDER=groq');
    _groqClient = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key });
  }
  return _groqClient;
}

async function getAnthropicClient() {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── generateResponse ──────────────────────────────────────────────────────────
export async function generateResponse(prompt: string, systemPrompt: string): Promise<string> {
  if (AI_PROVIDER === 'ollama') {
    if (!(await isOllamaAvailable())) return '';
    const res = await getOllamaClient().chat.completions.create({
      model: OLLAMA_CHAT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  if (AI_PROVIDER === 'groq') {
    const res = await getGroqClient().chat.completions.create({
      model: GROQ_CHAT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      max_tokens: 1024,
    });
    return res.choices[0]?.message?.content ?? '';
  }

  // Claude
  const anthropic = await getAnthropicClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (anthropic.messages.create as any)({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (res.content as any[]).find((b: any) => b.type === 'text');
  return block ? block.text : '';
}

// ── streamChatResponse ────────────────────────────────────────────────────────
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const UNAVAILABLE_MSG =
  "I'm running in catalog-only mode (no AI connected). Browse **Catalog**, **Trending**, and **AI Search** — those work fully. To enable chat, set `AI_PROVIDER=groq` + `GROQ_API_KEY` (free at console.groq.com) or `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` in Railway environment variables.";

export async function streamChatResponse(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  let full = '';

  // ── Ollama ──────────────────────────────────────────────────────────────────
  if (AI_PROVIDER === 'ollama') {
    if (!(await isOllamaAvailable())) {
      onChunk(UNAVAILABLE_MSG);
      return UNAVAILABLE_MSG;
    }
    const stream = await getOllamaClient().chat.completions.create({
      model: OLLAMA_CHAT_MODEL,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) { full += text; onChunk(text); }
    }
    return full;
  }

  // ── Groq (OpenAI-compatible streaming) ─────────────────────────────────────
  if (AI_PROVIDER === 'groq') {
    const stream = await getGroqClient().chat.completions.create({
      model: GROQ_CHAT_MODEL,
      stream: true,
      max_tokens: 2048,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) { full += text; onChunk(text); }
    }
    return full;
  }

  // ── Claude streaming ────────────────────────────────────────────────────────
  const anthropic = await getAnthropicClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (anthropic.messages.stream as any)({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of stream as AsyncIterable<any>) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      full += chunk.delta.text;
      onChunk(chunk.delta.text);
    }
  }
  return full;
}

// ── embed (Ollama only; others → null → FTS5 fallback) ────────────────────────
export async function embed(text: string): Promise<number[] | null> {
  if (AI_PROVIDER !== 'ollama') return null;
  if (!(await isOllamaAvailable())) return null;
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: text }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { embeddings: number[][] };
  return data.embeddings[0] ?? null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── providerInfo (for /api/health) ────────────────────────────────────────────
export function providerInfo() {
  if (AI_PROVIDER === 'ollama')
    return { provider: 'ollama', chatModel: OLLAMA_CHAT_MODEL, embedModel: OLLAMA_EMBED_MODEL, ollamaUrl: OLLAMA_BASE_URL, available: _ollamaAvailable };
  if (AI_PROVIDER === 'groq')
    return { provider: 'groq', chatModel: GROQ_CHAT_MODEL, embedModel: null, available: !!process.env.GROQ_API_KEY };
  return { provider: 'claude', chatModel: CLAUDE_MODEL, embedModel: null, available: !!process.env.ANTHROPIC_API_KEY };
}
