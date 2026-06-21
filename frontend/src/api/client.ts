// In production VITE_API_URL = https://your-backend.railway.app
// In dev, empty string falls through to Vite proxy on /api
const BASE_URL = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Products
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ products: import('../types').Product[]; total: number }>(`/products${qs}`);
  },
  getTrending: () => request<import('../types').Product[]>('/products/trending'),
  getBestDeals: (limit = 20) => request<import('../types').BestDeal[]>(`/products/best-deals?limit=${limit}`),
  getCategories: () => request<{ category: string; count: number }[]>('/products/categories'),
  getProduct: (id: number) =>
    request<{
      product: import('../types').Product;
      priceHistory: import('../types').PriceHistory[];
      crossPrices: import('../types').CrossPlatformPrice[];
    }>(`/products/${id}`),

  // Favorites
  getFavorites: () => request<import('../types').Favorite[]>('/favorites'),
  addFavorite: (productId: number, threshold = 0.15) =>
    request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, price_alert_threshold: threshold }),
    }),
  removeFavorite: (productId: number) =>
    request(`/favorites/${productId}`, { method: 'DELETE' }),
  checkFavorite: (productId: number) =>
    request<{ is_favorite: boolean }>(`/favorites/check/${productId}`),
  updateThreshold: (productId: number, threshold: number) =>
    request(`/favorites/${productId}/threshold`, {
      method: 'PATCH',
      body: JSON.stringify({ price_alert_threshold: threshold }),
    }),

  // Notifications
  getNotifications: (unreadOnly = false) =>
    request<{ notifications: import('../types').Notification[]; unreadCount: number }>(
      `/notifications${unreadOnly ? '?unread=true' : ''}`
    ),
  markRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id: number) => request(`/notifications/${id}`, { method: 'DELETE' }),

  // AI
  aiSearch: (query: string) =>
    request<import('../types').SearchResult>('/ai/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  getRecommendations: () =>
    request<{ products: import('../types').Product[]; reasoning: string }>('/ai/recommendations'),
  triggerMonitor: () => request('/ai/monitor', { method: 'POST' }),
  getAgentTasks: () => request<import('../types').AgentTask[]>('/ai/agent-tasks'),

  // Import
  importFromUrl: (url: string, platform: string) =>
    request('/import/url', {
      method: 'POST',
      body: JSON.stringify({ url, platform }),
    }),
  importManual: (data: Record<string, unknown>) =>
    request('/import/manual', { method: 'POST', body: JSON.stringify(data) }),
  importBulk: (products: Record<string, unknown>[]) =>
    request('/import/bulk', { method: 'POST', body: JSON.stringify({ products }) }),
};

export function chatStream(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) { onError('Chat failed'); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6)) as { type: string; content?: string; message?: string };
          if (data.type === 'text' && data.content) onChunk(data.content);
          if (data.type === 'done') onDone();
          if (data.type === 'error') onError(data.message || 'Unknown error');
        } catch {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return () => controller.abort();
}
