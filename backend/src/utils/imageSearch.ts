/**
 * Fetches product images from DuckDuckGo Images using the original search query
 * (not the AI-generated product name, which may contain hallucinated brand names
 * like "Dr. Pepper water bottle" or "Zara water bottle" that give wrong images).
 *
 * Fetches up to 15 results once per query and caches them so all products in
 * the same search get different images from the same relevant pool.
 */

// Only block CDNs that consistently return 403 when used as <img src>
const BLOCKED_HOSTS = [
  'lazcdn.com',          // Lazada — blocks hotlinks
  'images.meesho.com',   // Meesho — blocks hotlinks
  'img.etimg.com',       // Economic Times — not product images
  'stat.overdrive.in',   // Auto magazine
];

function isHostlinkSafe(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !BLOCKED_HOSTS.some((b) => host.includes(b));
  } catch {
    return false;
  }
}

// In-memory cache: query → array of image URLs
const imageCache = new Map<string, string[]>();

async function fetchImageResults(searchQuery: string): Promise<string[]> {
  const cached = imageCache.get(searchQuery);
  if (cached) return cached;

  const q = encodeURIComponent(searchQuery);

  try {
    const homeRes = await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await homeRes.text();
    const vqd = html.match(/vqd=['"]([^'"]+)['"]/)?.[1]
               ?? html.match(/vqd=([\d-]+)/)?.[1];
    if (!vqd) return [];

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=in-en&o=json&q=${q}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://duckduckgo.com/',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!imgRes.ok) return [];

    const data = await imgRes.json() as {
      results?: Array<{ image: string; width: number; height: number }>;
    };

    // Filter: good aspect ratio + hostlink-safe CDN
    const urls = (data.results ?? [])
      .filter((r) => {
        if (!r.image || !isHostlinkSafe(r.image)) return false;
        if (r.width && r.height) {
          const ratio = r.width / r.height;
          return ratio > 0.5 && ratio < 2.2;
        }
        return true;
      })
      .map((r) => r.image)
      .slice(0, 30);

    imageCache.set(searchQuery, urls);
    return urls;
  } catch {
    return [];
  }
}

/**
 * @param searchQuery  The original user query ("hot and cold water bottle") —
 *                     NOT the AI-generated product name.
 * @param slotIndex    0-based index so each product in the batch gets a different image.
 */
export async function fetchProductImage(searchQuery: string, slotIndex = 0): Promise<string> {
  const results = await fetchImageResults(`${searchQuery} india`);
  if (results.length === 0) return '';
  return results[slotIndex % results.length];
}
