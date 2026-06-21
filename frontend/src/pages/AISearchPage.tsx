import React, { useState } from 'react';
import { Search, Sparkles, Loader2, Globe, PackagePlus, ChevronDown, ChevronUp } from 'lucide-react';
import { Product } from '../types';
import { api } from '../api/client';
import { inr } from '../utils/currency';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';

interface PlatformProduct {
  id?: number;
  name: string;
  description: string;
  category: string;
  current_price: number;
  original_price: number;
  platform: string;
  platform_url: string;
  image_url?: string;
  is_new?: boolean;
}

interface PlatformResult {
  platform: string;
  products: PlatformProduct[];
}

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (product: Product) => void;
}

const SUGGESTED_QUERIES = [
  'neutriderm moisturising lotion',
  'boAt earbuds under ₹2000',
  'running shoes for men',
  'vitamin C serum',
  'pressure cooker 5 litre',
  'smartwatch with calling',
];

const PLATFORM_COLORS: Record<string, string> = {
  'Flipkart':     'bg-blue-600',
  'Amazon India': 'bg-orange-500',
  'Myntra':       'bg-pink-600',
  'Meesho':       'bg-purple-600',
  'Snapdeal':     'bg-red-600',
  'Nykaa':        'bg-rose-500',
};

export default function AISearchPage({ favorites, onToggleFavorite }: Props) {
  const [query, setQuery] = useState('');
  const [platformResults, setPlatformResults] = useState<PlatformResult[]>([]);
  const [catalogResults, setCatalogResults] = useState<Product[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [newlyAdded, setNewlyAdded] = useState(0);
  const [collapsedPlatforms, setCollapsedPlatforms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  const togglePlatform = (platform: string) => {
    setCollapsedPlatforms((prev) => {
      const next = new Set(prev);
      next.has(platform) ? next.delete(platform) : next.add(platform);
      return next;
    });
  };

  const handleSearch = async (q = query) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setSearched(true);
    setError('');
    setPlatformResults([]);
    setCatalogResults([]);
    setTotalFound(0);
    setNewlyAdded(0);
    setCollapsedPlatforms(new Set());

    try {
      // Run platform search + catalog search in parallel
      const [platformRes, catalogData] = await Promise.allSettled([
        fetch('/api/ai/platform-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        }).then((r) => r.json()) as Promise<{ results: PlatformResult[]; totalProducts: number }>,
        api.aiSearch(q),
      ]);

      if (platformRes.status === 'fulfilled') {
        setPlatformResults(platformRes.value.results);
        setTotalFound(platformRes.value.totalProducts);
        const added = platformRes.value.results
          .flatMap((r) => r.products.filter((p) => p.is_new)).length;
        setNewlyAdded(added);
      } else {
        setError('Platform search failed — showing catalog results only.');
      }

      if (catalogData.status === 'fulfilled' && catalogData.value.products?.length) {
        // Only show catalog products not already covered by platform results
        const platformNames = new Set(
          (platformRes.status === 'fulfilled' ? platformRes.value.results : [])
            .flatMap((r) => r.products.map((p) => p.name.toLowerCase()))
        );
        const extra = catalogData.value.products.filter(
          (p: Product) => !platformNames.has(p.name.toLowerCase())
        );
        setCatalogResults(extra);
      }
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasResults = platformResults.length > 0 || catalogResults.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Globe className="text-blue-600" size={26} />
          <h1 className="text-2xl font-bold text-gray-800">AI Product Search</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Searches Flipkart, Amazon India, Myntra, Meesho, Snapdeal & Nykaa simultaneously
        </p>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search across Flipkart, Amazon, Myntra, Nykaa..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
          </div>
          <button
            onClick={() => handleSearch()} disabled={loading || !query.trim()}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 min-w-[110px] justify-center"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {!searched && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTED_QUERIES.map((q) => (
              <button key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
            <Loader2 size={28} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-blue-700 font-medium text-sm">
              AI agent searching Flipkart, Amazon India, Myntra, Meesho, Snapdeal, Nykaa...
            </p>
            <div className="flex justify-center gap-2 mt-3 flex-wrap">
              {['Flipkart', 'Amazon India', 'Myntra', 'Meesho', 'Snapdeal', 'Nykaa'].map((p) => (
                <span key={p} className={`text-white text-xs px-2 py-0.5 rounded-full animate-pulse ${PLATFORM_COLORS[p]}`}>
                  {p}
                </span>
              ))}
            </div>
            <p className="text-blue-400 text-xs mt-2">Products found will be auto-added to your catalog</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="max-w-2xl mx-auto mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm text-center">
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && searched && hasResults && (
        <div>
          {/* Summary */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-sm font-medium">
                Found <strong>{totalFound}</strong> products across <strong>{platformResults.length}</strong> platforms
              </span>
              {newlyAdded > 0 && (
                <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                  <PackagePlus size={13} /> {newlyAdded} new — added to catalog
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {platformResults.map((r) => (
                <span key={r.platform}
                  className={`text-white text-xs font-medium px-2.5 py-1 rounded-full ${PLATFORM_COLORS[r.platform] ?? 'bg-gray-500'}`}>
                  {r.platform} ({r.products.length})
                </span>
              ))}
            </div>
          </div>

          {/* Platform sections */}
          <div className="space-y-6">
            {platformResults.map((result) => (
              <div key={result.platform}>
                <button
                  onClick={() => togglePlatform(result.platform)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${PLATFORM_COLORS[result.platform] ?? 'bg-gray-500'}`}>
                      {result.platform}
                    </span>
                    <span className="text-sm text-gray-500">{result.products.length} products</span>
                  </div>
                  {collapsedPlatforms.has(result.platform)
                    ? <ChevronDown size={18} className="text-gray-400" />
                    : <ChevronUp size={18} className="text-gray-400" />}
                </button>

                {!collapsedPlatforms.has(result.platform) && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {result.products.map((p, i) => (
                      <PlatformProductCard
                        key={`${result.platform}-${i}`}
                        product={p}
                        isFavorite={p.id ? favorites.has(p.id) : false}
                        onToggleFavorite={() => p.id && onToggleFavorite(p as unknown as Product)}
                        onClick={() => p.id && setSelectedProduct(p as unknown as Product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Catalog extras (deduped) */}
            {catalogResults.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-700 text-white">
                    Also in your catalog
                  </span>
                  <span className="text-sm text-gray-500">{catalogResults.length} products</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catalogResults.map((p) => (
                    <ProductCard key={p.id} product={p}
                      isFavorite={favorites.has(p.id)}
                      onToggleFavorite={onToggleFavorite}
                      onClick={setSelectedProduct} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && searched && !hasResults && !error && (
        <div className="text-center py-16 text-gray-400">
          <Globe size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found for "{query}"</p>
          <p className="text-sm mt-1">Try a different search term or check your spelling.</p>
        </div>
      )}

      {/* Landing */}
      {!searched && !loading && (
        <div className="text-center py-12">
          <Globe size={56} className="mx-auto mb-4 text-gray-200" />
          <h2 className="text-base font-semibold text-gray-500 mb-1">Search across all platforms at once</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Our AI agent searches Flipkart, Amazon India, Myntra, Meesho, Snapdeal and Nykaa simultaneously.
            Products found are automatically added to your catalog for price tracking and alerts.
          </p>
        </div>
      )}

      <ProductDetailModal
        product={selectedProduct} onClose={() => setSelectedProduct(null)}
        isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

// ── Platform Product Card ─────────────────────────────────────────────────────
function PlatformProductCard({ product, isFavorite, onToggleFavorite, onClick }: {
  product: PlatformProduct;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const discount = product.original_price > product.current_price
    ? Math.round(((product.original_price - product.current_price) / product.original_price) * 100)
    : 0;
  const fallback = `https://placehold.co/300x200/e2e8f0/64748b?text=${encodeURIComponent(product.category || 'Product')}`;

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] bg-gray-50">
        <img
          src={imgErr ? fallback : (product.image_url || fallback)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={() => setImgErr(true)}
        />
        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </div>
        )}
        {product.is_new && (
          <div className="absolute top-2 right-8 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            New
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
            isFavorite ? 'bg-red-100 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
          }`}
        >
          ♥
        </button>
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-white text-xs font-semibold px-1.5 py-0.5 rounded ${PLATFORM_COLORS[product.platform] ?? 'bg-gray-500'}`}>
            {product.platform.replace(' India', '')}
          </span>
          <span className="text-xs text-gray-400 truncate">{product.category}</span>
        </div>
        <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1.5 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="flex items-end gap-1.5">
          <span className="text-sm font-bold text-gray-900">{inr(product.current_price)}</span>
          {discount > 0 && (
            <span className="text-xs text-gray-400 line-through">{inr(product.original_price)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
