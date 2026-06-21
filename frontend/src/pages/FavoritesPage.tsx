import React, { useState, useEffect } from 'react';
import { Heart, Bell, Trash2, Sparkles } from 'lucide-react';
import { Favorite, Product } from '../types';
import { api } from '../api/client';
import { inr } from '../utils/currency';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (product: Product) => void;
  onFavoritesRefresh: () => void;
}

export default function FavoritesPage({ favorites, onToggleFavorite, onFavoritesRefresh }: Props) {
  const [favoriteProducts, setFavoriteProducts] = useState<Favorite[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadFavorites = async () => {
    setLoading(true);
    try { setFavoriteProducts(await api.getFavorites()); }
    finally { setLoading(false); }
  };

  const loadRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const data = await api.getRecommendations();
      setRecommendations(data.products);
      setReasoning(data.reasoning);
    } catch { setRecommendations([]); }
    finally { setLoadingRecs(false); }
  };

  useEffect(() => { loadFavorites(); }, []);

  const handleRemove = async (productId: number) => {
    await api.removeFavorite(productId);
    onFavoritesRefresh();
    loadFavorites();
  };

  const handleThreshold = async (productId: number, threshold: number) => {
    await api.updateThreshold(productId, threshold);
    loadFavorites();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Heart className="text-red-500" size={22} />
          <h1 className="text-xl font-bold text-gray-800">My Wishlist</h1>
          <span className="text-sm text-gray-400">({favoriteProducts.length})</span>
        </div>
        <button
          onClick={loadRecommendations}
          disabled={loadingRecs}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {loadingRecs ? 'Getting Recs...' : 'AI Recommendations'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      ) : favoriteProducts.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={56} className="mx-auto mb-4 text-gray-200" />
          <h2 className="text-lg font-semibold text-gray-500 mb-2">No items in wishlist</h2>
          <p className="text-gray-400 text-sm">Browse trending products and add them to track prices.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {favoriteProducts.map((fav) => (
            <div key={fav.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="cursor-pointer" onClick={() => setSelectedProduct(fav as unknown as Product)}>
                <div className="relative">
                  <img
                    src={fav.image_url || `https://placehold.co/400x200/e2e8f0/64748b?text=${fav.category}`}
                    alt={fav.name}
                    className="w-full h-40 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/400x200/e2e8f0/64748b?text=${fav.category}`; }}
                  />
                  {fav.original_price > fav.current_price && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{Math.round(((fav.original_price - fav.current_price) / fav.original_price) * 100)}%
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{fav.name}</h3>
                  <p className="text-xs text-gray-400 mb-1">{fav.platform}</p>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-lg font-bold">{inr(fav.current_price)}</span>
                    {fav.original_price > fav.current_price && (
                      <span className="text-xs text-gray-400 line-through">{inr(fav.original_price)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 pb-3 border-t border-gray-50 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bell size={14} className="text-blue-500" />
                  <span className="text-xs text-gray-600">Alert at {Math.round(fav.price_alert_threshold * 100)}% price drop</span>
                </div>
                <input
                  type="range" min="5" max="50"
                  value={Math.round(fav.price_alert_threshold * 100)}
                  onChange={(e) => handleThreshold(fav.id, parseInt(e.target.value) / 100)}
                  className="w-full accent-blue-600 mb-2"
                />
                <button
                  onClick={() => handleRemove(fav.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                >
                  <Trash2 size={12} /> Remove from wishlist
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-purple-600" size={20} />
            <h2 className="text-lg font-bold text-gray-800">AI Recommended For You</h2>
          </div>
          {reasoning && (
            <p className="text-sm text-gray-500 mb-4 bg-purple-50 p-3 rounded-lg">{reasoning}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {recommendations.map((p) => (
              <ProductCard key={p.id} product={p} isFavorite={favorites.has(p.id)}
                onToggleFavorite={onToggleFavorite} onClick={setSelectedProduct} />
            ))}
          </div>
        </div>
      )}

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
