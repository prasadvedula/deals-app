import React, { useState } from 'react';
import { Sparkles, Loader2, ShoppingBag, Heart, Gift, Zap, DollarSign, Star } from 'lucide-react';
import { api } from '../api/client';
import { Product } from '../types';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import { inr } from '../utils/currency';

interface MoodOption {
  emoji: string;
  label: string;
  prompt: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    emoji: '🎁', label: 'Gift Idea',
    prompt: 'I need a gift idea — something presentable and memorable',
    description: 'Find something they\'ll love',
    icon: Gift, gradient: 'from-pink-500 to-rose-500',
  },
  {
    emoji: '✨', label: 'Treat Myself',
    prompt: 'I want to treat myself to something premium and indulgent',
    description: 'You deserve it',
    icon: Sparkles, gradient: 'from-violet-500 to-purple-600',
  },
  {
    emoji: '💸', label: 'Best Value',
    prompt: 'I want the best value for money — maximum quality per rupee',
    description: 'Smart shopper mode',
    icon: DollarSign, gradient: 'from-green-500 to-emerald-600',
  },
  {
    emoji: '⚡', label: 'Surprise Me',
    prompt: 'Surprise me with the most exciting deal right now',
    description: 'Life\'s a lucky dip',
    icon: Zap, gradient: 'from-yellow-500 to-orange-500',
  },
  {
    emoji: '🛍️', label: 'Everyday Essentials',
    prompt: 'I need something practical and useful for daily life',
    description: 'Useful, not flashy',
    icon: ShoppingBag, gradient: 'from-blue-500 to-cyan-600',
  },
  {
    emoji: '⭐', label: 'Most Popular',
    prompt: 'Show me what\'s trending and most loved by shoppers',
    description: 'What everyone\'s buying',
    icon: Star, gradient: 'from-amber-500 to-yellow-500',
  },
];

const BUDGET_OPTIONS = [
  { label: 'Any Budget', value: undefined },
  { label: 'Under ₹500', value: 500 },
  { label: 'Under ₹1,000', value: 1000 },
  { label: 'Under ₹2,000', value: 2000 },
  { label: 'Under ₹5,000', value: 5000 },
  { label: 'Under ₹10,000', value: 10000 },
];

interface Props {
  favorites: Set<number>;
  onToggleFavorite: (p: Product) => void;
}

export default function MoodSearchPage({ favorites, onToggleFavorite }: Props) {
  const [customMood, setCustomMood]     = useState('');
  const [budget, setBudget]             = useState<number | undefined>();
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<{ moodCategory: string; reasoning: string; products: Product[] } | null>(null);
  const [activeMood, setActiveMood]     = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  async function search(moodText: string) {
    if (!moodText.trim() || loading) return;
    setLoading(true);
    setActiveMood(moodText);
    setResults(null);
    try {
      const data = await api.moodSearch(moodText.trim(), budget);
      setResults(data);
    } catch {
      setResults({ moodCategory: 'general', reasoning: 'Could not fetch results.', products: [] });
    }
    setLoading(false);
  }

  const MOOD_EMOJI_MAP: Record<string, string> = {
    treat_myself: '✨', gift_idea: '🎁', budget_buy: '💸',
    practical: '🛍️', surprise_me: '⚡', festival: '🪔', general: '⭐',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Mood Shopping</h1>
        <p className="text-gray-500 mt-2 text-sm">Tell us how you feel — AI finds the perfect products</p>
      </div>

      {/* Mood chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {MOOD_OPTIONS.map(mood => (
          <button
            key={mood.label}
            onClick={() => search(mood.prompt)}
            className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:scale-105 active:scale-100 bg-gradient-to-br ${mood.gradient} text-white shadow-md hover:shadow-xl`}
          >
            <div className="text-2xl mb-1">{mood.emoji}</div>
            <div className="font-bold text-sm">{mood.label}</div>
            <div className="text-xs opacity-80 mt-0.5">{mood.description}</div>
          </button>
        ))}
      </div>

      {/* Budget filter */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {BUDGET_OPTIONS.map(b => (
          <button key={b.label} onClick={() => setBudget(b.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              budget === b.value ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Custom mood input */}
      <div className="flex gap-2 max-w-xl mx-auto mb-8">
        <input
          value={customMood}
          onChange={e => setCustomMood(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(customMood)}
          placeholder='Or describe your mood... "gift for my dad who loves tech"'
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button onClick={() => search(customMood)} disabled={!customMood.trim() || loading}
          className="px-5 py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Find
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <Loader2 size={32} className="animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-gray-500">AI is curating the perfect picks for your mood…</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{MOOD_EMOJI_MAP[results.moodCategory] ?? '⭐'}</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{results.moodCategory.replace('_', ' ')}</p>
              <p className="text-sm text-gray-600 italic">{results.reasoning}</p>
            </div>
          </div>

          {results.products.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
              <p>No products found for this mood. Try a different one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFavorite={favorites.has(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  onClick={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          isFavorite={favorites.has(selectedProduct.id)}
          onToggleFavorite={onToggleFavorite}
        />
      )}
    </div>
  );
}
