import { getDb } from '../../database/db';
import { AI_PROVIDER, generateResponse } from '../ai/provider';
import { Product } from '../../models/types';
import { getProductImage } from '../../utils/productImages';
import { fetchProductImage } from '../../utils/imageSearch';

// Reject names that still have AI template placeholders
function isValidProductName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  if (/<[^>]+>/.test(name)) return false;          // <brand>, <invalid>, etc.
  if (/^\[.*\]$/.test(name.trim())) return false;   // [product name]
  if (/^(brand|product|item|name)\s/i.test(name)) return false;
  return true;
}

export interface PlatformProduct {
  name: string;
  description: string;
  category: string;
  current_price: number;
  original_price: number;
  platform: string;
  platform_url: string;
  image_url: string;
}

export interface PlatformSearchResult {
  platform: string;
  products: (PlatformProduct & { id?: number; is_new?: boolean })[];
}

// ── Category detection ────────────────────────────────────────────────────────
type Category = 'Beauty' | 'Electronics' | 'Clothing' | 'Footwear' | 'Kitchen' | 'Home' | 'Sports' | 'Health';

const CATEGORY_RULES: Array<{ re: RegExp; cat: Category }> = [
  { re: /lotion|cream|serum|moistur|sunscreen|face|skin|hair|shampoo|conditioner|makeup|lip|eye|nail|cleanser|toner|scrub|mask|foundation|kajal|kohl|perfume|fragrance|deodorant|deo|body wash|body oil|body lotion|body spray|body gel|beauty|cosmetic|nykaa|\boil\b|gel|spray|relax|mamaearth|himalaya|plum|nykaa|biotique|wow skin|derma/i, cat: 'Beauty' },
  { re: /phone|mobile|laptop|earbuds|headphone|speaker|tablet|camera|tv|television|smartwatch|charger|cable|bluetooth|keyboard|mouse|monitor|router|electronic/i, cat: 'Electronics' },
  { re: /shirt|jeans|dress|kurta|kurti|saree|lehenga|salwar|dupatta|ethnic|fashion|cloth|wear|apparel|top|bottom|skirt|blazer|trouser|pant|hoodie|tshirt|t-shirt/i, cat: 'Clothing' },
  { re: /shoe|sandal|sneaker|heel|boot|chappal|slipper|footwear|loafer|runner/i, cat: 'Footwear' },
  { re: /cooker|mixer|grinder|juicer|flask|bottle|container|cookware|pan|tawa|kadai|pressure|kitchen|utensil/i, cat: 'Kitchen' },
  { re: /bedsheet|pillow|curtain|home|furniture|sofa|mattress|decor|cushion|lamp/i, cat: 'Home' },
  { re: /gym|yoga|dumbbell|fitness|sport|cricket|badminton|football|running|cycle|mat|shuttle/i, cat: 'Sports' },
  { re: /vitamin|supplement|protein|medicine|health|wellness|ayurved|immunity/i, cat: 'Health' },
];

function detectCategory(query: string): Category {
  for (const { re, cat } of CATEGORY_RULES) {
    if (re.test(query)) return cat;
  }
  return 'Beauty'; // default for ambiguous queries
}

// ── Brand + price templates by category ──────────────────────────────────────
const BRANDS: Record<Category, Array<{ brand: string; priceRange: [number, number] }>> = {
  Beauty:      [
    { brand: 'Minimalist',        priceRange: [399, 999] },
    { brand: 'Mamaearth',         priceRange: [249, 699] },
    { brand: 'Plum',              priceRange: [399, 1099] },
    { brand: 'WOW Skin Science',  priceRange: [349, 999] },
    { brand: 'The Derma Co',      priceRange: [449, 1299] },
    { brand: 'Dot & Key',         priceRange: [499, 1499] },
    { brand: 'mCaffeine',         priceRange: [299, 799] },
    { brand: 'Pilgrim',           priceRange: [349, 999] },
    { brand: 'Foxtale',           priceRange: [499, 1299] },
    { brand: 'Re\'equil',         priceRange: [549, 1499] },
    { brand: 'Himalaya',          priceRange: [149, 499] },
    { brand: 'Biotique',          priceRange: [179, 549] },
    { brand: 'Neutriderm',        priceRange: [299, 799] },
    { brand: 'Garnier',           priceRange: [199, 699] },
    { brand: 'L\'Oreal Paris',    priceRange: [349, 1299] },
    { brand: 'Lotus Herbals',     priceRange: [249, 799] },
    { brand: 'Lakme',             priceRange: [199, 899] },
    { brand: 'Cetaphil',          priceRange: [449, 1499] },
    { brand: 'Neutrogena',        priceRange: [399, 1299] },
    { brand: 'Nykaa Naturals',    priceRange: [299, 799] },
  ],
  Electronics: [
    { brand: 'boAt',        priceRange: [999, 4999] },
    { brand: 'realme',      priceRange: [1299, 19999] },
    { brand: 'Noise',       priceRange: [799, 3999] },
    { brand: 'OnePlus',     priceRange: [1999, 39999] },
    { brand: 'Mi',          priceRange: [699, 14999] },
    { brand: 'Fire-Boltt',  priceRange: [999, 4999] },
    { brand: 'Samsung',     priceRange: [1999, 79999] },
  ],
  Clothing: [
    { brand: 'Fabindia',    priceRange: [699, 2499] },
    { brand: 'Manyavar',    priceRange: [1499, 6999] },
    { brand: 'Allen Solly', priceRange: [799, 2999] },
    { brand: 'Jockey',      priceRange: [399, 1499] },
    { brand: 'Van Heusen',  priceRange: [899, 3499] },
    { brand: 'W for Woman', priceRange: [599, 2499] },
  ],
  Footwear: [
    { brand: 'Bata',        priceRange: [499, 2999] },
    { brand: 'Campus',      priceRange: [699, 2499] },
    { brand: 'Woodland',    priceRange: [1499, 4999] },
    { brand: 'Liberty',     priceRange: [599, 2499] },
    { brand: 'Sparx',       priceRange: [499, 1999] },
  ],
  Kitchen: [
    { brand: 'Prestige',    priceRange: [499, 3999] },
    { brand: 'Pigeon',      priceRange: [299, 2499] },
    { brand: 'Milton',      priceRange: [299, 1999] },
    { brand: 'Borosil',     priceRange: [399, 2999] },
    { brand: 'Hawkins',     priceRange: [799, 4999] },
  ],
  Home: [
    { brand: 'Solimo',      priceRange: [299, 1999] },
    { brand: 'Cello',       priceRange: [199, 999] },
    { brand: 'Story@Home',  priceRange: [349, 1999] },
    { brand: 'Home Centre', priceRange: [599, 3999] },
  ],
  Sports: [
    { brand: 'Nivia',       priceRange: [299, 1999] },
    { brand: 'Decathlon',   priceRange: [499, 4999] },
    { brand: 'Vector X',    priceRange: [349, 2499] },
    { brand: 'Cosco',       priceRange: [249, 1999] },
  ],
  Health: [
    { brand: 'Himalaya',    priceRange: [99, 499] },
    { brand: 'Patanjali',   priceRange: [49, 399] },
    { brand: 'Dabur',       priceRange: [79, 599] },
    { brand: 'HealthKart',  priceRange: [499, 3999] },
  ],
};

// ── Platform URL helpers ──────────────────────────────────────────────────────
function platformUrl(platform: string, query: string): string {
  const q = encodeURIComponent(query);
  const urls: Record<string, string> = {
    'Flipkart':     `https://www.flipkart.com/search?q=${q}`,
    'Amazon India': `https://www.amazon.in/s?k=${q}`,
    'Myntra':       `https://www.myntra.com/${q.replace(/%20/g, '-')}`,
    'Meesho':       `https://www.meesho.com/search?q=${q}`,
    'Snapdeal':     `https://www.snapdeal.com/search?keyword=${q}`,
    'Nykaa':        `https://www.nykaa.com/search/result/?q=${q}`,
  };
  return urls[platform] ?? `https://www.google.com/search?q=${q}+${encodeURIComponent(platform)}`;
}

// ── Deterministic fallback product generator ──────────────────────────────────
// Used when AI returns non-JSON (refusal, explanation text, etc.)
function generateFallbackProducts(query: string, platform: string, count: number): PlatformProduct[] {
  const category = detectCategory(query);
  const brands = BRANDS[category] ?? BRANDS.Beauty;

  // Pick `count` distinct brands (wrap if needed)
  const selected = Array.from({ length: count }, (_, i) => brands[i % brands.length]);

  // Derive a human-readable product suffix from the query
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const productSuffix = titleCase(query.replace(/\b(best|cheap|buy|online|india|price)\b/gi, '').trim());

  const descriptions: Record<Category, string> = {
    Beauty:      `Gentle daily-use ${productSuffix} formulated for Indian skin. Dermatologist tested, paraben-free.`,
    Electronics: `Feature-rich ${productSuffix} with long battery life and premium build quality.`,
    Clothing:    `Comfortable and stylish ${productSuffix} crafted from premium fabric for everyday wear.`,
    Footwear:    `Lightweight and durable ${productSuffix} designed for all-day comfort.`,
    Kitchen:     `High-quality ${productSuffix} built for Indian cooking needs.`,
    Home:        `Durable and elegant ${productSuffix} to enhance your home décor.`,
    Sports:      `Professional-grade ${productSuffix} engineered for performance and endurance.`,
    Health:      `Trusted ${productSuffix} formulated with natural ingredients for everyday wellness.`,
  };

  return selected.map(({ brand, priceRange }) => {
    const current_price = Math.round(
      (priceRange[0] + Math.random() * (priceRange[1] - priceRange[0])) / 10
    ) * 10;
    const discount = 0.25 + Math.random() * 0.35; // 25–60% off
    const original_price = Math.round((current_price / (1 - discount)) / 10) * 10;

    return {
      name: `${brand} ${productSuffix}`,
      description: descriptions[category],
      category,
      current_price,
      original_price,
      platform,
      platform_url: platformUrl(platform, `${brand} ${query}`),
      image_url: getProductImage(category, `${brand} ${productSuffix}`),
    };
  });
}

// ── Platform focus context ────────────────────────────────────────────────────
const PLATFORM_FOCUS: Record<string, string> = {
  'Flipkart':     'electronics, mobiles, laptops, TVs, appliances, fashion',
  'Amazon India': 'electronics, books, kitchen, health, beauty, sports',
  'Myntra':       'fashion, clothing, footwear, accessories, beauty',
  'Meesho':       'budget fashion, ethnic wear, home decor, sarees, kurtis',
  'Snapdeal':     'electronics, budget products, home appliances, clothing',
  'Nykaa':        'skincare, makeup, haircare, wellness, fragrances',
};

// ── Product generation ────────────────────────────────────────────────────────
// Ollama (qwen2.5:3b) consistently hallucinates nonsensical brand names
// ("Akhada", "AromaWorld", "Prajna", "Dr. Pepper", "Zara")  — skip AI entirely
// for Ollama and use the deterministic generator which has real Indian brands.
// For Claude (larger model), try AI first then fall back.
async function searchOnePlatform(query: string, platform: string, count = 3): Promise<PlatformProduct[]> {
  if (AI_PROVIDER === 'ollama') {
    return generateFallbackProducts(query, platform, count);
  }

  // Claude path — try AI generation
  const focus = PLATFORM_FOCUS[platform] ?? 'general products';
  const category = detectCategory(query);
  const system = `You output ONLY valid JSON arrays. No explanations. No apologies. No markdown. Raw JSON only.`;
  const prompt = `Output a JSON array of ${count} products matching "${query}" sold on ${platform} (${focus}).
RULES: output ONLY the JSON array. Prices in INR numbers only (no ₹ symbol). Use real Indian brand names only.

[{"name":"<RealBrand> ${query}","description":"<1 sentence>","category":"${category}","current_price":<number>,"original_price":<higher number>,"platform":"${platform}","platform_url":"${platformUrl(platform, query)}","image_url":""}]

Real Indian brands for ${category}: ${getBrandsForCategory(category).join(', ')}

Output ${count} products:`;

  let aiProducts: PlatformProduct[] = [];
  try {
    const raw = await generateResponse(prompt, system);
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as PlatformProduct[];
      const resolvedCategory = detectCategory(query);
      aiProducts = parsed
        .filter((p) => p && typeof p.name === 'string' && isValidProductName(p.name))
        .map((p) => ({
          name:           String(p.name).trim(),
          description:    String(p.description || '').trim(),
          category:       resolvedCategory,
          current_price:  Math.abs(Number(p.current_price) || 0),
          original_price: Math.abs(Number(p.original_price) || 0),
          platform,
          platform_url:   String(p.platform_url || platformUrl(platform, query)).trim(),
          image_url:      '',
        }))
        .filter((p) => p.current_price > 0);
    }
  } catch { /* fall through */ }

  if (aiProducts.length >= count) return aiProducts.slice(0, count);
  return [...aiProducts, ...generateFallbackProducts(query, platform, count - aiProducts.length)];
}

function getBrandsForCategory(category: string): string[] {
  return (BRANDS[category as keyof typeof BRANDS] ?? BRANDS.Beauty).map((b) => b.brand);
}

// ── Save products to DB, return with id + is_new ──────────────────────────────
// originalQuery = what the user typed ("hot and cold water bottle") — used for
// image search so we get relevant images regardless of the AI's brand hallucinations.
async function saveProducts(
  products: PlatformProduct[],
  originalQuery: string
): Promise<Array<PlatformProduct & { id: number; is_new: boolean }>> {
  const db = getDb();
  const saved: Array<PlatformProduct & { id: number; is_new: boolean }> = [];
  let slotIndex = 0;

  for (const p of products) {
    if (!isValidProductName(p.name) || p.current_price <= 0) continue;

    const existing = db.prepare(
      `SELECT * FROM products WHERE LOWER(name) = LOWER(?) AND platform = ?`
    ).get(p.name, p.platform) as Product | undefined;

    if (existing) {
      if (existing.current_price !== p.current_price) {
        db.prepare(
          `UPDATE products SET current_price = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(p.current_price, existing.id);
        db.prepare(
          `INSERT INTO price_history (product_id, price, platform) VALUES (?, ?, ?)`
        ).run(existing.id, p.current_price, p.platform);
      }
      saved.push({ ...p, id: existing.id, is_new: false });
    } else {
      const origPrice = p.original_price > p.current_price
        ? p.original_price
        : Math.round(p.current_price * 1.4);

      // Search by ORIGINAL QUERY (not product name) so hallucinated brand names
      // like "Dr. Pepper water bottle" don't pull cola images.
      const realImage = await fetchProductImage(originalQuery, slotIndex++);
      const imageUrl = realImage || getProductImage(p.category || 'General', p.name);

      const result = db.prepare(`
        INSERT INTO products (name, description, category, current_price, original_price,
          image_url, platform, platform_url, trending_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 65)
      `).run(
        p.name, p.description || '', p.category || 'General',
        p.current_price, origPrice,
        imageUrl,
        p.platform, p.platform_url || ''
      );

      const newId = result.lastInsertRowid as number;

      // Seed 30-day price history
      const histStmt = db.prepare(
        `INSERT INTO price_history (product_id, price, platform, recorded_at) VALUES (?, ?, ?, datetime('now', ? || ' days'))`
      );
      db.transaction(() => {
        for (let d = 30; d >= 0; d--) {
          const progress = (30 - d) / 30;
          const histPrice = Math.round(
            origPrice - (origPrice - p.current_price) * Math.pow(progress, 1.4)
          );
          histStmt.run(newId, histPrice, p.platform, `-${d}`);
        }
      })();

      // Add cross-platform prices
      const multipliers: Record<string, number> = {
        'Flipkart': 1.02, 'Amazon India': 1.05, 'Meesho': 0.92, 'Snapdeal': 0.97,
      };
      const crossStmt = db.prepare(
        `INSERT OR IGNORE INTO cross_platform_prices (product_id, platform, price, url) VALUES (?, ?, ?, ?)`
      );
      for (const cp of ['Flipkart', 'Amazon India', 'Meesho', 'Snapdeal'].filter((pl) => pl !== p.platform)) {
        crossStmt.run(
          newId, cp,
          Math.round(p.current_price * (multipliers[cp] ?? 1)),
          platformUrl(cp, p.name)
        );
      }

      saved.push({ ...p, id: newId, is_new: true });
    }
  }

  return saved;
}

// ── Platform auto-selection ───────────────────────────────────────────────────
function selectPlatforms(query: string): string[] {
  const q = query.toLowerCase();

  if (/\b(kurta|saree|sari|dress|shirt|jeans|lehenga|kurti|dupatta|salwar|ethnic|cloth|wear|apparel|shoe|sandal|sneaker|heel|boot|footwear|fashion|top|skirt|blazer|trouser|hoodie|tshirt)\b/.test(q))
    return ['Myntra', 'Flipkart', 'Amazon India', 'Meesho'];

  if (/\b(face|skin|cream|serum|lip|eye|hair|makeup|beauty|shampoo|moisturi|sunscreen|toner|lotion|cleanser|scrub|mask|foundation|kajal|perfume|deodorant|body wash|cosmetic|nykaa)\b/.test(q))
    return ['Nykaa', 'Amazon India', 'Flipkart', 'Meesho'];

  if (/\b(phone|mobile|laptop|earbuds|earphone|headphone|speaker|tablet|camera|tv|smartwatch|charger|cable|bluetooth|keyboard|mouse|monitor|router)\b/.test(q))
    return ['Flipkart', 'Amazon India', 'Snapdeal'];

  if (/\b(kitchen|cooker|mixer|grinder|juicer|flask|bottle|container|bedsheet|pillow|curtain|home|furniture|mattress|cookware|pan|tawa|kadai)\b/.test(q))
    return ['Amazon India', 'Flipkart', 'Meesho', 'Snapdeal'];

  if (/\b(gym|yoga|dumbbell|fitness|sport|cricket|badminton|football|running|cycle|mat|protein|supplement)\b/.test(q))
    return ['Flipkart', 'Amazon India', 'Snapdeal'];

  return ['Nykaa', 'Amazon India', 'Flipkart', 'Meesho'];
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function searchAcrossPlatforms(
  query: string,
  targetPlatforms?: string[]
): Promise<PlatformSearchResult[]> {
  const platforms = targetPlatforms ?? selectPlatforms(query);
  console.log(`[PlatformSearch] query="${query}" platforms=${platforms.join(', ')} provider=${AI_PROVIDER}`);

  // Run all platforms in parallel
  const settled = await Promise.allSettled(
    platforms.map((platform) => searchOnePlatform(query, platform, 3))
  );

  const resultsMap = new Map<string, Array<PlatformProduct & { id: number; is_new: boolean }>>();

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const platform = platforms[i];
    if (r.status === 'fulfilled' && r.value.length > 0) {
      const s = await saveProducts(r.value, query);
      if (s.length > 0) resultsMap.set(platform, s);
    } else {
      if (r.status === 'rejected') console.error(`[PlatformSearch] ${platform} failed:`, r.reason);
      const fallback = generateFallbackProducts(query, platform, 3);
      const s = await saveProducts(fallback, query);
      if (s.length > 0) resultsMap.set(platform, s);
    }
  }

  // Merge matching existing DB products
  const db = getDb();
  const existing = db.prepare(`
    SELECT * FROM products
    WHERE LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?)
    ORDER BY trending_score DESC LIMIT 8
  `).all(`%${query}%`, `%${query}%`, `%${query}%`) as Product[];

  for (const p of existing) {
    const list = resultsMap.get(p.platform) ?? [];
    if (!list.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) {
      list.push({ ...(p as unknown as PlatformProduct), id: p.id, is_new: false });
      resultsMap.set(p.platform, list);
    }
  }

  return Array.from(resultsMap.entries()).map(([platform, products]) => ({ platform, products }));
}
