import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { api } from '../api/client';

interface BannerData {
  urgency: 'live' | 'soon' | 'none';
  bannerText: string;
}

export default function SeasonalBanner() {
  const [data, setData] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.getSeasonalBanner()
      .then(d => setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.urgency === 'none' || dismissed) return null;

  const isLive = data.urgency === 'live';

  return (
    <div className={`relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${
      isLive
        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
        : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
    }`}>
      {isLive && <span className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />}
      <Sparkles size={15} className="flex-shrink-0 opacity-80" />
      <span className="flex-1 text-center">{data.bannerText}</span>
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
}
