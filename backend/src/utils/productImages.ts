// Curated Unsplash photo IDs per product category.
// Using a deterministic hash of the product name ensures the same product
// always gets the same image across searches.

const CATEGORY_PHOTOS: Record<string, string[]> = {
  Beauty: [
    'photo-1556228578-8c89e6adf883', // skincare bottles flat lay
    'photo-1596462502278-27bfdc403348', // colourful cosmetics
    'photo-1571781926291-c477ebfd024b', // skincare lineup
    'photo-1608248543803-ba4f8c70ae0b', // white cream jar
    'photo-1620916566398-39f1143ab7be', // serum dropper
    'photo-1556229010-6c3f2c9ca5f8', // skincare routine
    'photo-1570194065650-d99fb4bedf0a', // beauty bottles
    'photo-1512290923902-8a9f81dc236c', // perfume bottle
    'photo-1522337360788-8b13dee7a37e', // makeup flat lay
    'photo-1583248369069-9d91f1640fe6', // lip products
  ],
  Electronics: [
    'photo-1505740420928-5e560c06d30e', // headphones on white
    'photo-1585386959984-a4155224a1ad', // TWS earbuds in case
    'photo-1546868871-7041f2a55e12', // smartwatch
    'photo-1523275335684-37898b6baf30', // watch close-up
    'photo-1560472354-b33ff0c44a43', // smartphone
    'photo-1511707171634-5f897ff02aa9', // phone in hand
    'photo-1526170375885-4d8ecf77b99f', // tech accessories
    'photo-1572635196237-14b3f281503f', // product on coloured bg
    'photo-1608149024924-c4f3093eac84', // wireless earbuds white
    'photo-1585771724684-38269d6639fd', // bluetooth speaker
  ],
  Clothing: [
    'photo-1594938298603-c8148c4b1b8e', // folded shirt
    'photo-1503341455253-b2e723bb3dbb', // ethnic kurta
    'photo-1598300042247-d088f8ab3a91', // indian ethnic wear
    'photo-1525507119028-ed4c629a60a3', // clothing rack
    'photo-1489987707025-afc232f7ea0f', // tshirts
    'photo-1542574271-7f3b92e6c821', // jeans
    'photo-1558769132-cb1aea458c5e', // fashion item
  ],
  Footwear: [
    'photo-1542291026-7eec264c27ff', // red sneaker hero
    'photo-1460353581641-37baddab0fa2', // clean white sneakers
    'photo-1608231387042-66d1773d3028', // running shoes
    'photo-1539185441755-769473a23570', // sandals
    'photo-1491553895911-0055eca6402d', // sports shoes side
    'photo-1525966222134-fcfa99b8ae77', // yellow trainer
  ],
  Kitchen: [
    'photo-1556909114-f6e7ad7d3136', // kitchen appliances
    'photo-1585515320310-259814833e62', // cooking pot on stove
    'photo-1490645935967-10de6ba17061', // food prep
    'photo-1574269909862-7e1d70bb8078', // pressure cooker
    'photo-1567620905732-2d1ec7ab7445', // kitchen tools
    'photo-1594470117722-de4b9a02ebed', // kitchen utensils
  ],
  Home: [
    'photo-1484101403633-562f891dc89a', // cosy living room
    'photo-1555041469-a586c61ea9bc', // white sofa
    'photo-1586023492125-27b2c045efd7', // home decor shelf
    'photo-1540574163026-643ea20ade25', // bedroom aesthetic
    'photo-1493809842364-78817add7ffb', // cushions/pillows
    'photo-1602872030490-4a484a7b3ba6', // bedsheet flat lay
  ],
  Health: [
    'photo-1584308666744-24d5c474f2ae', // supplements flat lay
    'photo-1556742049-0cfed4f6a45d', // health products
    'photo-1576671081837-49000212a370', // wellness products
    'photo-1512069772995-ec65ed45afd6', // vitamins
    'photo-1550572017-edd951aa8f72', // herbal products
  ],
  Sports: [
    'photo-1517836357463-d25dfeac3438', // dumbbells
    'photo-1571019613454-1cb2f99b2d8b', // gym equipment
    'photo-1574680096145-d05b474e2155', // workout / fitness
    'photo-1593079831268-3381b0db4a77', // yoga mat
    'photo-1599058945522-28d584b6f0ff', // cricket bat
    'photo-1547347298-4074fc3086f0', // sports gear
  ],
  Bags: [
    'photo-1548036328-c9fa89d128fa', // leather handbag
    'photo-1553062407-98eeb64c6a62', // backpack
    'photo-1591561954557-26941169b49e', // tote bag
    'photo-1473188537616-a4aea7b1e22c', // laptop bag
  ],
  Books: [
    'photo-1512820790803-83ca734da794', // stack of books
    'photo-1481627834876-b7833e8f5570', // open book
  ],
  General: [
    'photo-1556228578-8c89e6adf883', // skincare bottles
    'photo-1608248543803-ba4f8c70ae0b', // cream jar
    'photo-1620916566398-39f1143ab7be', // serum bottle
  ],
};

// Maps AI-generated category strings → our canonical category keys
const CATEGORY_ALIASES: Record<string, string> = {
  'skincare': 'Beauty',
  'personal care': 'Beauty',
  'personal care & toiletries': 'Beauty',
  'toiletries': 'Beauty',
  'toiletries - deodorants': 'Beauty',
  'personal care - creme': 'Beauty',
  'haircare': 'Beauty',
  'hair care': 'Beauty',
  'wellness': 'Health',
  'health & wellness': 'Health',
  'health and wellness': 'Health',
  'health and beauty': 'Beauty',
  'health & beauty': 'Beauty',
  'home care': 'Home',
  'wellness & essential oils': 'Health',
  'ayurveda': 'Health',
  'nutrition': 'Health',
  'food & nutrition': 'Health',
  'grocery': 'Kitchen',
  'mobile': 'Electronics',
  'mobiles': 'Electronics',
  'laptops': 'Electronics',
  'accessories': 'Beauty',
  'bags & luggage': 'Bags',
  'luggage': 'Bags',
};

function resolveCategory(raw: string): string {
  const key = raw.toLowerCase().trim();
  return CATEGORY_ALIASES[key] ?? CATEGORY_PHOTOS[raw] ? raw : 'General';
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getProductImage(category: string, productName: string): string {
  const resolved = resolveCategory(category);
  const photos = CATEGORY_PHOTOS[resolved] ?? CATEGORY_PHOTOS['General'];
  const idx = hashCode(productName) % photos.length;
  return `https://images.unsplash.com/${photos[idx]}?auto=format&fit=crop&w=400&q=80`;
}
