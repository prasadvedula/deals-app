#!/usr/bin/env node
/**
 * Bulk import 1 lakh (100,000) Indian e-commerce products into DealsApp SQLite.
 *
 * Run from project root:
 *   node backend/scripts/import-100k.mjs
 *
 * Options:
 *   --count=50000     Import 50k instead of 100k
 *   --skip-history    Skip 7-day price history rows (faster run, no charts)
 *   --clear           Delete all existing products first
 *   --dry-run         Show what would be inserted, don't write
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.resolve(__dirname, '../data/deals.db');
const ARGS      = process.argv.slice(2);
const SKIP_HIST = ARGS.includes('--skip-history');
const CLEAR     = ARGS.includes('--clear');
const DRY_RUN   = ARGS.includes('--dry-run');
const COUNT_ARG = ARGS.find(a => a.startsWith('--count='));
const TARGET    = COUNT_ARG ? parseInt(COUNT_ARG.split('=')[1], 10) : 100_000;

// ── Ensure data directory exists ─────────────────────────────────────────────
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG DATA — realistic Indian e-commerce products
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORMS = ['Flipkart', 'Amazon India', 'Myntra', 'Nykaa', 'Meesho'];

// Unsplash photo IDs per category (fallback images)
const IMAGES = {
  Smartphones:            'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
  Laptops:                'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400',
  Tablets:                'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
  'Audio & Earbuds':      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
  'Smart Watches':        'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
  Televisions:            'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400',
  'Home Appliances':      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
  "Men's Clothing":       'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400',
  "Women's Clothing":     'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400',
  Footwear:               'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
  'Beauty & Skincare':    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400',
  'Home & Kitchen':       'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=400',
  'Sports & Fitness':     'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
  Books:                  'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400',
};

// ── Category definitions ──────────────────────────────────────────────────────
const CATALOG = [

  // 1. SMARTPHONES — 15,000 products
  {
    category: 'Smartphones', count: 15_000,
    platforms: ['Flipkart', 'Amazon India', 'Meesho'],
    priceMin: 4_999, priceMax: 1_59_999,
    brands: ['Samsung', 'Apple', 'Xiaomi', 'Redmi', 'Realme', 'OnePlus', 'OPPO', 'Vivo',
             'Poco', 'iQOO', 'Nothing', 'Motorola', 'Nokia', 'Lava', 'Infinix', 'Tecno', 'Itel'],
    models: ['A15 5G', 'A25 5G', 'A35 5G', 'A55 5G', 'F15 5G', 'F25 5G', 'M15 5G', 'M35 5G',
             'Note 13', 'Note 13 Pro', 'Note 13 Pro+', '13 5G', '13C 5G', '14 5G',
             'GT 5 Pro', 'GT Neo 6', 'GT 6T', 'C65', 'C61', 'C55',
             'Nord 4', 'Nord CE 3 Lite', 'Nord CE4', '12R', 'Edge 40 Neo',
             'X100 Pro', 'X80', 'T3x', 'Y200 Pro', 'Y100A',
             'Phone 2a', 'Phone 2a Plus', '13 Ultra', '14 Ultra',
             'G85', 'G64 5G', 'G54 5G', 'iPhone 13', 'iPhone 14', 'iPhone 15',
             'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone SE 3'],
    specs: ['4GB/64GB', '4GB/128GB', '6GB/128GB', '8GB/128GB', '8GB/256GB', '12GB/256GB', '16GB/512GB'],
    colors: ['Midnight Black', 'Ocean Blue', 'Forest Green', 'Starlight Silver',
             'Rose Gold', 'Cosmic Purple', 'Arctic White', 'Lavender'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. 5G ready with high-performance chipset, fast charging, ` +
      `AMOLED display, and AI-enhanced camera system. Available on EMI.`,
  },

  // 2. LAPTOPS — 8,000 products
  {
    category: 'Laptops', count: 8_000,
    platforms: ['Flipkart', 'Amazon India'],
    priceMin: 19_999, priceMax: 2_49_999,
    brands: ['HP', 'Dell', 'Lenovo', 'ASUS', 'Acer', 'Apple', 'MSI', 'Samsung', 'LG', 'Gigabyte'],
    models: ['Pavilion 15', 'Victus 15', 'Envy x360', 'Spectre x360', 'Omen 16',
             'Inspiron 15', 'Vostro 15', 'XPS 15', 'XPS 13', 'Alienware m16',
             'IdeaPad Slim 3', 'IdeaPad Slim 5', 'Yoga 7i', 'ThinkPad E14', 'Legion 5',
             'VivoBook 15', 'ZenBook 14', 'ROG Strix G16', 'TUF Gaming A15', 'ProArt StudioBook',
             'Aspire Lite', 'Nitro 5', 'Predator Helios', 'Swift Go 14',
             'MacBook Air M2', 'MacBook Air M3', 'MacBook Pro 14 M3', 'MacBook Pro 16 M3',
             'Katana 15', 'Raider GE78', 'Galaxy Book4 Pro', 'Gram 15'],
    specs: ['8GB/512GB SSD', '16GB/512GB SSD', '16GB/1TB SSD', '32GB/1TB SSD', '32GB/2TB SSD'],
    colors: ['Moonlight Silver', 'Space Grey', 'Midnight Blue', 'Icelight Silver',
             'Graphite', 'Platinum', 'Pure White', 'Obsidian Black'],
    desc: (b, m, s, c) =>
      `${b} ${m} with ${s}, ${c}. Slim & lightweight design for students and professionals. ` +
      `Full HD IPS display, backlit keyboard, and all-day battery life.`,
  },

  // 3. TABLETS — 4,000 products
  {
    category: 'Tablets', count: 4_000,
    platforms: ['Flipkart', 'Amazon India'],
    priceMin: 8_999, priceMax: 1_29_999,
    brands: ['Samsung', 'Apple', 'Lenovo', 'Xiaomi', 'Realme', 'OnePlus', 'OPPO', 'Honor', 'Nokia'],
    models: ['Galaxy Tab A9', 'Galaxy Tab A9+', 'Galaxy Tab S9 FE', 'Galaxy Tab S9', 'Galaxy Tab S9+',
             'iPad 10th Gen', 'iPad Air M2', 'iPad Pro M4 11"', 'iPad Pro M4 13"', 'iPad mini 7',
             'Tab P12 Pro', 'Tab M11', 'Tab M10 FHD', 'Pad 6', 'Pad 6 Pro',
             'Pad 2', 'Tab Lite', 'Tab 3', 'Pad Air', 'Pad Ultra'],
    specs: ['4GB/64GB Wi-Fi', '4GB/128GB Wi-Fi', '6GB/128GB LTE', '8GB/256GB Wi-Fi', '12GB/256GB LTE'],
    colors: ['Graphite', 'Silver', 'Starlight', 'Blue', 'Gray', 'Space Black'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. Large display for productivity and entertainment. ` +
      `Supports stylus, keyboard cover, and multi-window multitasking.`,
  },

  // 4. AUDIO & EARBUDS — 7,000 products
  {
    category: 'Audio & Earbuds', count: 7_000,
    platforms: ['Flipkart', 'Amazon India', 'Meesho'],
    priceMin: 499, priceMax: 39_999,
    brands: ['boAt', 'Sony', 'JBL', 'Noise', 'realme', 'OnePlus', 'Samsung', 'Apple',
             'Sennheiser', 'Bose', 'Jabra', 'Soundcore', 'Boult', 'pTron', 'Infinity',
             'Mivi', 'Portronics', 'Skullcandy', 'Zebronics'],
    models: ['Airdopes 141', 'Airdopes 311 Pro', 'Airdopes 441', 'Airdopes 811', 'Rockerz 255',
             'WF-1000XM5', 'WH-1000XM5', 'WI-C100', 'LinkBuds S', 'Tune 135',
             'Tune 760NC', 'Wave Beam', 'Partybox 310', 'Charge 5', 'Flip 6',
             'ColorFit Pro', 'Buds+', 'Color Buds 2s', 'Buds 3 Pro',
             'Buds2 Pro', 'Galaxy Buds FE', 'AirPods 4', 'AirPods Pro 2', 'AirPods Max',
             'QuietComfort 45', 'Sport Earbuds', 'Elite 75t', 'Elite 85t',
             'Liberty 4', 'Q45', 'Bass Edition Pro', 'Cosmos+', 'Ultra ANC'],
    specs: ['True Wireless', 'Active Noise Cancellation', 'Neckband', 'Over-Ear', 'On-Ear', 'Bluetooth 5.3'],
    colors: ['Black', 'White', 'Blue', 'Red', 'Green', 'Navy', 'Teal', 'Yellow'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. Premium audio with deep bass, ${
        s.includes('ANC') ? 'active noise cancellation,' : ''
      } long battery life, and comfortable fit for all-day use.`,
  },

  // 5. SMART WATCHES — 5,000 products
  {
    category: 'Smart Watches', count: 5_000,
    platforms: ['Flipkart', 'Amazon India', 'Meesho'],
    priceMin: 999, priceMax: 89_999,
    brands: ['Noise', 'boAt', 'Fire-Boltt', 'Fastrack', 'Titan', 'Samsung', 'Apple', 'Garmin',
             'Amazfit', 'Realme', 'OnePlus', 'IQOO', 'Mibro', 'Zebronics', 'Pebble', 'Hammer'],
    models: ['ColorFit Pro 4', 'ColorFit Ultra', 'ColorFit Caliber', 'Twist Go', 'Lunar',
             'Watch 5', 'Watch 4 Classic', 'Watch Ultra 2', 'Watch 6 Classic',
             'Apple Watch SE 2', 'Apple Watch Series 9', 'Apple Watch Ultra 2',
             'Venu 3', 'Fenix 7', 'Forerunner 955', 'Vivomove Sport',
             'GTR 4', 'GTS 4 Mini', 'Balance', 'Bip 5', 'T-Rex Ultra',
             'TechnoWatch Pro', 'Enigma X1', 'Cyclone Pro', 'Ninja Pro 3',
             'Watch 2 Pro', 'Orion', 'Watch Pro', 'Smart 2', 'Cosmo'],
    specs: ['AMOLED 1.8"', 'IPS 1.96"', 'AMOLED 2.0"', 'TFT 1.7"', 'OLED 2.2"'],
    colors: ['Black Strap', 'Grey Strap', 'Blue Strap', 'Rosegold', 'Brown Leather', 'Olive'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. Health monitoring with SpO2, heart rate, stress tracker. ` +
      `100+ sports modes, Bluetooth calling, IP68 water resistance.`,
  },

  // 6. TELEVISIONS — 5,000 products
  {
    category: 'Televisions', count: 5_000,
    platforms: ['Flipkart', 'Amazon India'],
    priceMin: 7_999, priceMax: 3_99_999,
    brands: ['Samsung', 'LG', 'Sony', 'Xiaomi', 'TCL', 'Hisense', 'OnePlus', 'Realme',
             'Motorola', 'VU', 'Thomson', 'iFFALCON', 'MarQ', 'Kodak', 'Acer'],
    models: ['Crystal 4K', 'Neo QLED 4K', 'QLED 8K', 'Frame 4K', 'OLED C3',
             'QNED 4K', 'NanoCell 4K', 'OLED evo G3', 'UHD 4K',
             'Bravia XR OLED', 'Bravia 4K X90L', 'Bravia 4K X80L',
             'P1 Pro 4K', 'Q2', 'A2 QLED Pro', 'QLED 4K',
             'C755 QLED', 'C635 Mini LED', 'C845 4K',
             'U7N ULED 4K', 'U6N 4K', 'A9H 4K',
             'Plex 4K', 'Revou2 4K QLED', 'iQ Pro 4K'],
    specs: ['32 inch HD', '43 inch Full HD', '43 inch 4K', '55 inch 4K', '65 inch 4K', '75 inch 4K 8K QLED'],
    colors: ['Black Bezel', 'Titanium Black', 'Slate Black', 'Silver', 'Charcoal Black'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} Smart TV in ${c}. Android TV / Tizen / WebOS with Netflix, Prime, Disney+ Hotstar. ` +
      `Dolby Vision, HDR10+, 60Hz/120Hz refresh rate, 2 HDMI + 2 USB.`,
  },

  // 7. HOME APPLIANCES — 10,000 products
  {
    category: 'Home Appliances', count: 10_000,
    platforms: ['Flipkart', 'Amazon India'],
    priceMin: 1_499, priceMax: 1_29_999,
    brands: ['LG', 'Samsung', 'Whirlpool', 'Bosch', 'Haier', 'Voltas', 'Daikin', 'Panasonic',
             'IFB', 'Godrej', 'Hitachi', 'Blue Star', 'Lloyd', 'Carrier', 'O General',
             'Bajaj', 'Philips', 'Prestige', 'Havells', 'Usha', 'V-Guard'],
    models: ['FrontLoad 7kg', 'FrontLoad 8kg', 'TopLoad 6.5kg', 'TopLoad 7.5kg', 'Semi Auto 8kg',
             'Side by Side 600L', 'Double Door 340L', 'Double Door 415L', 'Single Door 190L',
             'Split 1.5T 3Star', 'Split 1.5T 5Star', 'Split 2T 5Star', 'Window 1.5T',
             'Microwave 25L', 'OTG 30L', 'Convection 28L',
             'Room Heater 2000W', 'Tower Fan', 'Pedestal Fan', 'Ceiling Fan',
             'Water Purifier RO+UV', 'Water Heater 15L', 'Geyser 25L',
             'Mixer Grinder 750W', 'Juicer Mixer', 'Induction Cooktop', 'Electric Kettle 1.5L'],
    specs: ['5 Star Rating', '3 Star Rating', 'Inverter', 'BEE Rated', 'Smart Wi-Fi', 'Auto Clean'],
    colors: ['White', 'Ebony Black', 'Graphite', 'Silver', 'Grey', 'Stainless Steel'],
    desc: (b, m, s, c) =>
      `${b} ${m} in ${c}, ${s}. Energy efficient with smart features. ` +
      `10-year motor warranty, anti-bacterial drum, and quick wash program.`,
  },

  // 8. MEN'S CLOTHING — 10,000 products
  {
    category: "Men's Clothing", count: 10_000,
    platforms: ['Myntra', 'Flipkart', 'Meesho', 'Amazon India'],
    priceMin: 199, priceMax: 14_999,
    brands: ['Allen Solly', 'Peter England', 'Louis Philippe', 'Van Heusen', 'Arrow',
             'Raymond', 'Park Avenue', 'Mufti', 'Blackberrys', 'Being Human',
             'H&M', 'Zara', 'Levi\'s', 'Lee', 'Wrangler', 'UCB', 'Tommy Hilfiger',
             'Calvin Klein', 'US Polo', 'Puma', 'Nike', 'Adidas', 'Reebok',
             'Roadster', 'HRX', 'Bewakoof', 'Snitch'],
    models: ['Slim Fit Shirt', 'Regular Fit Shirt', 'Casual T-Shirt', 'Polo T-Shirt',
             'Formal Trousers', 'Chinos', 'Jeans', 'Track Pants', 'Joggers',
             'Sweatshirt', 'Hoodie', 'Blazer', 'Suit', 'Kurta', 'Nehru Jacket',
             'Ethnic Set', 'Cargo Pants', 'Shorts', 'Bermuda'],
    specs: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
    colors: ['Navy Blue', 'White', 'Black', 'Light Blue', 'Olive', 'Grey', 'Maroon', 'Beige', 'Mustard'],
    desc: (b, m, s, c) =>
      `${b} ${m} in ${c}, Size ${s}. Premium cotton fabric, wrinkle-resistant finish. ` +
      `Machine washable. Regular fit for all-day comfort.`,
  },

  // 9. WOMEN'S CLOTHING — 10,000 products
  {
    category: "Women's Clothing", count: 10_000,
    platforms: ['Myntra', 'Flipkart', 'Meesho', 'Nykaa'],
    priceMin: 199, priceMax: 19_999,
    brands: ['W', 'Biba', 'Global Desi', 'Anita Dongre', 'Fabindia', 'Aurelia',
             'AND', 'Vero Moda', 'Only', 'H&M', 'Zara', 'Mango', 'Forever 21',
             'Nykaa Fashion', 'Libas', 'Sangria', 'Ethnic Motifs', 'Wishful',
             'Puma', 'Nike', 'Adidas', 'Jockey', 'Enamor', 'Clovia'],
    models: ['Kurti', 'Kurta Set', 'Salwar Suit', 'Anarkali', 'Lehenga', 'Saree',
             'Maxi Dress', 'Midi Dress', 'Casual Dress', 'Wrap Dress',
             'Top', 'Blouse', 'Palazzo Set', 'Co-ord Set', 'Jumpsuit',
             'Leggings', 'Jeggings', 'Trousers', 'Jeans', 'Sports Bra', 'Tracksuit'],
    specs: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'],
    colors: ['Pink', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Teal', 'Ivory', 'Peach', 'Rust'],
    desc: (b, m, s, c) =>
      `${b} ${m} in ${c}, Size ${s}. Elegant design with fine embroidery. ` +
      `Breathable fabric, comfortable all-day fit. Dry-clean/machine wash.`,
  },

  // 10. FOOTWEAR — 8,000 products
  {
    category: 'Footwear', count: 8_000,
    platforms: ['Myntra', 'Flipkart', 'Amazon India', 'Meesho'],
    priceMin: 299, priceMax: 24_999,
    brands: ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'New Balance', 'FILA',
             'Bata', 'Liberty', 'Woodland', 'Lakhani', 'Action', 'Campus',
             'Sparx', 'Relaxo', 'VKC', 'Metro Shoes', 'Mochi', 'Carlton London',
             'Crocs', 'Birkenstock', 'Clarks', 'Hush Puppies'],
    models: ['Air Max 270', 'React Infinity Run', 'Revolution 7', 'Court Vision',
             'Ultraboost 23', 'Samba', 'Stan Smith', 'Forum Low',
             'Rs-X', 'Suede Classic', 'Softride', 'Velocity Nitro',
             'D\'Lite', 'Max Cushioning', 'Go Walk 7', 'Go Run Consistent',
             'Casual Sneakers', 'Running Shoes', 'Walking Shoes', 'Sports Shoes',
             'Formal Oxford', 'Derby Shoes', 'Loafers', 'Sandals', 'Slippers', 'Boots',
             'Flip Flops', 'Kolhapuri', 'Mojari', 'Juttis'],
    specs: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
    colors: ['Black', 'White', 'Grey', 'Navy', 'Red', 'Blue', 'Brown', 'Tan', 'Olive', 'Beige'],
    desc: (b, m, s, c) =>
      `${b} ${m} in ${c}, Size ${s}. Cushioned sole with arch support. ` +
      `Breathable mesh upper, durable rubber outsole. Ideal for daily wear and sports.`,
  },

  // 11. BEAUTY & SKINCARE — 7,000 products
  {
    category: 'Beauty & Skincare', count: 7_000,
    platforms: ['Nykaa', 'Flipkart', 'Amazon India', 'Meesho'],
    priceMin: 99, priceMax: 9_999,
    brands: ['Lakme', 'Maybelline', 'L\'Oreal', 'MAC', 'NYX', 'Faces Canada', 'Colorbar',
             'Plum', 'The Body Shop', 'Forest Essentials', 'Kama Ayurveda', 'Biotique',
             'Himalaya', 'Mamaearth', 'WOW Skin Science', 'Minimalist', 'Dot & Key',
             'mCaffeine', 'Re\' equil', 'Cetaphil', 'Neutrogena', 'Garnier', 'Pond\'s'],
    models: ['Foundation', 'Lipstick', 'Mascara', 'Eyeshadow Palette', 'Kajal',
             'Concealer', 'Blush', 'Highlighter', 'Compact Powder', 'BB Cream',
             'Face Serum', 'Vitamin C Serum', 'Niacinamide Serum', 'Hyaluronic Acid',
             'Sunscreen SPF 50', 'Moisturizer', 'Face Wash', 'Toner', 'Eye Cream',
             'Night Cream', 'Clay Mask', 'Scrub', 'Under-Eye Patches',
             'Shampoo', 'Conditioner', 'Hair Oil', 'Hair Mask', 'Dry Shampoo',
             'Perfume', 'Deodorant', 'Body Lotion', 'Body Scrub'],
    specs: ['30ml', '50ml', '100ml', '150ml', '200ml', '250ml', '300ml'],
    colors: ['Nude Pink', 'Classic Red', 'Berry', 'Coral', 'Mauve', 'Brown', 'Tinted', 'Transparent'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s}, ${c} tint. Dermatologist tested, paraben-free formula. ` +
      `Suitable for Indian skin tones. Long-lasting, transfer-proof formula.`,
  },

  // 12. HOME & KITCHEN — 7,000 products
  {
    category: 'Home & Kitchen', count: 7_000,
    platforms: ['Amazon India', 'Flipkart', 'Meesho'],
    priceMin: 149, priceMax: 24_999,
    brands: ['Prestige', 'Hawkins', 'TTK', 'Pigeon', 'Butterfly', 'Wonderchef',
             'IKEA', 'Home Centre', 'Solimo', 'Amazon Basics', 'Cello',
             'Milton', 'Tupperware', 'Borosil', 'Larah', 'Corelle', 'Treo'],
    models: ['Pressure Cooker 5L', 'Non-Stick Tawa', 'Kadai Set', 'Fry Pan', 'Casserole Set',
             'Storage Container Set', 'Water Bottle 1L', 'Lunch Box', 'Coffee Mug Set',
             'Dinner Set 27pc', 'Serving Bowl Set', 'Mixing Bowl Set',
             'Chopping Board', 'Knife Set', 'Peeler Set', 'Spatula Set',
             'Sofa 3-Seater', 'Centre Table', 'Bookshelf', 'Shoe Rack', 'Wall Shelf',
             'Bedsheet Double', 'Pillow Covers', 'Curtains', 'Table Runner',
             'Air Freshener', 'Candles Set', 'Photo Frame', 'Clock'],
    specs: ['Standard', 'Large', 'XL Set', 'Mini', '3-Piece', '6-Piece', '12-Piece'],
    colors: ['Black', 'White', 'Red', 'Blue', 'Green', 'Stainless Steel', 'Wooden Finish', 'Marble'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. Food-grade material, BPA-free, dishwasher-safe. ` +
      `Designed for Indian cooking. ISI marked with 5-year warranty.`,
  },

  // 13. SPORTS & FITNESS — 4,000 products
  {
    category: 'Sports & Fitness', count: 4_000,
    platforms: ['Amazon India', 'Flipkart', 'Meesho'],
    priceMin: 299, priceMax: 49_999,
    brands: ['Cosco', 'Nivia', 'SG', 'SS', 'GM', 'Yonex', 'Li-Ning', 'Victor',
             'Decathlon', 'Domyos', 'Kipsta', 'Kalenji',
             'PowerMax Fitness', 'Lifeline', 'Spud', 'Body Maxx', 'Protoner',
             'Nike', 'Adidas', 'Under Armour', 'Reebok'],
    models: ['Yoga Mat 6mm', 'Resistance Bands Set', 'Dumbbells 5kg', 'Dumbbells 10kg',
             'Barbell Set 20kg', 'Pull-Up Bar', 'Skipping Rope', 'Ab Roller',
             'Treadmill', 'Elliptical Trainer', 'Exercise Cycle', 'Multi-Gym',
             'Cricket Bat English Willow', 'Cricket Bat Kashmir Willow', 'Tennis Racket',
             'Badminton Racket', 'Table Tennis Set', 'Football', 'Basketball',
             'Swimming Goggles', 'Knee Support', 'Gym Gloves', 'Protein Shaker'],
    specs: ['Standard', 'Pro', 'Elite', 'Junior', 'Senior', 'Unisex'],
    colors: ['Black', 'Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Grey', 'Multicolor'],
    desc: (b, m, s, c) =>
      `${b} ${m} ${s} in ${c}. High-quality material for performance and durability. ` +
      `Suitable for gym, home workouts, and professional sports use.`,
  },

  // 14. BOOKS — 2,000 products
  {
    category: 'Books', count: 2_000,
    platforms: ['Amazon India', 'Flipkart'],
    priceMin: 99, priceMax: 1_999,
    brands: ['Penguin', 'Harper Collins', 'Scholastic', 'S. Chand', 'Arihant',
             'Disha', 'Oswaal', 'MTG', 'RD Sharma', 'Pearson', 'Oxford', 'Wiley'],
    models: ['Wings of Fire — A. P. J. Abdul Kalam', 'Atomic Habits — James Clear',
             'Rich Dad Poor Dad — Kiyosaki', 'The Alchemist — Paulo Coelho',
             'Ikigai — Hector Garcia', 'Zero to One — Peter Thiel',
             'Let Us C — Yashavant Kanetkar', 'Data Structures — Narasimha Karumanchi',
             'JEE Main 40 Days Chemistry', 'JEE Advanced Physics 35 Years',
             'UPSC General Studies Paper 1', 'UPSC Essay Paper',
             'Class 10 NCERT Maths', 'Class 12 NCERT Biology',
             'GATE Computer Science', 'RRB NTPC General Awareness',
             'English Grammar in Use — Murphy', 'Wren & Martin High School Grammar',
             'Sapiens — Yuval Noah Harari', 'Think and Grow Rich — Napoleon Hill'],
    specs: ['Paperback', 'Hardcover', 'Set of 3', 'Set of 5', 'Box Set'],
    colors: ['Paperback Edition', 'Deluxe Edition', 'International Edition', 'Revised Edition'],
    desc: (b, m, s, c) =>
      `${b}: ${m} (${s}). ${c}. Bestseller with thousands of reviews. ` +
      `Essential reading for students, professionals, and lifelong learners.`,
  },
];

// ── Deterministic number helpers ──────────────────────────────────────────────
function pick(arr, i)  { return arr[i % arr.length]; }
function priceInRange(min, max, i) {
  const frac = (i * 1.618034) % 1;           // golden ratio spread
  const raw  = min + (max - min) * Math.pow(frac, 0.7);
  return Math.round(raw / 100) * 100 - 1;   // round to nearest X99
}

function discountFrac(i) {
  const pct = 5 + (i * 7) % 45;             // 5–50% off
  return 1 + pct / 100;
}

function platformFor(platformList, i) {
  // Weighted: first platform gets 40%, second 35%, rest share remainder
  const r = i % 20;
  if (r < 8)  return platformList[0];
  if (r < 15) return platformList[1 % platformList.length];
  return platformList[(2 + r % (platformList.length - 2 || 1)) % platformList.length];
}

// ── Generate all products ─────────────────────────────────────────────────────
function generateProducts(total) {
  // Scale each category proportionally to reach exactly `total`
  const rawTotal   = CATALOG.reduce((s, c) => s + c.count, 0);
  const scale      = total / rawTotal;
  const products   = [];

  for (const cat of CATALOG) {
    const n = Math.round(cat.count * scale);
    for (let i = 0; i < n; i++) {
      const brand = pick(cat.brands, i);
      const model = pick(cat.models, i + brand.length);
      const spec  = pick(cat.specs,  i + model.length);
      const color = pick(cat.colors, i);
      const curr  = priceInRange(cat.priceMin, cat.priceMax, i);
      const orig  = Math.round(curr * discountFrac(i) / 100) * 100;
      const trend = 20 + ((i * 37) % 80);
      const plat  = platformFor(cat.platforms, i);

      products.push({
        name:           `${brand} ${model} (${spec}) - ${color}`,
        description:    cat.desc(brand, model, spec, color),
        category:       cat.category,
        current_price:  curr,
        original_price: Math.max(orig, curr + 100),
        image_url:      IMAGES[cat.category] ?? '',
        platform:       plat,
        platform_url:   '',
        trending_score: trend,
      });
    }
  }

  return products;
}

// ── Schema bootstrap (in case DB doesn't exist yet) ──────────────────────────
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      current_price REAL NOT NULL,
      original_price REAL NOT NULL,
      image_url TEXT DEFAULT '',
      platform TEXT DEFAULT 'DealsApp',
      platform_url TEXT DEFAULT '',
      trending_score INTEGER DEFAULT 0,
      import_source TEXT,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      platform TEXT DEFAULT 'DealsApp',
      recorded_at TEXT DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      product_id UNINDEXED, name, description, category,
      content=products, content_rowid=id
    );
    CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, product_id, name, description, category)
      VALUES (new.id, new.id, new.name, new.description, new.category);
    END;
    CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, product_id, name, description, category)
      VALUES ('delete', old.id, old.id, old.name, old.description, old.category);
      INSERT INTO products_fts(rowid, product_id, name, description, category)
      VALUES (new.id, new.id, new.name, new.description, new.category);
    END;
    CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, product_id, name, description, category)
      VALUES ('delete', old.id, old.id, old.name, old.description, old.category);
    END;
  `);
}

function addIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_price      ON products(current_price);
    CREATE INDEX IF NOT EXISTS idx_products_trending   ON products(trending_score DESC);
    CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_platform   ON products(platform);
    CREATE INDEX IF NOT EXISTS idx_products_cat_price  ON products(category, current_price);
    CREATE INDEX IF NOT EXISTS idx_price_history_pid   ON price_history(product_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_created    ON products(created_at DESC);
  `);
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function bar(label, done, total, width = 40) {
  const pct    = total > 0 ? done / total : 0;
  const filled = Math.round(pct * width);
  const b      = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pStr   = (pct * 100).toFixed(1).padStart(5);
  process.stdout.write(`\r  ${label} [${b}] ${pStr}%  ${done.toLocaleString()}/${total.toLocaleString()} `);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║   DealsApp — Bulk Import 1 Lakh Products         ║');
console.log('╚══════════════════════════════════════════════════╝\n');
console.log(`  Target   : ${TARGET.toLocaleString()} products`);
console.log(`  Database : ${DB_PATH}`);
console.log(`  History  : ${SKIP_HIST ? 'skipped' : '7-day price history per product'}`);
console.log(`  Mode     : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE INSERT'}\n`);

if (DRY_RUN) {
  const rows = generateProducts(TARGET);
  console.log(`  Would insert ${rows.length.toLocaleString()} products across ${CATALOG.length} categories:\n`);
  const counts = {};
  for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
  for (const [cat, n] of Object.entries(counts)) {
    console.log(`    ${cat.padEnd(25)} ${n.toLocaleString().padStart(7)} products`);
  }
  console.log('\n  Run without --dry-run to import.\n');
  process.exit(0);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');   // 64 MB page cache

ensureSchema(db);
addIndexes(db);

if (CLEAR) {
  process.stdout.write('  Clearing existing products…');
  db.exec('DELETE FROM price_history; DELETE FROM products;');
  // FTS5 is cleaned up automatically by the products_ad trigger on each DELETE
  console.log(' done.\n');
}

// ── Generate ──────────────────────────────────────────────────────────────────
process.stdout.write('  Generating product data…');
const rows = generateProducts(TARGET);
console.log(` ${rows.length.toLocaleString()} rows ready.\n`);

// ── Insert products ───────────────────────────────────────────────────────────
const stmtProduct = db.prepare(`
  INSERT INTO products
    (name, description, category, current_price, original_price,
     image_url, platform, platform_url, trending_score, import_source)
  VALUES
    (@name, @description, @category, @current_price, @original_price,
     @image_url, @platform, @platform_url, @trending_score, 'bulk_import_v1')
`);

const BATCH = 500;
let insertedProducts = 0;
const startProducts  = Date.now();

// Collect product IDs after insert
const productIds = [];

const insertBatch = db.transaction((batch) => {
  for (const row of batch) {
    const info = stmtProduct.run(row);
    productIds.push(Number(info.lastInsertRowid));
  }
});

for (let i = 0; i < rows.length; i += BATCH) {
  insertBatch(rows.slice(i, i + BATCH));
  insertedProducts += Math.min(BATCH, rows.length - i);
  bar('Products', insertedProducts, rows.length);
}
const productSec = ((Date.now() - startProducts) / 1000).toFixed(1);
console.log(`\n  ✓ Inserted ${insertedProducts.toLocaleString()} products in ${productSec}s\n`);

// FTS5 is maintained automatically by triggers on every INSERT.
// No manual rebuild needed.

// ── Insert price history ──────────────────────────────────────────────────────
if (!SKIP_HIST) {
  const stmtHistory = db.prepare(`
    INSERT INTO price_history (product_id, price, platform, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertHistBatch = db.transaction((entries) => {
    for (const e of entries) stmtHistory.run(e.pid, e.price, e.platform, e.date);
  });

  const DAYS         = 7;
  const HIST_BATCH   = 2000;
  let insertedHist   = 0;
  const totalHist    = productIds.length * DAYS;
  const startHist    = Date.now();
  let histBuf        = [];
  const now          = new Date();

  for (let pi = 0; pi < productIds.length; pi++) {
    const pid      = productIds[pi];
    const product  = rows[pi];
    const basePrice = product.current_price;
    const plat      = product.platform;

    for (let d = DAYS - 1; d >= 0; d--) {
      const dt    = new Date(now);
      dt.setDate(dt.getDate() - d);
      // Simulate realistic price fluctuation ±8%
      const jitter = 1 + ((pi * 7 + d * 13) % 17 - 8) / 100;
      const price  = Math.max(basePrice * 0.7, Math.round(basePrice * jitter / 10) * 10);
      histBuf.push({ pid, price, platform: plat, date: dt.toISOString().slice(0, 10) });
    }

    if (histBuf.length >= HIST_BATCH) {
      insertHistBatch(histBuf);
      insertedHist += histBuf.length;
      histBuf = [];
      bar('History ', insertedHist, totalHist);
    }
  }
  if (histBuf.length > 0) {
    insertHistBatch(histBuf);
    insertedHist += histBuf.length;
  }

  const histSec = ((Date.now() - startHist) / 1000).toFixed(1);
  bar('History ', insertedHist, totalHist);
  console.log(`\n  ✓ Inserted ${insertedHist.toLocaleString()} price history rows in ${histSec}s\n`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const totalRows = db.prepare('SELECT COUNT(*) as n FROM products').get();
const ftsRows   = db.prepare("SELECT count(*) as n FROM products_fts WHERE products_fts MATCH 'Samsung OR Apple OR boAt OR Nike OR HP'").get();
const dbSize    = Math.round(fs.statSync(DB_PATH).size / 1024 / 1024);

console.log('╔══════════════════════════════════════════════════╗');
console.log('║   Import Complete                                ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Total products in DB : ${totalRows.n.toLocaleString()}`);
console.log(`  FTS5 index rows      : ${ftsRows.n.toLocaleString()} (maintained by triggers)`);
console.log(`  Database file size   : ${dbSize} MB`);
console.log(`  Indexes              : 7 performance indexes active`);
console.log('');
console.log('  Next steps:');
console.log('  1. Start dev server  : npm run dev');
console.log('  2. Test agent search : "Best laptop under 60000"');
console.log('  3. Compare products  : "Compare Samsung Galaxy vs iPhone 15"');
console.log('  4. Bargain finder    : "Cheapest way to buy OnePlus TV"\n');
