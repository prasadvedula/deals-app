import React, { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, List, SlidersHorizontal, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Product } from '../types';
import { api } from '../api/client';
import { inr } from '../utils/currency';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (product: Product) => void;
}

const SORT_OPTIONS = [
  { value: 'trending',   label: 'Trending' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'discount',   label: 'Biggest Discount' },
];

const PAGE_SIZE = 24;

export default function CatalogPage({ favorites, onToggleFavorite }: Props) {
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Load category list once
  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const loadProducts = useCallback(async (cat: string, s: string, p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        sort: s,
        limit: String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
      };
      if (cat) params.category = cat;
      const data = await api.getProducts(params);
      setProducts(data.products);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts(selectedCategory, sort, page);
  }, [selectedCategory, sort, page, loadProducts]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function selectCategory(cat: string) {
    setSelectedCategory(cat);
    setPage(0);
  }

  function selectSort(s: string) {
    setSort(s);
    setPage(0);
  }

  const totalProducts = categories.reduce((s, c) => s + c.count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">

      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Categories</h2>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => selectCategory('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === '' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>All Products</span>
              <span className="text-xs text-gray-400">{totalProducts}</span>
            </button>
          </li>
          {categories.map(({ category, count }) => (
            <li key={category}>
              <button
                onClick={() => selectCategory(category)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{category}</span>
                <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{count}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {selectedCategory || 'All Products'}
            </h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Loading...' : `${total} product${total !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1.5 text-sm">
              <SlidersHorizontal size={14} className="text-gray-400" />
              <select
                value={sort}
                onChange={(e) => selectSort(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 ${view === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-1.5 ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Products */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Tag size={48} className="mx-auto mb-3 opacity-30" />
            <p>No products in this category yet.</p>
            <p className="text-sm mt-1">Use AI Search to discover and import products.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={onToggleFavorite}
                onClick={setSelectedProduct} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <ListRow key={p.id} product={p}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={onToggleFavorite}
                onClick={() => setSelectedProduct(p)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {page + 1} of {totalPages}
              <span className="text-gray-400 ml-2">({total} total)</span>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

// ── List row ─────────────────────────────────────────────────────────────────
function ListRow({ product, isFavorite, onToggleFavorite, onClick }: {
  product: Product;
  isFavorite: boolean;
  onToggleFavorite: (p: Product) => void;
  onClick: () => void;
}) {
  const discount = product.original_price > product.current_price
    ? Math.round(((product.original_price - product.current_price) / product.original_price) * 100)
    : 0;
  const [imgErr, setImgErr] = useState(false);
  const fallback = `https://placehold.co/80x80/e2e8f0/64748b?text=${encodeURIComponent(product.category?.[0] ?? '?')}`;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl p-3 hover:shadow-sm transition-shadow cursor-pointer"
    >
      <img
        src={imgErr ? fallback : (product.image_url || fallback)}
        alt={product.name}
        className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-50"
        onError={() => setImgErr(true)}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{product.category} · {product.platform}</p>
        <h3 className="text-sm font-semibold text-gray-800 truncate">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-base font-bold text-gray-900">{inr(product.current_price)}</p>
        {discount > 0 && (
          <>
            <p className="text-xs text-gray-400 line-through">{inr(product.original_price)}</p>
            <p className="text-xs text-green-600 font-semibold">{discount}% off</p>
          </>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }}
        className={`ml-2 p-2 rounded-full transition-colors flex-shrink-0 ${
          isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400'
        }`}
      >
        ♥
      </button>
    </div>
  );
}
