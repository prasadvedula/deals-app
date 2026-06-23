import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Trash2, TrendingDown, RefreshCw, Bot,
  Target, BarChart2, Tag, GitCompare, ChevronRight,
} from 'lucide-react';
import { Notification } from '../types';
import { api } from '../api/client';

interface Props {
  onNotificationsRead: () => void;
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  price_drop:        { icon: <TrendingDown size={16} />, color: 'bg-green-100 text-green-600',  label: 'Price Drop'   },
  deal_found:        { icon: <Target size={16} />,       color: 'bg-blue-100 text-blue-600',    label: 'Deal Found'   },
  weekly_report:     { icon: <BarChart2 size={16} />,    color: 'bg-purple-100 text-purple-600',label: 'Weekly Report'},
  bargain_alert:     { icon: <Tag size={16} />,          color: 'bg-amber-100 text-amber-600',  label: 'Bargain'      },
  comparison_result: { icon: <GitCompare size={16} />,   color: 'bg-indigo-100 text-indigo-600',label: 'Comparison'   },
};

function getDefaultMeta() {
  return { icon: <Bell size={16} />, color: 'bg-gray-100 text-gray-600', label: 'Alert' };
}

function notificationDestination(n: Notification): string | null {
  if (n.type === 'weekly_report') return '/agents?tab=report';
  if (n.type === 'deal_found' && n.product_id) return `/products/${n.product_id}`;
  if (n.type === 'price_drop' && n.product_id) return `/products/${n.product_id}`;
  if (n.type === 'bargain_alert' && n.product_id) return `/products/${n.product_id}`;
  if (n.type === 'comparison_result' && n.product_id) return `/products/${n.product_id}`;
  if (n.product_id) return `/products/${n.product_id}`;
  return null;
}

export default function NotificationsPage({ onNotificationsRead }: Props) {
  const navigate  = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [monitoring, setMonitoring]       = useState(false);

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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await api.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClick = async (n: Notification) => {
    // Mark as read
    if (n.read === 0) {
      await api.markRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: 1 } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
      onNotificationsRead();
    }
    // Navigate to the relevant page
    const dest = notificationDestination(n);
    if (dest) navigate(dest);
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
    const d    = new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="text-blue-600" size={22} />
          <h1 className="text-xl font-bold text-gray-800">Price Alerts</h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
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
            {monitoring ? 'Monitoring…' : 'Run AI Monitor'}
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

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Bot size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">AI Price Monitoring Active</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Our AI agent monitors prices on Flipkart, Amazon India, Meesho, and Snapdeal every 30 minutes.
            Click any alert to view product details or your weekly report.
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={56} className="mx-auto mb-4 text-gray-200" />
          <h2 className="text-lg font-semibold text-gray-500 mb-2">No alerts yet</h2>
          <p className="text-gray-400 text-sm">
            Add products to favorites to get price drop alerts.<br />
            Click "Run AI Monitor" to check prices now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta    = TYPE_META[n.type] ?? getDefaultMeta();
            const dest    = notificationDestination(n);
            const isUnread = n.read === 0;

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                  isUnread
                    ? 'bg-white border-blue-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer'
                    : dest
                      ? 'bg-gray-50 border-gray-100 hover:bg-gray-100 cursor-pointer'
                      : 'bg-gray-50 border-gray-100'
                }`}
              >
                {/* Icon */}
                <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${meta.color}`}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>
                      {meta.label}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{n.message}</p>
                  {n.product_name && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {(n as Notification & { product_name?: string }).product_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 self-center">
                  {dest && (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    className="p-1 text-gray-300 hover:text-red-400 rounded"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
