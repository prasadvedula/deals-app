import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag, Heart, Bell, Search, Zap, Tag,
  LayoutGrid, Sparkles, Network, LogIn, LogOut,
  ChevronDown, Bot, PackagePlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';

interface Props {
  notificationCount: number;
  aiProvider?: string;
}

const NAV_ITEMS = [
  { path: '/',           icon: Zap,        label: 'Trending'    },
  { path: '/best-deals', icon: Tag,         label: 'Deals'       },
  { path: '/catalog',    icon: LayoutGrid,  label: 'Browse'      },
  { path: '/search',     icon: Search,      label: 'Find'        },
  { path: '/mood',       icon: Sparkles,    label: 'Mood Shop'   },
  { path: '/agents',     icon: Network,     label: 'AI Hub'      },
  { path: '/assistant',  icon: Bot,         label: 'Chat'        },
  { path: '/import',     icon: PackagePlus, label: 'Add Product' },
];

export default function Navbar({ notificationCount, aiProvider }: Props) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showLogin,    setShowLogin]    = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center h-14 gap-2">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0 mr-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                <ShoppingBag size={16} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 text-base hidden sm:block">DealSense</span>
              {aiProvider && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full hidden lg:block ${
                  aiProvider === 'groq' ? 'bg-violet-100 text-violet-700'
                  : aiProvider === 'claude' ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
                }`}>
                  {aiProvider === 'groq' ? '⚡ Groq' : aiProvider === 'claude' ? '✦ Claude' : '🦙 Local'}
                </span>
              )}
            </Link>

            {/* All nav items — scrollable on small screens */}
            <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
              {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
                <Link key={path} to={path}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                    isActive(path)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}>
                  <Icon size={14} />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              ))}
            </div>

            {/* Right: Wishlist · Alerts · User */}
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
              <Link to="/favorites"
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive('/favorites') ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:text-red-400 hover:bg-red-50'
                }`}>
                <Heart size={14} fill={isActive('/favorites') ? 'currentColor' : 'none'} />
                <span className="hidden md:block">Wishlist</span>
              </Link>

              <Link to="/notifications"
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive('/notifications') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}>
                <Bell size={14} />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Link>

              {/* User */}
              {user ? (
                <div ref={userMenuRef} className="relative">
                  <button onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-colors ml-1">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {user.avatar_initials || user.name[0].toUpperCase()}
                    </div>
                    <span className="hidden lg:block text-xs font-semibold text-gray-700 max-w-[72px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown size={12} className={`text-gray-400 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <Link to="/favorites" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Heart size={14} /> My Wishlist
                      </Link>
                      <Link to="/notifications" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Bell size={14} /> Alerts
                        {notificationCount > 0 && (
                          <span className="ml-auto text-xs bg-red-100 text-red-600 font-bold px-1.5 rounded-full">{notificationCount}</span>
                        )}
                      </Link>
                      <div className="border-t border-gray-100 mt-1">
                        <button onClick={() => { logout(); setShowUserMenu(false); }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full text-left">
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowLogin(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors ml-1">
                  <LogIn size={13} />
                  <span className="hidden sm:block">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
