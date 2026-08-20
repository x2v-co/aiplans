/**
 * Shared SEO helpers — metadata builders + JSON-LD structured data.
 * Use these from server-component pages (or layout.tsx wrappers around
 * client-component pages) to get consistent metadata, hreflang and schema.org.
 */
import type { Metadata } from 'next';

export const SITE_URL = 'https://aiplans.dev';
export const SITE_NAME = 'aiplans.dev';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;

export type Locale = 'en' | 'zh';

/** BCP-47 language tags for hreflang. More specific is better for SEO. */
export const HREFLANG_TAGS = {
  en: 'en',
  'en-US': 'en-US',
  zh: 'zh-CN',      // simplified Chinese, mainland
  'zh-Hans': 'zh-Hans',
} as const;

interface PageMetaInput {
  locale: Locale;
  path: string;          // e.g. '/api-pricing' (without locale prefix)
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  /**
   * Explicit OG/Twitter image URL. Leave unset to let Next.js auto-discover
   * the route's opengraph-image.tsx file — that's the preferred path for
   * dynamic per-page cards. Only set this for pages that don't have a
   * dynamic opengraph-image.tsx.
   */
  image?: string;
  noindex?: boolean;
}

/**
 * Build a Next.js Metadata object with title, description, OG, Twitter,
 * canonical, and per-route hreflang alternates for en/zh.
 *
 * hreflang: we emit the same /zh URL under both `zh-CN` (BCP-47 regional)
 * and `zh-Hans` (script subtag) so both Google and Baidu pick it up
 * regardless of locale preference. `x-default` points to /en.
 *
 * IMPORTANT: openGraph.images and twitter.images are NOT set unless the
 * caller passed an explicit `image`. Setting them unconditionally would
 * override Next.js's auto-detection of opengraph-image.tsx files inside
 * each route segment, which is exactly what happened in Round 2 — every
 * page's og:image ended up as /logo.png instead of the dynamic card.
 */
export function buildMetadata(input: PageMetaInput): Metadata {
  const isZh = input.locale === 'zh';
  const title = isZh ? input.title.zh : input.title.en;
  const description = isZh ? input.description.zh : input.description.en;
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const canonical = `${SITE_URL}/${input.locale}${path}`;

  const openGraph: Metadata['openGraph'] = {
    title,
    description,
    url: canonical,
    siteName: SITE_NAME,
    type: 'website',
    locale: isZh ? 'zh_CN' : 'en_US',
    alternateLocale: isZh ? ['en_US'] : ['zh_CN'],
  };
  const twitter: Metadata['twitter'] = {
    card: 'summary_large_image',
    title,
    description,
  };
  if (input.image) {
    openGraph.images = [{ url: input.image }];
    twitter.images = [input.image];
  }

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'en': `${SITE_URL}/en${path}`,
        'en-US': `${SITE_URL}/en${path}`,
        'zh-CN': `${SITE_URL}/zh${path}`,
        'zh-Hans': `${SITE_URL}/zh${path}`,
        'x-default': `${SITE_URL}/en${path}`,
      },
    },
    openGraph,
    twitter,
    robots: input.noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
  };
}

// ─── JSON-LD builders ────────────────────────────────────────────────────

export function jsonLd<T extends Record<string, unknown>>(data: T): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data });
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbList(items: BreadcrumbItem[]) {
  return jsonLd({
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  });
}

interface OfferInput {
  name: string;
  price: number | string | null;
  /**
   * Absolute URL of an image representing this product. Required — Search
   * Console flagged every Product on the site for a missing `image`, so this
   * is not optional at the type level any more. Every route that emits a
   * Product already has an opengraph-image.tsx, and its extensionless URL
   * serves image/png, so `${SITE_URL}/${locale}/<route>/opengraph-image` is
   * the intended value. Don't use public/providers/*.ico — Google doesn't
   * accept ICO.
   */
  image: string;
  /** Vendor name, e.g. 'OpenAI'. Google's accepted stand-in for GTIN/MPN. */
  brand?: string;
  currency?: string;
  url?: string;
  description?: string;
  category?: string;
}

/**
 * Build a Product JSON-LD for a single subscription / API plan.
 * Use price=null for contact-sales plans.
 *
 * Deliberately omits `shippingDetails` and `hasMerchantReturnPolicy`, which
 * Search Console asks for under "merchant listings". Please don't add them:
 *
 *  1. We can never qualify for that experience. Google: "Only pages where a
 *     shopper can purchase a product are eligible for merchant listing
 *     experiences, not pages with links to other sites that sell the product."
 *     Every buy link here points at the vendor.
 *  2. Both are recommended-only, so they block nothing.
 *  3. We have no truthful value. We don't ship these and we don't know the
 *     vendor's refund terms — stating a returnPolicyCategory would assert a
 *     policy we have no knowledge of, in a format built to be trusted.
 *
 * `image` and `brand` are different: both are cheap and true, so we do send
 * them.
 */
export function productOffer(input: OfferInput): string {
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    priceCurrency: input.currency ?? 'USD',
    availability: 'https://schema.org/InStock',
  };
  if (input.price != null && Number(input.price) > 0) {
    offer.price = String(input.price);
  } else if (input.price === null) {
    offer.price = '0';
    offer.priceSpecification = {
      '@type': 'PriceSpecification',
      priceCurrency: input.currency ?? 'USD',
      valueAddedTaxIncluded: false,
      // Indicates contact-sales — no public price
    };
  } else {
    offer.price = String(input.price);
  }
  if (input.url) offer.url = input.url;

  return jsonLd({
    '@type': 'Product',
    name: input.name,
    description: input.description ?? input.name,
    image: input.image,
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    category: input.category ?? 'AI Service',
    offers: offer,
  });
}

interface PriceListItem {
  position: number;
  name: string;
  url: string;
  price: number | string;
  currency?: string;
}

/**
 * Choose the single currency a model's AggregateOffer should be quoted in.
 *
 * `AggregateOffer` carries one `priceCurrency`, but our channels are stored in
 * whatever the vendor publishes — 154 CNY rows against 533 USD ones. The old
 * code hardcoded a `currency === 'USD'` filter, which meant a CNY-only model
 * (qwen-max, glm-4, hunyuan-pro, ernie) produced an empty price list and the
 * page emitted a bare `Product` with no offers at all. That is the "应指定
 * offers、review 或 aggregateRating" critical error in Search Console, and it
 * hit 10 of the 27 model pages in the sitemap.
 *
 * So: quote the model in whichever currency most of its priced channels use,
 * preferring USD on a tie. The caller must then filter its per-channel `Offer[]`
 * to the same currency — otherwise a ¥ Offer ends up nested inside a
 * `priceCurrency: "USD"` AggregateOffer, which is what used to happen.
 *
 * We quote the vendor's real published figure rather than converting to USD.
 * `convertToUSD` is right for *comparison* (see ef16dde) but a JSON-LD `price`
 * is a published-price claim, and exchange-rates.ts holds a hardcoded
 * `CNY: 6.90`, so converting would publish a stale invented number.
 *
 * Returns null when there are no priced channels — the caller should then emit
 * no Product at all, since there is nothing to advertise.
 */
export function pickOfferCurrency(currencies: string[]): string | null {
  if (currencies.length === 0) return null;

  const counts = new Map<string, number>();
  for (const raw of currencies) {
    const currency = raw || 'USD';
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [currency, count] of counts) {
    if (count > bestCount || (count === bestCount && currency === 'USD')) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build an ItemList JSON-LD for a price comparison table.
 * Used on /api-pricing and /plans pages.
 */
export function priceItemList(name: string, items: PriceListItem[]): string {
  return jsonLd({
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map(it => ({
      '@type': 'ListItem',
      position: it.position,
      item: {
        '@type': 'Product',
        name: it.name,
        url: it.url,
        offers: {
          '@type': 'Offer',
          priceCurrency: it.currency ?? 'USD',
          price: String(it.price),
        },
      },
    })),
  });
}

interface FAQ {
  question: string;
  answer: string;
}

export function faqPage(faqs: FAQ[]): string {
  return jsonLd({
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  });
}

/**
 * Render JSON-LD inside a server component. Prefer this over
 * dangerouslySetInnerHTML callers — encapsulates the pattern.
 *
 * Usage:
 *   <JsonLdScript data={priceItemList(...)} />
 *
 * Note: this returns a string; wrap in a <script> tag at the call site.
 */
