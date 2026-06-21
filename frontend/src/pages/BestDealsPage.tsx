import React, { useState, useEffect } from 'react';
import { Tag, TrendingDown, RefreshCw, ExternalLink, Heart, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { BestDeal, Product } from '../types';
import { api } from '../api/client';
import { inr } from '../utils/currency';
import ProductDetailModal from '../components/ProductDetailModal';

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (product: Product) => void;
}

const DEAL_TIERS = [
  { min: 50, label: 'Mega Deal', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { min: 35, label: 'Hot Deal', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { min: 20, label: 'Great Deal', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  { min: 0,  label: 'Good Deal', color: 'bg-green-500',  text: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
];

function getTier(score: number) {
  return DEAL_TIERS.find((t) => score >= t.min) ?? DEAL_TIERS[DEAL_TIERS.length - 1];
}

function MiniSparkline({ high, current, avg }: { high: number; current: number; avg: number }) {
  // Simple 5-point sparkline showing the price trend
  const points = [high, high * 0.97, avg * 1.02, avg * 0.98, current];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const h = 32, w = 80;
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - ((p - min) / range) * h,
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} stroke="#3b82f6" strokeWidth="2" fill="none" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill="#10b981" />
    </svg>
  );
}

export default function BestDealsPage({ favorites, onToggleFavorite }: Props) {
  const [deals, setDeals] = useState<BestDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<'deal_score' | 'savings' | 'price'>('deal_score');
  const [filterCategory, setFilterCategory] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadDeals = async () => {
    setLoading(true);
    try {
      setDeals(await api.getBestDeals(30));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeals(); }, []);

  const categories = [...new Set(deals.map((d) => d.category))].sort();

  const sorted = [...deals]
    .filter((d) => !filterCategory || d.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'savings') return b.savings_vs_30d_high - a.savings_vs_30d_high;
      if (sortBy === 'price') return a.current_price - b.current_price;
      return b.deal_score - a.deal_score;
    });

  const megaDeals = sorted.filter((d) => d.deal_score >= 40);
  const otherDeals = sorted.filter((d) => d.deal_score < 40);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="text-red-500" size={24} />
            <h1 className="text-2xl font-bold text-gray-800">Best Deals</h1>
          </div>
          <p className="text-sm text-gray-500">
            Prices compared to 30-day high — updated every 30 minutes by AI agent
          </p>
        </div>
        <button
          onClick={loadDeals}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-600"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-blue-500' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterCategory ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCategory === c ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="deal_score">Best Deal Score</option>
            <option value="savings">Highest Savings (₹)</option>
            <option value="price">Lowest Price</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingDown size={48} className="mx-auto mb-3 opacity-30" />
          <p>No deals found. Price data is being collected.</p>
        </div>
      ) : (
        <>
          {/* Mega Deals Hero */}
          {megaDeals.length > 0 && !filterCategory && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-red-600">🔥 Mega Deals</span>
                <span className="text-sm text-gray-400">({megaDeals.length} products with 40%+ price drop from 30-day high)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {megaDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} isFavorite={favorites.has(deal.id)}
                    onToggleFavorite={onToggleFavorite} onClick={setSelectedProduct}
                    expanded={expandedId === deal.id} onToggleExpand={() => setExpandedId(expandedId === deal.id ? null : deal.id)} />
                ))}
              </div>
            </div>
          )}

          {/* All Deals */}
          <div>
            {megaDeals.length > 0 && !filterCategory && (
              <h2 className="text-lg font-bold text-gray-700 mb-3">More Deals</h2>
            )}
            <div className="space-y-3">
              {(filterCategory ? sorted : otherDeals).map((deal) => (
                <DealRow key={deal.id} deal={deal} isFavorite={favorites.has(deal.id)}
                  onToggleFavorite={onToggleFavorite} onClick={setSelectedProduct}
                  expanded={expandedId === deal.id} onToggleExpand={() => setExpandedId(expandedId === deal.id ? null : deal.id)} />
              ))}
            </div>
          </div>
        </>
      )}

      <ProductDetailModal
        product={selectedProduct} onClose={() => setSelectedProduct(null)}
        isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

// ── Deal Card (grid) ─────────────────────────────────────────────────────────
function DealCard({ deal, isFavorite, onToggleFavorite, onClick, expanded, onToggleExpand }: {
  deal: BestDeal; isFavorite: boolean;
  onToggleFavorite: (p: Product) => void;
  onClick: (p: Product) => void;
  expanded: boolean; onToggleExpand: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const tier = getTier(deal.deal_score);
  const fallback = `https://placehold.co/400x240/e2e8f0/64748b?text=${encodeURIComponent(deal.category)}`;

  return (
    <div className={`rounded-xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-all ${tier.bg}`}>
      <div className="relative cursor-pointer" onClick={() => onClick(deal)}>
        <img src={imgErr ? fallback : (deal.image_url || fallback)} alt={deal.name}
          className="w-full h-40 object-cover" onError={() => setImgErr(true)} />
        <div className={`absolute top-2 left-2 ${tier.color} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
          <TrendingDown size={11} /> {deal.deal_score}% OFF 30d High
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(deal); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full ${isFavorite ? 'bg-red-100 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'}`}
        >
          <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="p-3">
        <span className="text-xs font-medium text-gray-500">{deal.category} · {deal.platform}</span>
        <h3 className="text-sm font-bold text-gray-800 line-clamp-2 mb-2">{deal.name}</h3>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-xl font-bold text-gray-900">{inr(deal.current_price)}</div>
            <div className="text-xs text-gray-400">30d high: <span className="line-through">{inr(deal.high_30d)}</span></div>
          </div>
          <div className={`text-right ${tier.text}`}>
            <div className="font-bold text-sm">Save {inr(deal.savings_vs_30d_high)}</div>
            <div className="text-xs">{tier.label}</div>
          </div>
        </div>
        <PriceStatsBar deal={deal} />
      </div>
    </div>
  );
}

// ── Deal Row (list) ──────────────────────────────────────────────────────────
function DealRow({ deal, isFavorite, onToggleFavorite, onClick, expanded, onToggleExpand }: {
  deal: BestDeal; isFavorite: boolean;
  onToggleFavorite: (p: Product) => void;
  onClick: (p: Product) => void;
  expanded: boolean; onToggleExpand: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const tier = getTier(deal.deal_score);
  const fallback = `https://placehold.co/80x80/e2e8f0/64748b?text=${encodeURIComponent(deal.category[0])}`;

  return (
    <div className={`rounded-xl border overflow-hidden ${tier.bg}`}>
      <div className="flex items-center gap-4 p-4">
        <img src={imgErr ? fallback : (deal.image_url || fallback)} alt={deal.name}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer"
          onError={() => setImgErr(true)} onClick={() => onClick(deal)} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onClick(deal)}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${tier.color}`}>
              {deal.deal_score}% OFF 30d High
            </span>
            <span className="text-xs text-gray-400">{deal.category}</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{deal.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-base font-bold text-gray-900">{inr(deal.current_price)}</span>
            <span className="text-xs text-gray-400 line-through">{inr(deal.high_30d)}</span>
            <span className={`text-xs font-semibold ${tier.text}`}>Save {inr(deal.savings_vs_30d_high)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MiniSparkline high={deal.high_30d} current={deal.current_price} avg={deal.avg_30d} />
          <button onClick={() => onToggleFavorite(deal)}
            className={`p-1.5 rounded-full ${isFavorite ? 'bg-red-100 text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          {deal.platform_url && (
            <a href={deal.platform_url} target="_blank" rel="noopener noreferrer"
              className="text-gray-300 hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
              <ExternalLink size={15} />
            </a>
          )}
          <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600 p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-3 mt-3">
            {[
              { label: '30d High', value: inr(deal.high_30d), color: 'text-red-600' },
              { label: '30d Avg', value: inr(Math.round(deal.avg_30d)), color: 'text-orange-600' },
              { label: '30d Low', value: inr(deal.low_30d), color: 'text-green-600' },
              { label: 'Current', value: inr(deal.current_price), color: 'text-blue-600 font-bold' },
            ].map((s) => (
              <div key={s.label} className="text-center bg-white rounded-lg p-2 shadow-sm">
                <div className={`text-sm font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <PriceStatsBar deal={deal} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Based on {deal.price_points} price points over the last 30 days · Platform: {deal.platform}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Price position bar ───────────────────────────────────────────────────────
function PriceStatsBar({ deal }: { deal: BestDeal }) {
  const range = deal.high_30d - deal.low_30d || 1;
  const currentPct = Math.max(0, Math.min(100, ((deal.current_price - deal.low_30d) / range) * 100));
  const avgPct = Math.max(0, Math.min(100, ((deal.avg_30d - deal.low_30d) / range) * 100));

  return (
    <div>
      <div className="relative h-2 bg-gray-200 rounded-full mt-2">
        <div className="absolute h-2 bg-gradient-to-r from-green-400 to-red-400 rounded-full w-full opacity-30" />
        {/* avg marker */}
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-orange-400 rounded"
          style={{ left: `${avgPct}%` }} title={`30d avg: ${inr(Math.round(deal.avg_30d))}`} />
        {/* current price marker */}
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow"
          style={{ left: `calc(${currentPct}% - 6px)` }} title={`Current: ${inr(deal.current_price)}`} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Low {inr(deal.low_30d)}</span>
        <span className="text-blue-600 font-medium">Now {inr(deal.current_price)}</span>
        <span>High {inr(deal.high_30d)}</span>
      </div>
    </div>
  );
}
