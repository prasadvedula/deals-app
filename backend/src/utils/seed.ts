import { getDb } from '../database/db';

const sampleProducts = [
  // ── Electronics ────────────────────────────────────────────────────────────
  {
    name: 'boAt Airdopes 141 TWS Earbuds',
    description: 'True wireless earbuds with 42H total playback, ENx Technology for clear calls, IPX4 water resistance and ASAP Charge.',
    category: 'Electronics', current_price: 1299, original_price: 2499,
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
    platform: 'Flipkart', trending_score: 95,
  },
  {
    name: 'OnePlus Nord CE 3 Lite 5G (8GB+128GB)',
    description: '108MP AI Camera, 67W SUPERVOOC fast charging, 5000mAh battery, Snapdragon 695 processor.',
    category: 'Electronics', current_price: 17999, original_price: 19999,
    image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
    platform: 'Flipkart', trending_score: 92,
  },
  {
    name: 'Samsung Galaxy Buds2 Pro',
    description: 'Intelligent ANC, 360 Audio, 3 mic system. Up to 29 hours total battery.',
    category: 'Electronics', current_price: 5999, original_price: 8999,
    image_url: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400',
    platform: 'Amazon India', trending_score: 88,
  },
  {
    name: 'Noise ColorFit Pro 4 Smartwatch',
    description: 'AMOLED display, Bluetooth calling, 100+ sports modes, SpO2 & heart rate monitoring.',
    category: 'Electronics', current_price: 2999, original_price: 4999,
    image_url: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
    platform: 'Flipkart', trending_score: 91,
  },
  {
    name: 'Redmi 12 5G (4GB+128GB)',
    description: 'Snapdragon 4 Gen 2, 50MP dual camera, 5000mAh battery, 18W fast charge. Slim 7.98mm design.',
    category: 'Electronics', current_price: 10999, original_price: 15999,
    image_url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400',
    platform: 'Flipkart', trending_score: 89,
  },
  {
    name: 'realme Buds Air 5 Pro ANC Earbuds',
    description: '50dB ANC, 360° Spatial Audio, 40H playtime, 10-min charge = 2.5H playback.',
    category: 'Electronics', current_price: 2499, original_price: 4999,
    image_url: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=400',
    platform: 'Flipkart', trending_score: 86,
  },
  {
    name: 'JBL Go 3 Portable Bluetooth Speaker',
    description: 'Waterproof & dustproof (IP67), 5 hours playtime, JBL Pro Sound, USB-C charging.',
    category: 'Electronics', current_price: 1999, original_price: 3499,
    image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
    platform: 'Amazon India', trending_score: 82,
  },
  {
    name: 'Fire-Boltt Ninja Call Pro Plus Smartwatch',
    description: '1.83" HD display, Bluetooth calling, 100+ sports modes, AI voice assistant.',
    category: 'Electronics', current_price: 999, original_price: 2999,
    image_url: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400',
    platform: 'Flipkart', trending_score: 93,
  },
  // ── Kitchen ────────────────────────────────────────────────────────────────
  {
    name: 'Prestige Deluxe Plus Pressure Cooker 5L',
    description: 'Alpha base for faster cooking. Gasket release system for safety. Induction & gas compatible.',
    category: 'Kitchen', current_price: 1299, original_price: 1899,
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    platform: 'Amazon India', trending_score: 79,
  },
  {
    name: 'Bajaj Rex 500W Mixer Grinder 3 Jars',
    description: '3 jars including liquidising, wet/dry grinding. 3 speed control with incher. ISI approved.',
    category: 'Kitchen', current_price: 2199, original_price: 3499,
    image_url: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400',
    platform: 'Flipkart', trending_score: 74,
  },
  {
    name: 'Pigeon Favourite Aluminium Pressure Cooker 3L',
    description: 'Outer lid, ISI marked, ideal for 3-4 people. Works on all cooktops.',
    category: 'Kitchen', current_price: 699, original_price: 1299,
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    platform: 'Amazon India', trending_score: 76,
  },
  {
    name: 'Borosil Vision Glass Set of 6',
    description: 'Borosilicate glass, microwave & dishwasher safe, scratch resistant, 350ml each.',
    category: 'Kitchen', current_price: 449, original_price: 799,
    image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400',
    platform: 'Amazon India', trending_score: 71,
  },
  {
    name: 'Milton Thermosteel Flask 1 Litre',
    description: 'Double wall insulation, hot 24hrs/cold 12hrs, BPA free, leak-proof.',
    category: 'Kitchen', current_price: 649, original_price: 999,
    image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400',
    platform: 'Amazon India', trending_score: 77,
  },
  {
    name: 'Philips HL7756/00 750W Juicer Mixer Grinder',
    description: '3 jars, ProBlend 5 technology, speed selector with Incher function.',
    category: 'Kitchen', current_price: 3499, original_price: 5499,
    image_url: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=400',
    platform: 'Amazon India', trending_score: 73,
  },
  // ── Footwear ───────────────────────────────────────────────────────────────
  {
    name: 'Woodland Men\'s Casual Leather Shoes',
    description: 'Genuine leather upper, rubber outsole, moisture-wicking inner lining.',
    category: 'Footwear', current_price: 2799, original_price: 3999,
    image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    platform: 'Myntra', trending_score: 76,
  },
  {
    name: 'Bata Men\'s Formal Derby Shoes',
    description: 'Premium synthetic leather, cushioned insole, classic lace-up formal design.',
    category: 'Footwear', current_price: 1499, original_price: 2499,
    image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400',
    platform: 'Myntra', trending_score: 68,
  },
  {
    name: 'Campus Men\'s Running Shoes',
    description: 'Lightweight mesh upper, EVA midsole cushioning, anti-skid rubber outsole. Ideal for gym & running.',
    category: 'Footwear', current_price: 799, original_price: 1799,
    image_url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400',
    platform: 'Myntra', trending_score: 84,
  },
  // ── Clothing ───────────────────────────────────────────────────────────────
  {
    name: 'Fabindia Pure Cotton Block Print Kurta',
    description: 'Hand-block printed cotton kurta. Comfortable straight fit, machine washable.',
    category: 'Clothing', current_price: 1299, original_price: 1999,
    image_url: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=400',
    platform: 'Myntra', trending_score: 72,
  },
  {
    name: 'Manyavar Men\'s Embroidered Sherwani Set',
    description: 'Premium art silk, intricate embroidery, includes churidar and dupatta.',
    category: 'Clothing', current_price: 8999, original_price: 14999,
    image_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4f95?w=400',
    platform: 'Myntra', trending_score: 85,
  },
  {
    name: 'Jockey Men\'s Cotton T-Shirt Pack of 2',
    description: 'Pure cotton, tagless comfort, ribbed neckline. Available in multiple colours.',
    category: 'Clothing', current_price: 699, original_price: 1199,
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    platform: 'Myntra', trending_score: 80,
  },
  {
    name: 'Allen Solly Men\'s Slim Fit Chinos',
    description: 'Stretch cotton chinos, 5-pocket styling, easy-iron fabric.',
    category: 'Clothing', current_price: 1299, original_price: 2499,
    image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400',
    platform: 'Myntra', trending_score: 75,
  },
  // ── Beauty & Health ────────────────────────────────────────────────────────
  {
    name: 'Mamaearth Vitamin C Face Wash 100ml',
    description: 'With Vitamin C & Turmeric for skin illumination. Free from SLS & parabens.',
    category: 'Beauty', current_price: 249, original_price: 399,
    image_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
    platform: 'Nykaa', trending_score: 83,
  },
  {
    name: 'WOW Skin Science Apple Cider Vinegar 750ml',
    description: 'Raw, unfiltered with mother. Supports digestion, immunity & weight management.',
    category: 'Health', current_price: 349, original_price: 599,
    image_url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400',
    platform: 'Amazon India', trending_score: 71,
  },
  {
    name: 'Himalaya Neem Face Wash 200ml',
    description: 'Purifying neem and turmeric face wash. Controls oil, prevents pimples. Dermatologist tested.',
    category: 'Beauty', current_price: 139, original_price: 225,
    image_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
    platform: 'Nykaa', trending_score: 78,
  },
  // ── Bags & Accessories ────────────────────────────────────────────────────
  {
    name: 'Wildcraft Trailblazer 30L Backpack',
    description: 'Water-resistant nylon, padded laptop compartment (15.6"), ergonomic straps.',
    category: 'Bags', current_price: 1499, original_price: 2499,
    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    platform: 'Flipkart', trending_score: 80,
  },
  {
    name: 'American Tourister Linea Trolley Bag 55cm',
    description: 'TSA lock, 4-wheel spinner, expandable, lightweight polypropylene shell.',
    category: 'Bags', current_price: 3299, original_price: 6500,
    image_url: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=400',
    platform: 'Amazon India', trending_score: 87,
  },
  // ── Home & Living ─────────────────────────────────────────────────────────
  {
    name: 'Solimo 800 Thread Count Cotton Bedsheet Set',
    description: 'King size, 1 bedsheet + 2 pillow covers, 100% cotton, machine washable.',
    category: 'Home', current_price: 899, original_price: 1799,
    image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400',
    platform: 'Amazon India', trending_score: 74,
  },
  {
    name: 'Crompton Aura LED 12W Bulb Pack of 10',
    description: '12W = 100W replacement, 6500K cool daylight, BEE 5-star rated, 25,000 hrs life.',
    category: 'Home', current_price: 599, original_price: 1099,
    image_url: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400',
    platform: 'Amazon India', trending_score: 70,
  },
  {
    name: 'Cello Plastic Storage Containers Set of 6',
    description: 'Airtight, BPA-free containers in 6 sizes. Microwave safe lids, fridge-friendly.',
    category: 'Home', current_price: 499, original_price: 999,
    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    platform: 'Flipkart', trending_score: 69,
  },
  // ── Sports ────────────────────────────────────────────────────────────────
  {
    name: 'Decathlon Domyos 8kg Dumbbell Set',
    description: 'Neoprene coated, non-slip grip, includes 2 x 4kg dumbbells. Compact storage.',
    category: 'Sports', current_price: 1299, original_price: 2299,
    image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400',
    platform: 'Decathlon', trending_score: 83,
  },
  {
    name: 'Nivia Pro Gym Yoga Mat 6mm',
    description: 'Anti-skid, sweat-proof surface, 6mm thickness, carrying strap included.',
    category: 'Sports', current_price: 599, original_price: 1299,
    image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    platform: 'Flipkart', trending_score: 77,
  },
];

const indianPlatforms = [
  { name: 'Flipkart', url: 'https://www.flipkart.com/search?q=' },
  { name: 'Amazon India', url: 'https://www.amazon.in/s?k=' },
  { name: 'Meesho', url: 'https://meesho.com/search?q=' },
  { name: 'Snapdeal', url: 'https://www.snapdeal.com/search?keyword=' },
];

// Multipliers per platform (Meesho cheapest, Amazon slightly higher)
const platformMultiplier: Record<string, number> = {
  'Flipkart': 1.02,
  'Amazon India': 1.05,
  'Meesho': 0.92,
  'Snapdeal': 0.97,
  'Myntra': 1.03,
  'Nykaa': 1.04,
  'Decathlon': 1.0,
};

/**
 * Generate 30 days of realistic price history:
 * - Start near original_price 30 days ago
 * - Gradually drop towards current_price
 * - Add realistic daily noise (±2-4%)
 */
function generate30DayHistory(
  originalPrice: number,
  currentPrice: number
): Array<{ price: number; daysAgo: number }> {
  const entries: Array<{ price: number; daysAgo: number }> = [];
  const totalDrop = originalPrice - currentPrice;

  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const progress = (30 - daysAgo) / 30; // 0 at start, 1 at today
    // Non-linear drop: slow at first, faster at end (simulates sale events)
    const dropProgress = Math.pow(progress, 1.4);
    const basePrice = originalPrice - totalDrop * dropProgress;
    // Daily noise ±3%
    const noise = (Math.random() - 0.5) * 0.03 * originalPrice;
    const price = Math.max(currentPrice, Math.round(basePrice + noise));
    entries.push({ price, daysAgo });
  }
  return entries;
}

export async function seed() {
  const db = getDb();

  const existingCount = (
    db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }
  ).count;
  if (existingCount > 0) {
    console.log(`[Seed] Database already has ${existingCount} products. Skipping.`);
    return;
  }

  console.log(`Seeding ${sampleProducts.length} Indian products with 30-day price history...`);

  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, category, current_price, original_price,
      image_url, platform, platform_url, trending_score)
    VALUES (@name, @description, @category, @current_price, @original_price,
      @image_url, @platform, @platform_url, @trending_score)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO price_history (product_id, price, platform, recorded_at)
    VALUES (?, ?, ?, datetime('now', ? || ' days'))
  `);

  const insertCross = db.prepare(`
    INSERT OR IGNORE INTO cross_platform_prices (product_id, platform, price, url)
    VALUES (?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    for (const product of sampleProducts) {
      const result = insertProduct.run({
        ...product,
        platform_url: `https://www.${product.platform.toLowerCase().replace(' ', '').replace('india', '.in')}.com`,
      });
      const pid = result.lastInsertRowid as number;

      // 30-day price history
      const history = generate30DayHistory(product.original_price, product.current_price);
      for (const h of history) {
        insertHistory.run(pid, h.price, product.platform, `-${h.daysAgo}`);
      }

      // Cross-platform prices
      for (const p of indianPlatforms) {
        if (p.name === product.platform) continue;
        const mult = platformMultiplier[p.name] ?? 1.0;
        const crossPrice = Math.round(product.current_price * mult);
        insertCross.run(pid, p.name, crossPrice, `${p.url}${encodeURIComponent(product.name)}`);
      }
    }
  });

  seedAll();
  console.log(`✓ Seeded ${sampleProducts.length} products with 30-day price history.`);
}

// Only run as a script (npm run seed); when imported the caller invokes seed()
if (process.argv[1] && process.argv[1].includes('seed')) {
  seed().catch(console.error);
}
