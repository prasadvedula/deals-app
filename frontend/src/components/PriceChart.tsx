import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { PriceHistory } from '../types';
import { inr } from '../utils/currency';

interface Props {
  history: PriceHistory[];
  originalPrice?: number;
  currentPrice?: number;
}

export default function PriceChart({ history, originalPrice, currentPrice }: Props) {
  const data = history.map((h) => ({
    date: new Date(h.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    price: h.price,
  }));

  const minPrice = Math.min(...data.map((d) => d.price));
  const maxPrice = Math.max(...data.map((d) => d.price));
  const padding = (maxPrice - minPrice) * 0.1 || 50;

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            domain={[minPrice - padding, maxPrice + padding]}
            tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
          />
          <Tooltip
            formatter={(v: number) => [inr(v), 'Price']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          {originalPrice && (
            <ReferenceLine y={originalPrice} stroke="#ef4444" strokeDasharray="4 4"
              label={{ value: 'Original', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          )}
          {currentPrice && (
            <ReferenceLine y={currentPrice} stroke="#10b981" strokeDasharray="4 4"
              label={{ value: 'Current', position: 'right', fontSize: 10, fill: '#10b981' }} />
          )}
          <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2}
            fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
