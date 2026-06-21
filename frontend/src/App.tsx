import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import TrendingPage from './pages/TrendingPage';
import FavoritesPage from './pages/FavoritesPage';
import AISearchPage from './pages/AISearchPage';
import AssistantPage from './pages/AssistantPage';
import NotificationsPage from './pages/NotificationsPage';
import ImportPage from './pages/ImportPage';
import BestDealsPage from './pages/BestDealsPage';
import CatalogPage from './pages/CatalogPage';
import { api } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import { Product } from './types';

export default function App() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [aiProvider, setAiProvider] = useState<string>('');
  const [notificationCount, setNotificationCount] = useState(0);

  const loadFavoriteIds = async () => {
    try {
      const favs = await api.getFavorites();
      setFavorites(new Set(favs.map((f) => f.id)));
    } catch {}
  };

  const loadUnreadCount = async () => {
    try {
      const data = await api.getNotifications(true);
      setNotificationCount(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    loadFavoriteIds();
    loadUnreadCount();
    fetch('/api/ai/provider').then((r) => r.json()).then((d: { provider: string }) => setAiProvider(d.provider)).catch(() => {});
  }, []);

  const handleWsMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'price_drop') {
      setNotificationCount((c) => c + 1);
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Price Drop Alert!', {
          body: msg.message as string,
          icon: '/vite.svg',
        });
      }
    }
  }, []);

  useWebSocket(handleWsMessage);

  const handleToggleFavorite = async (product: Product) => {
    const isFav = favorites.has(product.id);
    try {
      if (isFav) {
        await api.removeFavorite(product.id);
        setFavorites((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
      } else {
        await api.addFavorite(product.id);
        setFavorites((prev) => new Set([...prev, product.id]));
        // Request notification permission on first favorite
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    } catch {}
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar notificationCount={notificationCount} aiProvider={aiProvider} />
        <Routes>
          <Route path="/" element={
            <TrendingPage favorites={favorites} onToggleFavorite={handleToggleFavorite} />
          } />
          <Route path="/best-deals" element={
            <BestDealsPage favorites={favorites} onToggleFavorite={handleToggleFavorite} />
          } />
          <Route path="/favorites" element={
            <FavoritesPage
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onFavoritesRefresh={loadFavoriteIds}
            />
          } />
          <Route path="/catalog" element={
            <CatalogPage favorites={favorites} onToggleFavorite={handleToggleFavorite} />
          } />
          <Route path="/search" element={
            <AISearchPage favorites={favorites} onToggleFavorite={handleToggleFavorite} />
          } />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/notifications" element={
            <NotificationsPage onNotificationsRead={loadUnreadCount} />
          } />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
