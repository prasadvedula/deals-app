import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import SeasonalBanner from './components/SeasonalBanner';
import TrendingPage from './pages/TrendingPage';
import FavoritesPage from './pages/FavoritesPage';
import AISearchPage from './pages/AISearchPage';
import AssistantPage from './pages/AssistantPage';
import NotificationsPage from './pages/NotificationsPage';
import ImportPage from './pages/ImportPage';
import BestDealsPage from './pages/BestDealsPage';
import CatalogPage from './pages/CatalogPage';
import AgentsPage from './pages/AgentsPage';
import MoodSearchPage from './pages/MoodSearchPage';
import { api } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import { Product } from './types';

function AppInner() {
  const { user } = useAuth();
  const [favorites, setFavorites]             = useState<Set<number>>(new Set());
  const [aiProvider, setAiProvider]           = useState<string>('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [showLoginModal, setShowLoginModal]   = useState(false);

  const loadFavoriteIds = useCallback(async () => {
    if (!user) { setFavorites(new Set()); return; }
    try {
      const favs = await api.getFavorites();
      setFavorites(new Set(favs.map(f => f.id)));
    } catch {}
  }, [user]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) { setNotificationCount(0); return; }
    try {
      const data = await api.getNotifications(true);
      setNotificationCount(data.unreadCount);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadFavoriteIds();
    loadUnreadCount();
    fetch(`${(import.meta.env.VITE_API_URL ?? '').replace(/^﻿/, '')}/api/ai/provider`)
      .then(r => r.json()).then((d: { provider: string }) => setAiProvider(d.provider)).catch(() => {});
  }, [loadFavoriteIds, loadUnreadCount]);

  const handleWsMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'price_drop') {
      setNotificationCount(c => c + 1);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Price Drop Alert!', { body: msg.message as string, icon: '/vite.svg' });
      }
    }
  }, []);

  useWebSocket(handleWsMessage);

  // Gate: require login to add/remove favorites
  const handleToggleFavorite = useCallback(async (product: Product) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    const isFav = favorites.has(product.id);
    try {
      if (isFav) {
        await api.removeFavorite(product.id);
        setFavorites(prev => { const s = new Set(prev); s.delete(product.id); return s; });
      } else {
        await api.addFavorite(product.id);
        setFavorites(prev => new Set([...prev, product.id]));
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    } catch {}
  }, [user, favorites]);

  const sharedProps = { favorites, onToggleFavorite: handleToggleFavorite };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar notificationCount={notificationCount} aiProvider={aiProvider} />
        <SeasonalBanner />
        <Routes>
          <Route path="/"            element={<TrendingPage    {...sharedProps} />} />
          <Route path="/best-deals"  element={<BestDealsPage   {...sharedProps} />} />
          <Route path="/catalog"     element={<CatalogPage     {...sharedProps} />} />
          <Route path="/search"      element={<AISearchPage    {...sharedProps} />} />
          <Route path="/mood"        element={<MoodSearchPage  {...sharedProps} />} />
          <Route path="/favorites"   element={
            <FavoritesPage
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onFavoritesRefresh={loadFavoriteIds}
            />
          } />
          <Route path="/assistant"      element={<AssistantPage />} />
          <Route path="/notifications"  element={<NotificationsPage onNotificationsRead={loadUnreadCount} />} />
          <Route path="/import"         element={<ImportPage />} />
          <Route path="/agents"         element={<AgentsPage />} />
        </Routes>

        {showLoginModal && (
          <LoginModal
            reason="to save products to your wishlist"
            onClose={() => setShowLoginModal(false)}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
