// Legacy Claude-only client kept for reference. App now uses provider.ts for all AI calls.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';
let client: Anthropic;

export function getClaudeClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export { MODEL };
