import React, { useState, useEffect } from 'react';
import {
  X, Heart, ExternalLink, TrendingDown, ShoppingCart, Star,
  ThumbsUp, ThumbsDown, Clock, TrendingUp, Minus, Loader2,
  AlertCircle, Layers, Calendar, Tag, Zap,
} from 'lucide-react';
import { Product, PriceHistory, CrossPlatformPrice } from '../types';
import { api } from '../api/client';
import { inr } from '../utils/currency';
import PriceChart from './PriceChart';

interface Props {
  product: Product | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
}

// ── Type definitions ─────────────────────────────────────────────────────────
interface AggregatedReview {
  overallTrustScore: number;
  verdict: string;
  recommendation: string;
  platforms: {
    platform: string; rating: number | null; review_count: number;
    pros: string[]; cons: string[]; summary: string; trust_score: number;
    source?: 'ai_knowledge' | 'scraped';
  }[];
}

interface PricePrediction {
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
  recommendation: 'buy_now' | 'wait' | 'at_lowest' | 'uncertain';
  recommendationText: string;
  predictedNextWeek: number | null;
  savingsIfWait: number;
  confidence: number;
}

interface MonthlyAvg {
  month: string; label: string; avgPrice: number; minPrice: number;
  maxPrice: number; dataPoints: number; saleEvents: string[];
}

interface DealDnaResult {
  allTimeHigh: number; allTimeLow: number; currentPrice: number; avgPrice: number;
  monthlyBreakdown: MonthlyAvg[];
  bestMonths: string[]; worstMonths: string[];
  patternInsight: string; savingsOpportunity: number;
}

interface CouponOffer {
  type: string; provider: string; discount: string;
  condition: string; stackable: boolean; estimatedSaving: number;
}

interface CouponStackResult {
  offers: CouponOffer[];
  bestStack: CouponOffer[];
  totalPotentialSaving: number;
  effectivePrice: number;
  stackingTip: string;
}

interface SeasonalEvent {
  name: string; platform: string; daysUntil: number; isActive: boolean;
  expectedDiscountPct: number; tip: string;
}

interface SeasonalAlert {
  upcomingEvents: SeasonalEvent[];
  currentlyInSale: SeasonalEvent | null;
  bestUpcomingEvent: SeasonalEvent | null;
  seasonalTip: string;
  expectedMaxDiscount: number;
}

type ModalTab = 'overview' | 'dna' | 'reviews' | 'coupons' | 'seasonal' | 'predict';

const TABS: { id: ModalTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',   icon: ShoppingCart },
  { id: 'dna',      label: 'Price Pulse', icon: Zap },
  { id: 'reviews',  label: 'Reviews',    icon: Star },
  { id: 'coupons',  label: 'Coupons',    icon: Tag },
  { id: 'seasonal', label: 'Sale Season',icon: Calendar },
  { id: 'predict',  label: 'Buy Timing', icon: Clock },
];

// ── Helper ────────────────────────────────────────────────────────────────────
function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="text-center py-10">
      <Loader2 size={24} className="animate-spin text-violet-400 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function EmptyPlaceholder({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <Icon size={36} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ProductDetailModal({ product, onClose, isFavorite, onToggleFavorite }: Props) {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [crossPrices, setCrossPrices]   = useState<CrossPlatformPrice[]>([]);
  const [imgError, setImgError]         = useState(false);
  const [activeTab, setActiveTab]       = useState<ModalTab>('overview');

  const [reviews,   setReviews]   = useState<AggregatedReview | null>(null);
  const [prediction, setPred]     = useState<PricePrediction | null>(null);
  const [dna,        setDna]      = useState<DealDnaResult | null>(null);
  const [coupons,    setCoupons]  = useState<CouponStackResult | null>(null);
  const [seasonal,   setSeasonal] = useState<SeasonalAlert | null>(null);

  const [loading, setLoading] = useState<Partial<Record<ModalTab, boolean>>>({});

  useEffect(() => {
    if (!product) return;
    setImgError(false);
    setActiveTab('overview');
    setReviews(null); setPred(null); setDna(null); setCoupons(null); setSeasonal(null);
    setLoading({});
    api.getProduct(product.id).then(d => { setPriceHistory(d.priceHistory); setCrossPrices(d.crossPrices); }).catch(() => {});
  }, [product]);

  async function loadTab(tab: ModalTab) {
    if (!product) return;
    setActiveTab(tab);
    const setL = (v: boolean) => setLoading(prev => ({ ...prev, [tab]: v }));

    if (tab === 'reviews'  && !reviews)   { setL(true); try { setReviews(await api.getReviews(product.id) as AggregatedReview);  } catch {} setL(false); }
    if (tab === 'predict'  && !prediction){ setL(true); try { setPred(await api.getPredict(product.id) as PricePrediction);       } catch {} setL(false); }
    if (tab === 'dna'      && !dna)       { setL(true); try { setDna(await api.getDealDna(product.id) as DealDnaResult);           } catch {} setL(false); }
    if (tab === 'coupons'  && !coupons)   { setL(true); try { setCoupons(await api.getCoupons(product.id) as CouponStackResult);  } catch {} setL(false); }
    if (tab === 'seasonal' && !seasonal)  { setL(true); try { setSeasonal(await api.getSeasonal(product.id) as SeasonalAlert);    } catch {} setL(false); }
  }

  if (!product) return null;

  const discount = Math.round(((product.original_price - product.current_price) / product.original_price) * 100);
  const fallback = `https://placehold.co/600x400/e2e8f0/64748b?text=${encodeURIComponent(product.category)}`;
  const bestPrice = crossPrices.length > 0
    ? Math.min(...crossPrices.map(p => p.price), product.current_price) : product.current_price;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Hero image */}
        <div className="relative">
          <img src={imgError ? fallback : (product.image_url || fallback)} alt={product.name}
            className="w-full h-52 object-cover rounded-t-2xl" onError={() => setImgError(true)} />
          <button onClick={onClose} className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 hover:bg-white shadow">
            <X size={18} />
          </button>
          {discount > 0 && (
            <div className="absolute top-3 left-3 bg-red-500 text-white font-bold px-3 py-1 rounded-full text-sm">
              -{discount}% OFF
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{product.category}</span>
              <h2 className="text-xl font-bold text-gray-900 mt-1.5 leading-tight">{product.name}</h2>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed line-clamp-2">{product.description}</p>
            </div>
            <button onClick={() => onToggleFavorite(product)}
              className={`flex-shrink-0 p-2 rounded-xl transition-colors ${isFavorite ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400 hover:text-red-400'}`}>
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Price */}
          <div className="flex items-end gap-3 mb-4">
            <div>
              <div className="text-3xl font-bold text-gray-900">{inr(product.current_price)}</div>
              {discount > 0 && <div className="text-gray-400 line-through text-sm">{inr(product.original_price)}</div>}
            </div>
            {bestPrice < product.current_price && (
              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
                <TrendingDown size={13} /> Best: {inr(bestPrice)}
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 flex-wrap mb-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => loadTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === id ? 'bg-violet-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <>
              {crossPrices.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Price Comparison</h3>
                  <div className="space-y-1.5">
                    {[{ platform: product.platform, price: product.current_price, url: product.platform_url }, ...crossPrices]
                      .sort((a, b) => a.price - b.price)
                      .map(p => (
                        <div key={p.platform} className={`flex items-center justify-between p-3 rounded-lg ${p.price === bestPrice ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">{p.platform}</span>
                            {p.price === bestPrice && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">Best</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{inr(p.price)}</span>
                            {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><ExternalLink size={13} /></a>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {priceHistory.length > 1 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Price History</h3>
                  <PriceChart history={priceHistory} originalPrice={product.original_price} currentPrice={product.current_price} />
                </div>
              )}
            </>
          )}

          {/* ── Deal DNA ── */}
          {activeTab === 'dna' && (
            <div>
              {loading.dna && <LoadingPlaceholder text="Analysing price DNA across history…" />}
              {!loading.dna && !dna && <EmptyPlaceholder icon={Zap} text="No price DNA data available." />}
              {dna && (
                <div className="space-y-4">
                  {/* AI insight */}
                  <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1.5">Price Pulse Insight</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{dna.patternInsight}</p>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'All-Time Low',  value: inr(dna.allTimeLow),  color: 'text-green-700 bg-green-50' },
                      { label: 'Average',        value: inr(dna.avgPrice),    color: 'text-blue-700 bg-blue-50' },
                      { label: 'All-Time High',  value: inr(dna.allTimeHigh), color: 'text-red-700 bg-red-50' },
                      { label: 'Save vs Low',    value: dna.savingsOpportunity > 0 ? inr(dna.savingsOpportunity) : '—', color: 'text-amber-700 bg-amber-50' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                        <p className="text-sm font-bold">{s.value}</p>
                        <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Best / worst months */}
                  {dna.bestMonths.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">Best Months to Buy</p>
                        {dna.bestMonths.map(m => <p key={m} className="text-xs text-green-600">• {m}</p>)}
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-red-700 mb-1">Most Expensive Months</p>
                        {dna.worstMonths.map(m => <p key={m} className="text-xs text-red-600">• {m}</p>)}
                      </div>
                    </div>
                  )}

                  {/* Monthly chart */}
                  {dna.monthlyBreakdown.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Price Breakdown</p>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {dna.monthlyBreakdown.map(m => {
                          const pct = dna.allTimeHigh > 0 ? (m.avgPrice / dna.allTimeHigh) * 100 : 50;
                          return (
                            <div key={m.month} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-20 flex-shrink-0">{m.label}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-gray-700">{inr(m.avgPrice)}</span>
                              </div>
                              {m.saleEvents.length > 0 && (
                                <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full flex-shrink-0 truncate max-w-[90px]">{m.saleEvents[0]}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Reviews ── */}
          {activeTab === 'reviews' && (
            <div>
              {loading.reviews && <LoadingPlaceholder text="Aggregating reviews across platforms…" />}
              {!loading.reviews && !reviews && <EmptyPlaceholder icon={Star} text="No review data available." />}
              {reviews && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-blue-50 rounded-xl p-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-700">{reviews.overallTrustScore.toFixed(1)}</div>
                      <div className="text-xs text-blue-500">Trust Score</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{reviews.verdict}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{reviews.recommendation}</p>
                    </div>
                  </div>
                  {reviews.platforms.map(p => (
                    <div key={p.platform} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800">{p.platform}</span>
                        <div className="flex items-center gap-2">
                          {p.rating != null && <>
                            <Star size={13} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-bold">{p.rating.toFixed(1)}</span>
                          </>}
                          {p.review_count > 0 && <span className="text-xs text-gray-400">({p.review_count.toLocaleString()})</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.source === 'scraped' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            {p.source === 'scraped' ? 'Live' : 'AI'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{p.summary}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1"><ThumbsUp size={11} /> Pros</p>
                          <ul className="space-y-0.5">{p.pros.map((pro, i) => <li key={i} className="text-xs text-gray-600">• {pro}</li>)}</ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-red-500 mb-1 flex items-center gap-1"><ThumbsDown size={11} /> Cons</p>
                          <ul className="space-y-0.5">{p.cons.map((con, i) => <li key={i} className="text-xs text-gray-600">• {con}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Coupons ── */}
          {activeTab === 'coupons' && (
            <div>
              {loading.coupons && <LoadingPlaceholder text="Finding best coupon stacks…" />}
              {!loading.coupons && !coupons && <EmptyPlaceholder icon={Tag} text="No coupon data available." />}
              {coupons && (
                <div className="space-y-4">
                  {/* Best stack summary */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-green-800 flex items-center gap-1.5"><Layers size={15} /> Best Stack</p>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Effective Price</p>
                        <p className="text-lg font-bold text-green-700">{inr(Math.round(coupons.effectivePrice))}</p>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 mb-3">{coupons.stackingTip}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {coupons.bestStack.map((o, i) => (
                        <span key={i} className="text-xs bg-green-100 text-green-800 font-medium px-2 py-1 rounded-full">
                          {o.provider} • {o.discount}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-green-600 mt-2 font-semibold">Total savings: {inr(Math.round(coupons.totalPotentialSaving))}</p>
                  </div>

                  {/* All offers */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Available Offers</p>
                    <div className="space-y-2">
                      {coupons.offers.map((offer, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                          <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                            offer.type === 'bank_card' ? 'bg-blue-100 text-blue-700' :
                            offer.type === 'wallet' ? 'bg-purple-100 text-purple-700' :
                            offer.type === 'emi' ? 'bg-amber-100 text-amber-700' :
                            offer.type === 'exchange' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {offer.type.replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{offer.provider}</p>
                            <p className="text-xs text-gray-600 font-medium">{offer.discount}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{offer.condition}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-green-700">-{inr(offer.estimatedSaving)}</p>
                            {offer.stackable && <span className="text-xs bg-green-100 text-green-600 px-1 py-0.5 rounded">Stackable</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Seasonal ── */}
          {activeTab === 'seasonal' && (
            <div>
              {loading.seasonal && <LoadingPlaceholder text="Checking Indian sale calendar…" />}
              {!loading.seasonal && !seasonal && <EmptyPlaceholder icon={Calendar} text="No seasonal data available." />}
              {seasonal && (
                <div className="space-y-4">
                  {/* Main tip */}
                  <div className={`rounded-xl p-4 ${seasonal.currentlyInSale ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{seasonal.seasonalTip}</p>
                    {seasonal.expectedMaxDiscount > 0 && (
                      <p className="text-xs text-gray-500 mt-2">Expected max discount in this category: <strong className="text-green-700">{seasonal.expectedMaxDiscount}% off</strong></p>
                    )}
                  </div>

                  {/* Currently live sale */}
                  {seasonal.currentlyInSale && (
                    <div className="bg-red-100 border border-red-300 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-800">{seasonal.currentlyInSale.name} is LIVE</p>
                        <p className="text-xs text-red-600">{seasonal.currentlyInSale.platform} · Up to {seasonal.currentlyInSale.expectedDiscountPct}% off</p>
                      </div>
                    </div>
                  )}

                  {/* Upcoming events */}
                  {seasonal.upcomingEvents.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming Sale Events</p>
                      <div className="space-y-2">
                        {seasonal.upcomingEvents.map((e, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3">
                            <div className={`text-center flex-shrink-0 w-14 rounded-lg py-1 ${i === 0 ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                              <p className="text-lg font-bold leading-none">{e.daysUntil}</p>
                              <p className="text-xs">days</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{e.name}</p>
                              <p className="text-xs text-gray-400">{e.platform}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.tip}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs font-bold text-green-700">~{e.expectedDiscountPct}%</p>
                              <p className="text-xs text-gray-400">off</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Buy Timing ── */}
          {activeTab === 'predict' && (
            <div>
              {loading.predict && <LoadingPlaceholder text="Analysing 30-day price trend…" />}
              {!loading.predict && !prediction && <EmptyPlaceholder icon={Clock} text="Not enough price history for prediction." />}
              {prediction && (
                <div className="space-y-4">
                  <div className={`border rounded-xl p-4 ${
                    prediction.recommendation === 'buy_now' || prediction.recommendation === 'at_lowest'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : prediction.recommendation === 'wait'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    <p className="font-bold text-base">
                      {prediction.recommendation === 'buy_now'   ? 'Buy Now' :
                       prediction.recommendation === 'at_lowest' ? 'At Lowest Price — Buy Now!' :
                       prediction.recommendation === 'wait'      ? 'Wait for Better Price' : 'Uncertain'}
                    </p>
                    <p className="text-sm mt-1">{prediction.recommendationText}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {prediction.trend === 'rising'  && <TrendingUp size={14} className="text-red-500" />}
                        {prediction.trend === 'falling' && <TrendingDown size={14} className="text-green-500" />}
                        {prediction.trend === 'stable'  && <Minus size={14} className="text-gray-400" />}
                        {prediction.trend === 'volatile'&& <AlertCircle size={14} className="text-amber-500" />}
                        <span className="text-xs font-semibold text-gray-500 capitalize">{prediction.trend}</span>
                      </div>
                      <p className="text-xs text-gray-400">Trend</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-gray-800">{prediction.predictedNextWeek ? inr(prediction.predictedNextWeek) : '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Predicted (7d)</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-gray-800">{prediction.confidence}%</p>
                      <p className="text-xs text-gray-400 mt-0.5">Confidence</p>
                    </div>
                  </div>
                  {prediction.savingsIfWait > 0 && (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      Potential savings if you wait: <strong>{inr(prediction.savingsIfWait)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
