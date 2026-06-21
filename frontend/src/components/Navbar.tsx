import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Heart, Bell, Search, Zap, Import, Bot, Tag, LayoutGrid } from 'lucide-react';

interface Props {
  notificationCount: number;
  aiProvider?: string;
}

export default function Navbar({ notificationCount, aiProvider }: Props) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: <Zap size={18} />, label: 'Trending' },
    { path: '/best-deals', icon: <Tag size={18} />, label: 'Best Deals' },
    { path: '/catalog', icon: <LayoutGrid size={18} />, label: 'Catalog' },
    { path: '/favorites', icon: <Heart size={18} />, label: 'Wishlist' },
    { path: '/search', icon: <Search size={18} />, label: 'AI Search' },
    { path: '/assistant', icon: <Bot size={18} />, label: 'Assistant' },
    { path: '/import', icon: <Import size={18} />, label: 'Import' },
    { path: '/notifications', icon: <Bell size={18} />, label: 'Alerts', badge: notificationCount },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <ShoppingBag size={24} />
          <span>DealsApp</span>
          <span className="text-xs font-normal text-gray-400 hidden sm:block">AI Price Tracker</span>
          {aiProvider && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full hidden md:block ${
              aiProvider === 'ollama'
                ? 'bg-green-100 text-green-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {aiProvider === 'ollama' ? '🦙 Ollama' : '✦ Claude'}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              <span className="hidden sm:block">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
