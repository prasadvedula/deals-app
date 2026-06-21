import OpenAI from 'openai';

// ── read once at startup ──────────────────────────────────────────────────────
export type ProviderName = 'claude' | 'ollama';
export const AI_PROVIDER: ProviderName =
  (process.env.AI_PROVIDER as ProviderName) || 'ollama';

// Models
export const OLLAMA_CHAT_MODEL = 'qwen2.5:3b-instruct';
export const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
export const CLAUDE_MODEL = 'claude-opus-4-8';

// ── lazy clients ─────────────────────────────────────────────────────────────
let _ollama: OpenAI | null = null;
let _anthropic: import('@anthropic-ai/sdk').default | null = null;

export function getOllamaClient(): OpenAI {
  if (!_ollama)
    _ollama = new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });
  return _ollama;
}

// keep internal alias
function ollamaClient(): OpenAI { return getOllamaClient(); }

async function anthropicClient() {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── generateResponse ──────────────────────────────────────────────────────────
export async function generateResponse(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  if (AI_PROVIDER === 'ollama') {
    const res = await ollamaClient().chat.completions.create({
      model: OLLAMA_CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  // Claude — cast to any to handle SDK version differences for adaptive thinking
  const anthropic = await anthropicClient();
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

export async function streamChatResponse(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  let full = '';

  if (AI_PROVIDER === 'ollama') {
    const stream = await ollamaClient().chat.completions.create({
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

  // Claude streaming
  const anthropic = await anthropicClient();
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

// ── embed (Ollama only; Claude falls back to null → FTS5 used instead) ────────
export async function embed(text: string): Promise<number[] | null> {
  if (AI_PROVIDER !== 'ollama') return null;
  const res = await fetch('http://localhost:11434/api/embed', {
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

// ── providerInfo (for /api/health) ───────────────────────────────────────────
export function providerInfo() {
  return AI_PROVIDER === 'ollama'
    ? { provider: 'ollama', chatModel: OLLAMA_CHAT_MODEL, embedModel: OLLAMA_EMBED_MODEL }
    : { provider: 'claude', chatModel: CLAUDE_MODEL, embedModel: null };
}
