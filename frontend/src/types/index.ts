export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  current_price: number;
  original_price: number;
  image_url: string;
  platform: string;
  platform_url: string;
  trending_score: number;
  import_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  platform: string;
  recorded_at: string;
}

export interface CrossPlatformPrice {
  id: number;
  product_id: number;
  platform: string;
  price: number;
  url: string;
  last_checked: string;
}

export interface Favorite extends Product {
  favorite_id?: number;
  price_alert_threshold: number;
  added_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  product_id: number;
  type: string;
  message: string;
  read: number;
  created_at: string;
  product_name?: string;
  image_url?: string;
  current_price?: number;
}

export interface SearchResult {
  products: Product[];
  aiInsights: string;
}

export interface BestDeal extends Product {
  high_30d: number;
  low_30d: number;
  avg_30d: number;
  price_points: number;
  deal_score: number;
  savings_vs_30d_high: number;
}

export interface AgentTask {
  id: number;
  type: string;
  status: string;
  payload: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}
