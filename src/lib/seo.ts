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
  currency?: string;
  url?: string;
  description?: string;
  category?: string;
}

/**
 * Build a Product JSON-LD for a single subscription / API plan.
 * Use price=null for contact-sales plans.
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
