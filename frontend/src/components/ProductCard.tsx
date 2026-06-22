import React, { useState } from 'react';
import { Heart, TrendingUp, ExternalLink, Bell } from 'lucide-react';
import { Product } from '../types';
import { inr } from '../utils/currency';

function dealScore(product: Product): number {
  const discountPct = product.original_price > product.current_price
    ? ((product.original_price - product.current_price) / product.original_price) * 100
    : 0;
  const bonus = discountPct > 30 ? 15 : discountPct > 15 ? 7 : 0;
  return Math.min(100, Math.round(discountPct * 0.5 + product.trending_score * 0.35 + bonus));
}

function ScoreBadge({ score }: { score: number }) {
  if (score < 40) return null;
  const cfg =
    score >= 80 ? { bg: 'bg-green-500',  label: 'Hot Deal' } :
    score >= 65 ? { bg: 'bg-amber-400',  label: 'Good Deal' } :
                  { bg: 'bg-blue-400',   label: 'Fair Deal' };
  return (
    <div className={`absolute bottom-2 left-2 ${cfg.bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5`}>
      <span>{score}</span>
      <span className="opacity-80">· {cfg.label}</span>
    </div>
  );
}

interface Props {
  product: Product;
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
  onClick?: (product: Product) => void;
}

export default function ProductCard({ product, isFavorite = false, onToggleFavorite, onClick }: Props) {
  const [imgError, setImgError] = useState(false);
  const discount = Math.round(((product.original_price - product.current_price) / product.original_price) * 100);
  const fallbackImg = `https://placehold.co/400x300/e2e8f0/64748b?text=${encodeURIComponent(product.category)}`;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer group"
      onClick={() => onClick?.(product)}
    >
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        <img
          src={imgError ? fallbackImg : (product.image_url || fallbackImg)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={() => setImgError(true)}
        />
        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discount}%
          </div>
        )}
        {product.trending_score > 80 && (
          <div className="absolute top-2 right-10 bg-orange-400 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={10} /> Hot
          </div>
        )}
        <ScoreBadge score={dealScore(product)} />
        <button
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
            isFavorite ? 'bg-red-100 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
          }`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(product); }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {product.category}
          </span>
          <span className="text-xs text-gray-400">{product.platform}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">{inr(product.current_price)}</div>
            {discount > 0 && (
              <div className="text-xs text-gray-400 line-through">{inr(product.original_price)}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isFavorite && (
              <span title="Price alert active">
                <Bell size={14} className="text-blue-400" />
              </span>
            )}
            {product.platform_url && (
              <a
                href={product.platform_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
