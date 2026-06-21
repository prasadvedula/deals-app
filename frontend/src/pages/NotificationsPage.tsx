import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, TrendingDown, RefreshCw, Bot } from 'lucide-react';
import { Notification } from '../types';
import { api } from '../api/client';

interface Props {
  onNotificationsRead: () => void;
}

export default function NotificationsPage({ onNotificationsRead }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkAllRead = async () => {
    await api.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    onNotificationsRead();
  };

  const handleDelete = async (id: number) => {
    await api.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkRead = async (id: number) => {
    await api.markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: 1 } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    onNotificationsRead();
  };

  const triggerMonitoring = async () => {
    setMonitoring(true);
    try {
      await api.triggerMonitor();
      setTimeout(() => { loadNotifications(); setMonitoring(false); }, 3000);
    } catch {
      setMonitoring(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="text-blue-600" size={22} />
          <h1 className="text-xl font-bold text-gray-800">Price Alerts</h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerMonitoring}
            disabled={monitoring}
            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            <Bot size={16} />
            {monitoring ? 'Monitoring...' : 'Run AI Monitor'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
          <button
            onClick={loadNotifications}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Monitoring info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Bot size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">AI Price Monitoring Active</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Our Claude AI agent monitors prices on Amazon, eBay, and Walmart every 30 minutes.
            When a product in your favorites drops by your alert threshold, you'll be notified here instantly.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={56} className="mx-auto mb-4 text-gray-200" />
          <h2 className="text-lg font-semibold text-gray-500 mb-2">No alerts yet</h2>
          <p className="text-gray-400 text-sm">
            Add products to favorites to get price drop alerts.
            Click "Run AI Monitor" to check prices now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => n.read === 0 && handleMarkRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                n.read === 0
                  ? 'bg-white border-blue-200 shadow-sm'
                  : 'bg-gray-50 border-gray-100 opacity-70'
              }`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                n.type === 'price_drop' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
              }`}>
                <TrendingDown size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-relaxed">{n.message}</p>
                {n.product_name && (
                  <p className="text-xs text-gray-400 mt-0.5">{n.product_name}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{formatTime(n.created_at)}</p>
              </div>
              {n.read === 0 && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                className="text-gray-300 hover:text-red-400 flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
