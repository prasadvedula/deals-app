import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { generateResponse } from '../services/ai/provider';
import { fetchProductImage } from '../utils/imageSearch';

const router = Router();

interface ImportedProduct {
  name: string;
  description: string;
  category: string;
  price: number;
  original_price: number;
  image_url: string;
  platform: string;
  platform_url: string;
}

// ── Platform detection ────────────────────────────────────────────────────────
function detectPlatform(url: string): string {
  if (/amazon\.in|amzn\.in/i.test(url)) return 'Amazon India';
  if (/flipkart\.com/i.test(url))        return 'Flipkart';
  if (/myntra\.com/i.test(url))          return 'Myntra';
  if (/meesho\.com/i.test(url))          return 'Meesho';
  if (/snapdeal\.com/i.test(url))        return 'Snapdeal';
  if (/nykaa\.com/i.test(url))           return 'Nykaa';
  if (/ajio\.com/i.test(url))            return 'Ajio';
  if (/tatacliq\.com/i.test(url))        return 'Tata CLiQ';
  return 'External';
}

// ── Resolve short URL redirect ────────────────────────────────────────────────
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

// ── Fetch page HTML ───────────────────────────────────────────────────────────
async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ── JSON-LD structured data extraction ───────────────────────────────────────
function extractJsonLd(html: string): Partial<ImportedProduct> {
  const result: Partial<ImportedProduct> = {};
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;

  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const items: unknown[] = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const obj = item as Record<string, unknown>;
        if (!['Product', 'ItemPage', 'Thing'].some((t) => String(obj['@type'] ?? '').includes(t))) continue;

        if (typeof obj.name === 'string' && obj.name) result.name = obj.name.trim();
        if (typeof obj.description === 'string' && obj.description) result.description = obj.description.trim().slice(0, 500);

        const img = obj.image;
        if (typeof img === 'string') result.image_url = img;
        else if (Array.isArray(img) && typeof img[0] === 'string') result.image_url = img[0];

        const offers = obj.offers as Record<string, unknown> | undefined;
        if (offers) {
          const price = parseFloat(String(offers.price ?? '').replace(/[^0-9.]/g, ''));
          if (price > 0) result.price = price;
        }

        if (result.name) return result; // found a good product node
      }
    } catch { /* skip invalid JSON */ }
  }
  return result;
}

// ── Open Graph meta tag extraction ───────────────────────────────────────────
function extractOgTags(html: string): Partial<ImportedProduct> {
  const get = (prop: string): string => {
    const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
           ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
    return m?.[1]?.trim() ?? '';
  };
  return {
    name:        get('title'),
    description: get('description'),
    image_url:   get('image'),
  };
}

// ── HTML title fallback ───────────────────────────────────────────────────────
function extractPageTitle(html: string): string {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    // Amazon appends "- Buy ... at Amazon.in" — strip the suffix
    .replace(/\s*[-|]\s*(Buy|Amazon|Flipkart|Nykaa|Myntra).*$/i, '')
    ?? '';
}

// ── Price extraction from HTML text ──────────────────────────────────────────
function extractPrices(html: string, platform: string): { price: number; original_price: number } {
  // Patterns for ₹1,299 or Rs. 1299 or INR 1299
  const priceRe = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const found: number[] = [];
  let m: RegExpExecArray | null;

  // Amazon-specific: look near known price containers
  if (platform === 'Amazon India') {
    // priceAmount in JSON embedded in page
    const jsonPrice = html.match(/"priceAmount"\s*:\s*"?([\d.]+)"?/)?.[1]
                   ?? html.match(/"buyingPrice"\s*:\s*([\d.]+)/)?.[1]
                   ?? html.match(/"landingPrice"\s*:\s*([\d.]+)/)?.[1];
    if (jsonPrice) {
      const p = parseFloat(jsonPrice);
      if (p > 0) {
        // also look for MRP
        const mrpMatch = html.match(/"mrp"\s*:\s*"?([\d.]+)"?/)
                      ?? html.match(/"listPrice"\s*:\s*"?([\d.]+)"?/);
        const mrp = mrpMatch ? parseFloat(mrpMatch[1]) : 0;
        return { price: p, original_price: mrp > p ? mrp : Math.round(p * 1.25) };
      }
    }
  }

  // Generic: collect all price-like numbers from page
  while ((m = priceRe.exec(html)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v >= 1 && v <= 1000000) found.push(v);
  }

  if (found.length === 0) return { price: 0, original_price: 0 };
  found.sort((a, b) => a - b);

  // Heuristic: smallest credible price = selling price, largest near 2× = MRP
  const price = found[0];
  const mrpCandidates = found.filter((v) => v > price && v <= price * 3);
  const original_price = mrpCandidates.length ? mrpCandidates[mrpCandidates.length - 1] : Math.round(price * 1.2);

  return { price, original_price };
}

// ── Category inference ────────────────────────────────────────────────────────
function inferCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (/phone|mobile|laptop|tablet|earbuds|headphone|speaker|smartwatch|camera|tv|charger|cable|bluetooth/.test(text)) return 'Electronics';
  if (/shirt|jeans|dress|kurta|kurti|saree|ethnic|cloth|wear|shoe|sandal|sneaker|footwear/.test(text)) return 'Clothing';
  if (/serum|cream|lotion|moisturi|shampoo|conditioner|hair|face|skin|makeup|beauty|lipstick|kajal|perfume|deodorant|oil/.test(text)) return 'Beauty';
  if (/cooker|mixer|grinder|flask|bottle|kitchen|utensil|cookware|pan|tawa|kadai/.test(text)) return 'Kitchen';
  if (/vitamin|supplement|protein|medicine|health|ayurved|immunity/.test(text)) return 'Health';
  if (/gym|yoga|dumbbell|fitness|sport|cricket|badminton|football|running|cycle/.test(text)) return 'Sports';
  if (/bedsheet|pillow|curtain|furniture|sofa|mattress|decor/.test(text)) return 'Home';
  if (/bag|backpack|wallet|handbag|luggage/.test(text)) return 'Bags';
  return 'General';
}

// ── AI gap-fill (only for missing fields) ─────────────────────────────────────
async function aiFillGaps(partial: Partial<ImportedProduct>, url: string, platform: string): Promise<ImportedProduct> {
  const missing = ['name', 'description', 'price', 'category'].filter(
    (f) => !partial[f as keyof ImportedProduct]
  );

  if (missing.length === 0) {
    return {
      name: partial.name!,
      description: partial.description ?? '',
      category: partial.category ?? inferCategory(partial.name ?? '', partial.description ?? ''),
      price: partial.price!,
      original_price: partial.original_price ?? Math.round(partial.price! * 1.2),
      image_url: partial.image_url ?? '',
      platform,
      platform_url: url,
    };
  }

  const known = JSON.stringify({
    name: partial.name ?? '',
    description: partial.description ?? '',
    price: partial.price ?? 0,
    image_url: partial.image_url ?? '',
  });

  const prompt = `You are filling in missing product details for an Indian e-commerce product.
Known data: ${known}
Platform: ${platform}
URL: ${url}
Missing fields: ${missing.join(', ')}

Return ONLY valid JSON with ALL of these fields:
{"name":"...","description":"...","category":"Electronics|Clothing|Beauty|Kitchen|Health|Sports|Home|Bags|General","price":0,"original_price":0,"image_url":"","platform":"${platform}","platform_url":"${url}"}`;

  try {
    const raw = await generateResponse(prompt, 'You fill missing product fields and return only valid JSON.');
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const filled = JSON.parse(match[0]) as ImportedProduct;
      return {
        name:           partial.name    || filled.name    || 'Imported Product',
        description:    partial.description || filled.description || '',
        category:       filled.category || inferCategory(partial.name ?? filled.name ?? '', ''),
        price:          partial.price   || filled.price   || 0,
        original_price: partial.original_price || filled.original_price || (partial.price ?? filled.price ?? 0) * 1.2,
        image_url:      partial.image_url || filled.image_url || '',
        platform,
        platform_url:   url,
      };
    }
  } catch { /* fall through */ }

  return {
    name:           partial.name    ?? 'Imported Product',
    description:    partial.description ?? '',
    category:       inferCategory(partial.name ?? '', partial.description ?? ''),
    price:          partial.price   ?? 0,
    original_price: partial.original_price ?? Math.round((partial.price ?? 0) * 1.2),
    image_url:      partial.image_url ?? '',
    platform,
    platform_url:   url,
  };
}

// ── Main extractor ────────────────────────────────────────────────────────────
async function extractFromUrl(rawUrl: string, hintPlatform: string): Promise<ImportedProduct> {
  // 1. Resolve redirects (amzn.in → amazon.in/dp/...)
  const finalUrl = await resolveUrl(rawUrl);
  const platform = detectPlatform(finalUrl) || hintPlatform;

  console.log(`[Import] ${rawUrl} → ${finalUrl} (${platform})`);

  // 2. Fetch page HTML
  const html = await fetchPage(finalUrl);

  // Check for bot-detection pages
  const isBotBlocked = html.length < 5000 || /captcha|robot|automated/i.test(html.slice(0, 2000));
  if (isBotBlocked) {
    console.warn('[Import] Bot detection triggered — using AI extraction only');
    return aiFillGaps({}, finalUrl, platform);
  }

  // 3. Extract from structured data sources
  const jsonLd = extractJsonLd(html);
  const og     = extractOgTags(html);
  const title  = extractPageTitle(html);
  const prices = extractPrices(html, platform);

  const partial: Partial<ImportedProduct> = {
    name:        jsonLd.name       || og.name       || title || '',
    description: jsonLd.description || og.description || '',
    image_url:   jsonLd.image_url  || og.image_url  || '',
    price:       jsonLd.price      || prices.price,
    original_price: prices.original_price,
    platform,
    platform_url: finalUrl,
  };

  partial.category = inferCategory(partial.name ?? '', partial.description ?? '');

  console.log(`[Import] Extracted: name="${partial.name}" price=${partial.price} img=${!!partial.image_url}`);

  // 4. Use AI to fill only the truly missing fields
  const product = await aiFillGaps(partial, finalUrl, platform);

  // 5. If still no image, search DuckDuckGo by product name
  if (!product.image_url && product.name) {
    console.log(`[Import] Fetching image for: ${product.name}`);
    product.image_url = await fetchProductImage(product.name, 0);
  }

  if (!product.name) throw new Error('Could not extract product name from URL');
  if (!product.price || product.price <= 0) throw new Error('Could not extract product price from URL');

  return product;
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.post('/url', async (req: Request, res: Response) => {
  const { url, platform = 'External' } = req.body as { url: string; platform?: string };
  if (!url) { res.status(400).json({ error: 'URL is required' }); return; }

  try {
    const info = await extractFromUrl(url, platform);
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO products (name, description, category, current_price, original_price,
        image_url, platform, platform_url, import_source, trending_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 70)
    `).run(
      info.name, info.description, info.category,
      info.price, info.original_price,
      info.image_url, info.platform, info.platform_url, url
    );
    db.prepare('INSERT INTO price_history (product_id, price) VALUES (?, ?)').run(result.lastInsertRowid, info.price);
    res.status(201).json({ success: true, product_id: result.lastInsertRowid, product: info });
  } catch (err) {
    console.error('[Import URL]', err);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/manual', (req: Request, res: Response) => {
  const { name, description = '', category = 'General', current_price, original_price, image_url = '', platform = 'External', platform_url = '' } = req.body as Record<string, string | number>;
  if (!name || !current_price) { res.status(400).json({ error: 'name and current_price required' }); return; }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO products (name, description, category, current_price, original_price, image_url, platform, platform_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, category, current_price, original_price ?? current_price, image_url, platform, platform_url);
  db.prepare('INSERT INTO price_history (product_id, price) VALUES (?, ?)').run(result.lastInsertRowid, current_price);
  res.status(201).json({ success: true, product_id: result.lastInsertRowid });
});

router.post('/bulk', (req: Request, res: Response) => {
  const { products } = req.body as { products: { name: string; description?: string; category?: string; price: number; original_price?: number; image_url?: string; platform?: string; platform_url?: string }[] };
  if (!Array.isArray(products) || products.length === 0) { res.status(400).json({ error: 'products array required' }); return; }
  if (products.length > 100) { res.status(400).json({ error: 'max 100 products' }); return; }

  const db = getDb();
  const ins  = db.prepare(`INSERT INTO products (name, description, category, current_price, original_price, image_url, platform, platform_url, import_source) VALUES (?,?,?,?,?,?,?,?,'bulk_import')`);
  const hist = db.prepare('INSERT INTO price_history (product_id, price) VALUES (?,?)');
  const imported: number[] = [];
  const errors: string[] = [];

  db.transaction(() => {
    for (const p of products) {
      try {
        if (!p.name || !p.price) throw new Error(`Missing name/price for: ${p.name}`);
        const r = ins.run(p.name, p.description ?? '', p.category ?? 'General', p.price, p.original_price ?? p.price, p.image_url ?? '', p.platform ?? 'External', p.platform_url ?? '');
        hist.run(r.lastInsertRowid, p.price);
        imported.push(r.lastInsertRowid as number);
      } catch (e) { errors.push(String(e)); }
    }
  })();

  res.json({ success: true, imported: imported.length, failed: errors.length, product_ids: imported, errors: errors.slice(0, 5) });
});

router.get('/template', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=import-template.csv');
  res.send('name,description,category,price,original_price,image_url,platform,platform_url\nExample Product,Great product,Electronics,29.99,49.99,,Amazon India,https://amazon.in');
});

export default router;
