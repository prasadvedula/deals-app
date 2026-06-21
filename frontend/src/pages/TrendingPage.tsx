import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, Filter } from 'lucide-react';
import { Product } from '../types';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (product: Product) => void;
}

export default function TrendingPage({ favorites, onToggleFavorite }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { sort, limit: '24' };
      if (selectedCategory) params.category = selectedCategory;
      const [data, cats] = await Promise.all([
        api.getProducts(params),
        categories.length === 0 ? api.getCategories() : Promise.resolve(null),
      ]);
      setAllProducts(data.products);
      setProducts(data.products);
      if (cats) setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [sort, selectedCategory, categories.length]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const trending = allProducts.filter((p) => p.trending_score >= 80).slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero trending section */}
      {trending.length > 0 && !selectedCategory && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-orange-500" size={22} />
            <h2 className="text-xl font-bold text-gray-800">Hot Right Now</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trending.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={onToggleFavorite}
                onClick={setSelectedProduct}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter size={16} /> Filter:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              onClick={() => setSelectedCategory(c.category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === c.category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.category} <span className="opacity-60">({c.count})</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="trending">Trending</option>
            <option value="discount">Biggest Discount</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <button
            onClick={loadProducts}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isFavorite={favorites.has(p.id)}
              onToggleFavorite={onToggleFavorite}
              onClick={setSelectedProduct}
            />
          ))}
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
