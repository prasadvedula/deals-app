import React, { useState, useEffect } from 'react';
import { Bot, Target, BarChart3, RefreshCw, Plus, Trash2, CheckCircle, Eye, AlertCircle, Loader2, TrendingDown, TrendingUp, Minus, Zap } from 'lucide-react';
import { api } from '../api/client';
import { inr } from '../utils/currency';

type Tab = 'supervisor' | 'goals' | 'report';

interface DealGoal {
  id: number; query: string; max_price: number | null;
  status: 'watching' | 'found' | 'dismissed';
  best_price: number | null; last_checked: string | null; created_at: string;
}

interface TopDeal {
  id: number; name: string; platform: string;
  current_price: number; original_price: number; discount_pct: number; image_url: string;
}

interface CategoryInsight {
  category: string; product_count: number;
  avg_price: number; avg_discount: number; top_product: string;
}

interface WeeklyReport {
  week_start: string; total_products: number; price_drops: number; new_products: number;
  top_deals: TopDeal[]; category_insights: CategoryInsight[]; ai_summary: string; generated_at: string;
}

interface SupervisorResult {
  intent: string;
  output: Record<string, unknown>;
  error?: string;
}

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>('supervisor');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center">
          <Bot size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">AI Agents</h1>
          <p className="text-sm text-gray-400">LangGraph-powered agentic workflows</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {([
          { id: 'supervisor', label: 'Supervisor Chat', icon: Zap },
          { id: 'goals',      label: 'Deal Goals',     icon: Target },
          { id: 'report',     label: 'Weekly Report',  icon: BarChart3 },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'supervisor' && <SupervisorTab />}
      {tab === 'goals'      && <GoalsTab />}
      {tab === 'report'     && <ReportTab />}
    </div>
  );
}

const INTENT_LABELS: Record<string, string> = {
  price_search:  'Price Search',
  deal_hunter:   'Deal Hunter',
  review:        'Review Aggregator',
  budget:        'Budget Advisor',
  predictor:     'Buy Timing',
  report:        'Weekly Report',
  deal_dna:      'Price Pulse',
  coupon_stack:  'Coupon Advisor',
  seasonal:      'Sale Season',
  mood:          'Mood Shopping',
  general:       'Assistant',
};

const INTENT_COLORS: Record<string, string> = {
  price_search:  'bg-blue-100 text-blue-700',
  deal_hunter:   'bg-red-100 text-red-700',
  review:        'bg-purple-100 text-purple-700',
  budget:        'bg-green-100 text-green-700',
  predictor:     'bg-pink-100 text-pink-700',
  report:        'bg-amber-100 text-amber-700',
  deal_dna:      'bg-emerald-100 text-emerald-700',
  coupon_stack:  'bg-orange-100 text-orange-700',
  seasonal:      'bg-cyan-100 text-cyan-700',
  mood:          'bg-fuchsia-100 text-fuchsia-700',
  general:       'bg-gray-100 text-gray-600',
};

// ── Supervisor Tab ──────────────────────────────────────────────────────────
function SupervisorTab() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SupervisorResult | null>(null);

  const SUGGESTIONS = [
    'Best phone under 25k for IT professional',
    'Laptop under 50k for college student',
    'What coupons can I stack on OnePlus TV?',
    'Price history of boAt earbuds',
    'When is the next Big Billion Days sale?',
    'I\'m stressed, suggest something under ₹1000',
    'Should I buy the Samsung Galaxy now?',
    'What are this week\'s top deals?',
  ];

  async function send(msg = message) {
    if (!msg.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.agentChat(msg.trim()) as SupervisorResult;
      setResult(res);
    } catch (e) {
      setResult({ intent: 'error', output: { type: 'error', answer: String(e) } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-700">
        <strong>LangGraph Supervisor</strong> — routes your request to the right specialist agent:
        price search, deal hunter, review aggregator, budget optimizer, price predictor, or report generator.
      </div>

      <div className="flex gap-2">
        <input value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask the supervisor anything about deals…"
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        <button onClick={() => send()} disabled={loading || !message.trim()}
          className="px-5 py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
          Ask
        </button>
      </div>

      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setMessage(s); send(s); }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-violet-50 hover:text-violet-600 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-center">
          <Loader2 size={28} className="animate-spin text-violet-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Supervisor routing to specialist agent…</p>
        </div>
      )}

      {result && !loading && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          {/* Intent badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${INTENT_COLORS[result.intent] ?? 'bg-gray-100 text-gray-600'}`}>
              {INTENT_LABELS[result.intent] ?? result.intent}
            </span>
            {result.error && <span className="text-xs text-red-500">⚠ {result.error}</span>}
          </div>

          {(result.output as Record<string, unknown>)?.type === 'budget' && (
            <div className="space-y-3">
              {!!(result.output.productType || result.output.budget) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {!!result.output.productType && (
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full capitalize">
                      🔍 {result.output.productType as string}
                    </span>
                  )}
                  {!!result.output.budget && (
                    <span className="bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                      💰 Under {inr(result.output.budget as number)}
                    </span>
                  )}
                  {!!result.output.useCase && (
                    <span className="bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                      👤 {result.output.useCase as string}
                    </span>
                  )}
                </div>
              )}

              {!!result.output.summary && (
                <p className="text-sm text-gray-700 leading-relaxed bg-violet-50 rounded-xl px-4 py-3">
                  {result.output.summary as string}
                </p>
              )}

              {!!result.output.noResults && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                  Use the <strong>Find</strong> tab in the navbar to search across Flipkart, Amazon India and more — results get added to the catalog automatically.
                </div>
              )}

              {/* Product list */}
              {Array.isArray(result.output.products) && (result.output.products as unknown[]).length > 0 && (
                <div className="space-y-1.5">
                  {(result.output.products as { name: string; current_price: number; platform: string; discount_pct?: number }[])
                    .slice(0, 5).map((p, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        {i === 0 && <span className="text-xs bg-green-500 text-white font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">Best</span>}
                        <span className="text-sm text-gray-700 truncate flex-1">{p.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{p.platform}</span>
                        {p.discount_pct != null && p.discount_pct > 0 && (
                          <span className="text-xs text-green-600 font-semibold flex-shrink-0">{p.discount_pct}% off</span>
                        )}
                        <span className="font-bold text-gray-900 flex-shrink-0">{inr(p.current_price)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {result.output?.type === 'price_search' && !!result.output.results && (
            <div className="space-y-3">
              {(result.output.results as { platform: string; products: { name: string; current_price: number }[] }[]).map(r => (
                <div key={r.platform}>
                  <p className="text-xs font-semibold text-gray-500 mb-1">{r.platform}</p>
                  <div className="space-y-1">
                    {r.products.slice(0, 2).map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-gray-700 truncate flex-1">{p.name}</span>
                        <span className="font-bold text-gray-900 ml-3">{inr(p.current_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Price Pulse (deal_dna) ── */}
          {result.output?.type === 'deal_dna' && !!result.output.found && (() => {
            const dna = result.output.dna as Record<string, unknown>;
            return (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed bg-emerald-50 rounded-xl px-4 py-3">
                  {dna.patternInsight as string}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'All-Time Low', val: inr(dna.allTimeLow as number), cls: 'bg-green-50 text-green-700' },
                    { label: 'Average',      val: inr(dna.avgPrice as number),    cls: 'bg-gray-50 text-gray-700'  },
                    { label: 'All-Time High',val: inr(dna.allTimeHigh as number), cls: 'bg-red-50 text-red-600'   },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl py-2.5 px-2 ${s.cls}`}>
                      <div className="text-xs font-medium opacity-70">{s.label}</div>
                      <div className="font-bold text-sm mt-0.5">{s.val}</div>
                    </div>
                  ))}
                </div>
                {(dna.bestMonths as string[])?.length > 0 && (
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-gray-500">Best months:</span>
                    {(dna.bestMonths as string[]).map(m => (
                      <span key={m} className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{m}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Coupon Stack ── */}
          {result.output?.type === 'coupon_stack' && !!result.output.found && (() => {
            const c = result.output.coupons as Record<string, unknown>;
            const offers = c.offers as Array<{ type: string; provider: string; discount: string; condition: string; stackable: boolean; estimatedSaving: number }>;
            return (
              <div className="space-y-3">
                <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-orange-600">Best Stack — Effective Price</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{inr(c.effectivePrice as number)}</p>
                    <p className="text-xs text-orange-700 mt-0.5">{c.stackingTip as string}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total saving</p>
                    <p className="text-lg font-bold text-green-600">{inr(c.totalPotentialSaving as number)}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {offers?.slice(0, 5).map((o, i) => (
                    <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">{o.type.replace('_', ' ')}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-800">{o.provider}</span>
                        <span className="text-sm text-gray-600"> — {o.discount}</span>
                        <p className="text-xs text-gray-400 truncate">{o.condition}</p>
                      </div>
                      {o.estimatedSaving > 0 && <span className="text-xs text-green-600 font-bold flex-shrink-0">{inr(o.estimatedSaving)} off</span>}
                      {o.stackable && <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded flex-shrink-0">stackable</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Seasonal ── */}
          {result.output?.type === 'seasonal' && !!result.output.found && (() => {
            const alerts = result.output.alerts as Record<string, unknown>;
            const events = alerts.upcomingEvents as Array<{ name: string; platform: string; daysUntil: number; isActive: boolean; expectedDiscountPct: number; tip: string }>;
            const live   = alerts.currentlyInSale as { name: string; platform: string } | null;
            return (
              <div className="space-y-3">
                {live && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
                    <p className="text-sm font-semibold text-red-700">🔴 Live Sale: {live.name} on {live.platform}</p>
                  </div>
                )}
                <p className="text-sm text-cyan-800 bg-cyan-50 rounded-xl px-4 py-3 leading-relaxed">
                  {alerts.seasonalTip as string}
                </p>
                <div className="space-y-1.5">
                  {events?.slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <span className="text-xs bg-cyan-100 text-cyan-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {e.isActive ? 'LIVE' : `${e.daysUntil}d`}
                      </span>
                      <span className="text-sm text-gray-800 flex-1 font-medium">{e.name}</span>
                      <span className="text-xs text-gray-400">{e.platform}</span>
                      <span className="text-xs text-green-600 font-bold">up to {e.expectedDiscountPct}% off</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Mood Shopping ── */}
          {result.output?.type === 'mood' && !!result.output.found && (() => {
            const products = result.output.products as Array<{ name: string; current_price: number; platform: string; discount_pct: number }>;
            return (
              <div className="space-y-3">
                <p className="text-sm text-fuchsia-800 leading-relaxed bg-fuchsia-50 rounded-xl px-4 py-3">
                  {result.output.summary as string}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {products?.map((p, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-0.5">
                      <p className="text-sm text-gray-800 font-semibold leading-snug line-clamp-2">{p.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{inr(p.current_price)}</span>
                        {p.discount_pct > 0 && <span className="text-xs text-green-600 font-semibold">{p.discount_pct}% off</span>}
                        <span className="text-xs text-gray-400">{p.platform}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Catch-all text (review / predictor / deal_hunter / general / not-found) ── */}
          {!['budget','price_search','deal_dna','coupon_stack','seasonal','mood'].includes(result.output?.type as string) &&
            !!(result.output?.answer || result.output?.summary || result.output?.message) && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {(result.output.answer ?? result.output.summary ?? result.output.message) as string}
            </p>
          )}

          {/* not-found message for new agents */}
          {['deal_dna','coupon_stack','seasonal','mood'].includes(result.output?.type as string) &&
            !result.output.found && !!result.output.message && (
            <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              {result.output.message as string}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Goals Tab ───────────────────────────────────────────────────────────────
function GoalsTab() {
  const [goals, setGoals] = useState<DealGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try { setGoals(await api.getGoals() as DealGoal[]); }
    catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!query.trim()) return;
    setCreating(true);
    try {
      await api.createGoal(query.trim(), maxPrice ? parseFloat(maxPrice) : undefined);
      setQuery(''); setMaxPrice(''); setShowForm(false);
      await load();
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function dismiss(id: number) {
    await api.dismissGoal(id);
    setGoals(g => g.filter(x => x.id !== id));
  }

  const active    = goals.filter(g => g.status === 'watching');
  const found     = goals.filter(g => g.status === 'found');
  const dismissed = goals.filter(g => g.status === 'dismissed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{active.length} watching · {found.length} matched</p>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700">
          <Plus size={15} /> New Goal
        </button>
      </div>

      {showForm && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-violet-800">Set a Deal Goal</p>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="What are you looking for? (e.g. boAt earbuds)"
            className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
          <div className="flex gap-2">
            <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
              placeholder="Max price ₹ (optional)"
              type="number" className="flex-1 px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
            <button onClick={create} disabled={creating || !query.trim()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
              Watch
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10"><Loader2 size={24} className="animate-spin text-violet-400 mx-auto" /></div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No deal goals yet</p>
          <p className="text-sm mt-1">Set a goal and we'll alert you when the price drops.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...found, ...active, ...dismissed].map(goal => (
            <div key={goal.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${
              goal.status === 'found' ? 'border-green-200 bg-green-50' :
              goal.status === 'dismissed' ? 'opacity-50 border-gray-100' : 'border-gray-100'
            }`}>
              <div className="flex-shrink-0">
                {goal.status === 'found'     && <CheckCircle size={20} className="text-green-500" />}
                {goal.status === 'watching'  && <Eye size={20} className="text-violet-500" />}
                {goal.status === 'dismissed' && <AlertCircle size={20} className="text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{goal.query}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {goal.max_price ? `Target: ${inr(goal.max_price)}` : 'No price limit'}
                  {goal.best_price ? ` · Best found: ${inr(goal.best_price)}` : ''}
                  {goal.last_checked ? ` · Checked ${new Date(goal.last_checked).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  goal.status === 'found'     ? 'bg-green-100 text-green-700' :
                  goal.status === 'watching'  ? 'bg-violet-100 text-violet-700' :
                  'bg-gray-100 text-gray-400'
                }`}>{goal.status}</span>
                {goal.status !== 'dismissed' && (
                  <button onClick={() => dismiss(goal.id)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report Tab ───────────────────────────────────────────────────────────────
function ReportTab() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try { setReport(await api.getReport() as WeeklyReport); }
    catch { /* ignore */ }
    setLoading(false);
  }

  async function regenerate() {
    setGenerating(true);
    try { setReport(await api.genReport() as WeeklyReport); }
    catch { /* ignore */ }
    setGenerating(false);
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="text-center py-16"><Loader2 size={28} className="animate-spin text-violet-400 mx-auto" /></div>;

  if (!report) return (
    <div className="text-center py-16 text-gray-400">
      <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
      <p>No report available.</p>
      <button onClick={regenerate} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm">Generate Now</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Week of {report.week_start}</p>
          <p className="text-xs text-gray-400">Generated {new Date(report.generated_at).toLocaleString()}</p>
        </div>
        <button onClick={regenerate} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Products Tracked', value: report.total_products, icon: BarChart3, color: 'blue' },
          { label: 'Price Drops',      value: report.price_drops,    icon: TrendingDown, color: 'green' },
          { label: 'New Additions',    value: report.new_products,   icon: Plus, color: 'violet' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4 text-center`}>
            <Icon size={20} className={`text-${color}-500 mx-auto mb-1`} />
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-2">AI Executive Summary</p>
        <p className="text-sm text-gray-700 leading-relaxed">{report.ai_summary}</p>
      </div>

      {/* Top Deals */}
      {report.top_deals?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">🔥 Top Deals This Week</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {report.top_deals.map(deal => (
              <div key={deal.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                {deal.image_url && (
                  <img src={deal.image_url} alt={deal.name}
                    className="w-full h-24 object-cover bg-gray-50" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-700 line-clamp-2">{deal.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-gray-900">{inr(deal.current_price)}</span>
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{deal.discount_pct}% off</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{deal.platform}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Insights */}
      {report.category_insights?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">📊 Category Breakdown</p>
          <div className="space-y-2">
            {report.category_insights.map(cat => (
              <div key={cat.category} className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{cat.category}</p>
                  <p className="text-xs text-gray-400 truncate">Top: {cat.top_product}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">{inr(cat.avg_price)}</p>
                  <p className="text-xs text-green-600 font-medium">{cat.avg_discount}% avg off</p>
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{cat.product_count} products</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
