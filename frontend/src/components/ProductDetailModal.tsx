import React, { useState, useEffect } from 'react';
import { X, Heart, ExternalLink, TrendingDown, AlertCircle, ShoppingCart } from 'lucide-react';
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

export default function ProductDetailModal({ product, onClose, isFavorite, onToggleFavorite }: Props) {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [crossPrices, setCrossPrices] = useState<CrossPlatformPrice[]>([]);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!product) return;
    setImgError(false);
    api.getProduct(product.id).then((data) => {
      setPriceHistory(data.priceHistory);
      setCrossPrices(data.crossPrices);
    }).catch(() => {});
  }, [product]);

  if (!product) return null;

  const discount = Math.round(
    ((product.original_price - product.current_price) / product.original_price) * 100
  );
  const fallback = `https://placehold.co/600x400/e2e8f0/64748b?text=${encodeURIComponent(product.category)}`;
  const bestPrice = crossPrices.length > 0
    ? Math.min(...crossPrices.map((p) => p.price), product.current_price)
    : product.current_price;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={imgError ? fallback : (product.image_url || fallback)}
            alt={product.name}
            className="w-full h-64 object-cover rounded-t-2xl"
            onError={() => setImgError(true)}
          />
          <button onClick={onClose} className="absolute top-4 right-4 bg-white/90 rounded-full p-1.5 hover:bg-white">
            <X size={18} />
          </button>
          {discount > 0 && (
            <div className="absolute top-4 left-4 bg-red-500 text-white font-bold px-3 py-1 rounded-full">
              -{discount}% OFF
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {product.category}
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-2">{product.name}</h2>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">{product.description}</p>
            </div>
            <button
              onClick={() => onToggleFavorite(product)}
              className={`flex-shrink-0 p-2 rounded-xl transition-colors ${
                isFavorite ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Pricing */}
          <div className="flex items-end gap-4 mb-6">
            <div>
              <div className="text-3xl font-bold text-gray-900">{inr(product.current_price)}</div>
              {discount > 0 && (
                <div className="text-gray-400 line-through text-sm">{inr(product.original_price)}</div>
              )}
            </div>
            {bestPrice < product.current_price && (
              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
                <TrendingDown size={14} />
                Best: {inr(bestPrice)}
              </div>
            )}
          </div>

          {/* Cross-platform prices */}
          {crossPrices.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingCart size={16} /> Price Comparison
              </h3>
              <div className="space-y-2">
                {[
                  { platform: product.platform, price: product.current_price, url: product.platform_url },
                  ...crossPrices,
                ]
                  .sort((a, b) => a.price - b.price)
                  .map((p) => (
                    <div
                      key={p.platform}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        p.price === bestPrice ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{p.platform}</span>
                        {p.price === bestPrice && (
                          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">Best</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{inr(p.price)}</span>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Price History Chart */}
          {priceHistory.length > 1 && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">Price History</h3>
              <PriceChart
                history={priceHistory}
                originalPrice={product.original_price}
                currentPrice={product.current_price}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
