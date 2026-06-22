/**
 * Seasonal Pattern Alerts
 *
 * Maps product categories to Indian sale events and predicts
 * upcoming discount opportunities with days-until countdown.
 */

export interface SaleEvent {
  name: string;
  platform: string;
  startDate: Date;
  endDate: Date;
  daysUntil: number;
  isActive: boolean;
  expectedDiscountPct: number;    // category-specific expected discount
  categories: string[];           // which categories benefit most
  tip: string;
}

export interface SeasonalAlert {
  productId: number;
  category: string;
  upcomingEvents: SaleEvent[];
  bestUpcomingEvent: SaleEvent | null;
  currentlyInSale: SaleEvent | null;
  seasonalTip: string;
  expectedMaxDiscount: number;
}

interface RawEvent {
  name: string; platform: string;
  start: [number, number, number]; end: [number, number, number];
  expectedDiscountPct: number; categories: string[]; tip: string;
}

// Build this year's (and next 12 months') sale calendar
function buildCalendar(now: Date): SaleEvent[] {
  const y = now.getFullYear();
  const ny = y + 1;

  const events: RawEvent[] = [
    // Jan
    { name: 'Republic Day Sale',         platform: 'Amazon & Flipkart', start: [y, 0, 20], end: [y, 0, 27],  expectedDiscountPct: 25, categories: ['Electronics', 'Appliances', 'Mobiles', 'Clothing'], tip: 'Great for electronics and appliances — brands like Samsung, LG often hit yearly lows.' },
    // Feb
    { name: "Valentine's Day Sale",      platform: 'All Platforms',     start: [y, 1, 10], end: [y, 1, 14],  expectedDiscountPct: 15, categories: ['Clothing', 'Beauty', 'Jewellery', 'Gifts'], tip: 'Best for jewellery, fragrances, and gifting products.' },
    // Mar
    { name: 'Holi Sale',                 platform: 'All Platforms',     start: [y, 2, 10], end: [y, 2, 17],  expectedDiscountPct: 20, categories: ['Clothing', 'Beauty', 'Home', 'Sports'], tip: 'Colour-play products, summer clothing, and beauty items peak in discounts.' },
    // Apr–May
    { name: 'Summer Sale',               platform: 'All Platforms',     start: [y, 3, 1],  end: [y, 4, 15],  expectedDiscountPct: 18, categories: ['Appliances', 'Electronics', 'Clothing', 'Sports'], tip: 'ACs, coolers, and summer apparel hit peak discounts. Stock up before summer rush.' },
    // Jul
    { name: 'Prime Day',                 platform: 'Amazon',            start: [y, 6, 8],  end: [y, 6, 9],   expectedDiscountPct: 30, categories: ['Electronics', 'Mobiles', 'Appliances', 'Books'], tip: 'Amazon Prime Day is one of the top 3 sale events of the year. Set watchlists early.' },
    // Aug
    { name: 'Independence Day Sale',     platform: 'Amazon & Flipkart', start: [y, 7, 10], end: [y, 7, 15],  expectedDiscountPct: 22, categories: ['Electronics', 'Mobiles', 'Clothing', 'Appliances'], tip: 'Smartphones and electronics see major price cuts. Good time for big-ticket buys.' },
    { name: 'Onam Sale',                 platform: 'Amazon & Flipkart', start: [y, 7, 25], end: [y, 8, 5],   expectedDiscountPct: 20, categories: ['Clothing', 'Home', 'Gold', 'Electronics'], tip: 'Kerala-focused but site-wide offers. Gold and silk sarees at festival prices.' },
    // Oct
    { name: 'Great Indian Festival',     platform: 'Amazon',            start: [y, 9, 1],  end: [y, 9, 10],  expectedDiscountPct: 40, categories: ['Electronics', 'Mobiles', 'Appliances', 'Clothing', 'Books'], tip: 'Amazon\'s biggest event of the year. Launch-price deals on flagship phones, TVs, laptops.' },
    { name: 'Big Billion Days',          platform: 'Flipkart',          start: [y, 9, 5],  end: [y, 9, 12],  expectedDiscountPct: 40, categories: ['Electronics', 'Mobiles', 'Clothing', 'Appliances', 'Home'], tip: 'Flipkart\'s marquee event. Exclusive brand deals and flash sales every few hours.' },
    { name: 'Navratri Sale',             platform: 'Myntra & Ajio',     start: [y, 9, 1],  end: [y, 9, 10],  expectedDiscountPct: 35, categories: ['Clothing', 'Jewellery', 'Beauty', 'Footwear'], tip: 'Best time to buy ethnic wear, accessories, and beauty products.' },
    // Nov
    { name: 'Diwali Sale',               platform: 'All Platforms',     start: [y, 10, 1], end: [y, 10, 10], expectedDiscountPct: 35, categories: ['Electronics', 'Appliances', 'Clothing', 'Jewellery', 'Home'], tip: 'All categories benefit. Exchange offers on phones and TVs are at their best.' },
    { name: 'Black Friday',              platform: 'Amazon & Croma',    start: [y, 10, 25], end: [y, 10, 30], expectedDiscountPct: 30, categories: ['Electronics', 'Mobiles', 'Appliances'], tip: 'Particularly good for premium electronics: MacBooks, Sony, Samsung flagship.' },
    // Dec
    { name: 'Year-End Sale',             platform: 'All Platforms',     start: [y, 11, 20], end: [y, 11, 31], expectedDiscountPct: 28, categories: ['Clothing', 'Electronics', 'Books', 'Sports', 'Appliances'], tip: 'Brands clear year-end inventory. Great for last-gen electronics and seasonal clothing.' },
    // Next year Jan (carry forward)
    { name: 'Republic Day Sale',         platform: 'Amazon & Flipkart', start: [ny, 0, 20], end: [ny, 0, 27], expectedDiscountPct: 25, categories: ['Electronics', 'Appliances', 'Mobiles', 'Clothing'], tip: 'Great for electronics and appliances.' },
  ];

  return events.map((e): SaleEvent => {
    const startDate = new Date(e.start[0], e.start[1], e.start[2]);
    const endDate   = new Date(e.end[0],   e.end[1],   e.end[2], 23, 59);
    const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / 86400000);
    const isActive  = now >= startDate && now <= endDate;
    return {
      name: e.name, platform: e.platform, startDate, endDate,
      daysUntil: Math.max(0, daysUntil), isActive,
      expectedDiscountPct: e.expectedDiscountPct,
      categories: e.categories, tip: e.tip,
    };
  });
}

export function getSeasonalAlerts(productId: number, category: string): SeasonalAlert {
  const now = new Date();
  const allEvents = buildCalendar(now);

  // Filter to events relevant to this product's category
  const relevant = allEvents.filter(e =>
    e.categories.some(c => c.toLowerCase() === category.toLowerCase()) ||
    e.categories.includes('All')
  );

  const currentlyInSale = relevant.find(e => e.isActive) ?? null;

  // Upcoming (not yet started, within next 90 days)
  const upcoming = relevant
    .filter(e => !e.isActive && e.daysUntil > 0 && e.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const bestUpcoming = upcoming[0] ?? null;
  const maxDiscount  = Math.max(...relevant.map(e => e.expectedDiscountPct), 0);

  let seasonalTip = '';
  if (currentlyInSale) {
    seasonalTip = `🔥 ${currentlyInSale.name} is live RIGHT NOW on ${currentlyInSale.platform}! ${currentlyInSale.tip}`;
  } else if (bestUpcoming) {
    const d = bestUpcoming.daysUntil;
    seasonalTip = `⏳ ${bestUpcoming.name} starts in ${d} day${d === 1 ? '' : 's'} on ${bestUpcoming.platform}. ${bestUpcoming.tip}`;
  } else {
    seasonalTip = 'No major sale in the next 90 days — set a deal goal and we\'ll alert you when prices drop.';
  }

  return {
    productId,
    category,
    upcomingEvents: upcoming.slice(0, 3),
    bestUpcomingEvent: bestUpcoming,
    currentlyInSale,
    seasonalTip,
    expectedMaxDiscount: maxDiscount,
  };
}

// Also export a site-wide banner for the homepage
export interface SeasonalBanner {
  active: SaleEvent | null;
  comingSoon: SaleEvent | null;
  bannerText: string;
  urgency: 'live' | 'soon' | 'none';
}

export function getSeasonalBanner(): SeasonalBanner {
  const now = new Date();
  const all = buildCalendar(now);
  const active    = all.find(e => e.isActive) ?? null;
  const comingSoon = all.filter(e => !e.isActive && e.daysUntil <= 14).sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? null;

  if (active) {
    return {
      active, comingSoon: null,
      bannerText: `🔥 ${active.name} is LIVE on ${active.platform} — up to ${active.expectedDiscountPct}% off!`,
      urgency: 'live',
    };
  }
  if (comingSoon) {
    return {
      active: null, comingSoon,
      bannerText: `⏰ ${comingSoon.name} starts in ${comingSoon.daysUntil} day${comingSoon.daysUntil === 1 ? '' : 's'} — up to ${comingSoon.expectedDiscountPct}% off expected!`,
      urgency: 'soon',
    };
  }
  return { active: null, comingSoon: null, bannerText: '', urgency: 'none' };
}
