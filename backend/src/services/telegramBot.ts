/**
 * Alert Bot — Deal alerts + commands via Telegraf (Telegram transport)
 *
 * Setup: Create a bot via @BotFather, get the token,
 * set TELEGRAM_BOT_TOKEN in your .env file.
 *
 * Commands:
 *   /start   — welcome message
 *   /deals   — show today's top 5 deals
 *   /search <query>  — search catalog
 *   /watch <query> [max_price]  — create a deal goal
 *   /goals   — list active goals
 *   /help    — command reference
 */

import { Telegraf } from 'telegraf';
import { getDb } from '../database/db';
import { Product } from '../models/types';
import { createGoal, listGoals } from './agents/dealHunter';

let bot: Telegraf | null = null;

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function truncate(s: string, max = 80) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function initTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here') {
    console.log('[AlertBot] Bot token not set — skipping Telegram bot.');
    return;
  }

  bot = new Telegraf(token);

  // /start
  bot.start(ctx => {
    ctx.reply(
      `👋 Welcome to *DealsApp Bot*!\n\n` +
      `I track prices across Flipkart, Amazon India, Myntra, and more.\n\n` +
      `*Commands:*\n` +
      `/deals — Today's top 5 deals\n` +
      `/search <query> — Search catalog\n` +
      `/watch <product> [max price] — Track a product\n` +
      `/goals — Your active deal goals\n` +
      `/help — Full command list`,
      { parse_mode: 'Markdown' }
    );
  });

  // /help
  bot.help(ctx => {
    ctx.reply(
      `*DealsApp Bot Commands*\n\n` +
      `🔥 /deals — Top 5 deals right now\n` +
      `🔍 /search <query> — Search for a product\n` +
      `👁 /watch <product> [₹max] — Watch a product\n` +
      `📋 /goals — View your active goals\n` +
      `📌 /start — Welcome message`,
      { parse_mode: 'Markdown' }
    );
  });

  // /deals
  bot.command('deals', ctx => {
    const db = getDb();
    const deals = db.prepare(`
      SELECT p.*,
        ROUND((p.original_price - p.current_price) * 100.0 / p.original_price, 0) AS discount_pct
      FROM products p
      WHERE p.original_price > p.current_price
      ORDER BY discount_pct DESC
      LIMIT 5
    `).all() as (Product & { discount_pct: number })[];

    if (!deals.length) {
      ctx.reply('No active deals found right now. Try again later!');
      return;
    }

    const lines = deals.map((d, i) =>
      `${i + 1}. *${truncate(d.name)}*\n   ${inr(d.current_price)} _(${d.discount_pct}% off)_ on ${d.platform}`
    ).join('\n\n');

    ctx.reply(`🔥 *Today\'s Top Deals*\n\n${lines}`, { parse_mode: 'Markdown' });
  });

  // /search <query>
  bot.command('search', ctx => {
    const query = ctx.message.text.replace('/search', '').trim();
    if (!query) {
      ctx.reply('Usage: /search <product name>\nExample: /search boAt earbuds');
      return;
    }

    const db = getDb();
    const results = db.prepare(`
      SELECT *, ROUND((original_price - current_price) * 100.0 / original_price, 0) AS discount_pct
      FROM products
      WHERE LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?)
      ORDER BY trending_score DESC
      LIMIT 5
    `).all(`%${query}%`, `%${query}%`) as (Product & { discount_pct: number })[];

    if (!results.length) {
      ctx.reply(`No results for "*${query}*" in catalog.\n\nTry the AI Search on the app to find it across all platforms!`, { parse_mode: 'Markdown' });
      return;
    }

    const lines = results.map((p, i) =>
      `${i + 1}. *${truncate(p.name)}*\n   ${inr(p.current_price)}${p.discount_pct > 0 ? ` _(${p.discount_pct}% off)_` : ''} on ${p.platform}`
    ).join('\n\n');

    ctx.reply(`🔍 *Results for "${query}"*\n\n${lines}`, { parse_mode: 'Markdown' });
  });

  // /watch <query> [max_price]
  bot.command('watch', ctx => {
    const parts = ctx.message.text.replace('/watch', '').trim().split(/\s+/);
    if (!parts[0]) {
      ctx.reply('Usage: /watch <product name> [max price]\nExample: /watch iPhone 15 70000');
      return;
    }

    // Last token is price if it looks like a number
    let maxPrice: number | undefined;
    const lastToken = parts[parts.length - 1];
    if (/^\d+$/.test(lastToken)) {
      maxPrice = parseInt(lastToken);
      parts.pop();
    }

    const query = parts.join(' ');
    const userId = `tg_${ctx.from.id}`;

    try {
      const goal = createGoal({ query, max_price: maxPrice, user_id: userId });
      ctx.reply(
        `✅ *Goal created!*\n\nWatching: *${query}*${maxPrice ? `\nTarget price: ${inr(maxPrice)}` : ''}\n\nI'll notify you here when a deal is found! 🔔`,
        { parse_mode: 'Markdown' }
      );
      console.log('[AlertBot] Goal created:', goal.id, 'for', userId);
    } catch (e) {
      ctx.reply('Sorry, failed to create goal. Please try again.');
      console.error('[AlertBot] Goal error:', e);
    }
  });

  // /goals
  bot.command('goals', ctx => {
    const userId = `tg_${ctx.from.id}`;
    const goals = listGoals(userId);

    if (!goals.length) {
      ctx.reply('You have no active goals.\n\nUse /watch <product> to start tracking!');
      return;
    }

    const lines = goals.map((g, i) => {
      const icon = g.status === 'found' ? '✅' : g.status === 'watching' ? '👁' : '❌';
      return `${icon} ${i + 1}. *${g.query}*${g.max_price ? ` (max ${inr(g.max_price)})` : ''}\n   Status: ${g.status}${g.best_price ? ` · Best: ${inr(g.best_price)}` : ''}`;
    }).join('\n\n');

    ctx.reply(`📋 *Your Deal Goals*\n\n${lines}`, { parse_mode: 'Markdown' });
  });

  // Start polling
  bot.launch({ dropPendingUpdates: true })
    .then(() => console.log('[AlertBot] Bot started — polling for updates'))
    .catch(err => console.error('[AlertBot] Bot failed to start:', err));

  // Graceful shutdown
  process.once('SIGINT',  () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
}

// Send a message to a specific Telegram user (used by deal hunter notifications)
export async function sendTelegramAlert(userId: string, message: string): Promise<void> {
  if (!bot || !userId.startsWith('tg_')) return;
  const chatId = userId.replace('tg_', '');
  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn('[AlertBot] Failed to send alert to', chatId, e);
  }
}
