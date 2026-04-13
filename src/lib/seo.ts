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

interface PageMetaInput {
  locale: Locale;
  path: string;          // e.g. '/api-pricing' (without locale prefix)
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  image?: string;
  noindex?: boolean;
}

/**
 * Build a Next.js Metadata object with title, description, OG, Twitter,
 * canonical, and per-route hreflang alternates for en/zh.
 */
export function buildMetadata(input: PageMetaInput): Metadata {
  const isZh = input.locale === 'zh';
  const title = isZh ? input.title.zh : input.title.en;
  const description = isZh ? input.description.zh : input.description.en;
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const canonical = `${SITE_URL}/${input.locale}${path}`;
  const image = input.image ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/en${path}`,
        zh: `${SITE_URL}/zh${path}`,
        'x-default': `${SITE_URL}/en${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      locale: isZh ? 'zh_CN' : 'en_US',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: input.noindex ? { index: false, follow: false } : { index: true, follow: true },
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
