import type { AiCatalogItem, AiCatalogKind } from '@/lib/ai-vertical-catalog';
import { PRICING_GUIDE_SLUGS } from '@/lib/pricing-guides';

export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

/**
 * Where a fixed sitemap URL's <lastmod> comes from. Never "now": Google
 * ignores lastmod on a site whose dates always equal the crawl time.
 *
 * - `data`: the page renders catalog data, so it changed when the newest
 *   model / price / plan / provider row did.
 * - `catalog`: a vertical list built from AI_VERTICAL_CATALOG; newest verifiedAt
 *   of those kinds, falling back to `date` when no item carries one.
 * - `date`: editorial page; the last content change (git history / the page's
 *   own "Last updated" line). Bump it when the copy changes.
 */
export type StaticLastmod =
  | { source: 'data' }
  | { source: 'catalog'; kinds: AiCatalogKind[]; date: string }
  | { source: 'date'; date: string };

export type StaticSitemapPath = {
  path: string;
  priority: number;
  changefreq: ChangeFrequency;
  lastmod: StaticLastmod;
};

const DATA: StaticLastmod = { source: 'data' };
// [info]/page.tsx: UPDATED = 'October 18, 2026'.
const INFO_PAGES: StaticLastmod = { source: 'date', date: '2026-10-18' };
const catalog = (kinds: AiCatalogKind[], date: string): StaticLastmod => ({ source: 'catalog', kinds, date });

export const STATIC_PATHS: StaticSitemapPath[] = [
  { path: '', priority: 1.0, changefreq: 'daily', lastmod: DATA },
  { path: '/models', priority: 0.9, changefreq: 'daily', lastmod: DATA },
  { path: '/api-pricing', priority: 0.9, changefreq: 'daily', lastmod: DATA },
  { path: '/calculator', priority: 0.9, changefreq: 'daily', lastmod: DATA },
  { path: '/compare/plans', priority: 0.9, changefreq: 'daily', lastmod: DATA },
  { path: '/quota-changes', priority: 0.6, changefreq: 'daily', lastmod: DATA },
  { path: '/compare/models', priority: 0.8, changefreq: 'daily', lastmod: DATA },
  { path: '/compare/video-models', priority: 0.82, changefreq: 'weekly', lastmod: catalog(['video-model'], '2026-10-19') },
  { path: '/coding-agents', priority: 0.84, changefreq: 'weekly', lastmod: { source: 'date', date: '2026-09-16' } },
  { path: '/plans', priority: 0.85, changefreq: 'daily', lastmod: DATA },
  { path: '/providers', priority: 0.85, changefreq: 'daily', lastmod: DATA },
  { path: '/agents', priority: 0.86, changefreq: 'weekly', lastmod: catalog(['agent'], '2026-09-15') },
  { path: '/creative-plans', priority: 0.82, changefreq: 'weekly', lastmod: catalog(['creative-plan'], '2026-09-15') },
  { path: '/video-models', priority: 0.84, changefreq: 'weekly', lastmod: catalog(['video-model'], '2026-10-15') },
  { path: '/music-models', priority: 0.8, changefreq: 'weekly', lastmod: catalog(['music-model'], '2026-09-16') },
  { path: '/voice-models', priority: 0.78, changefreq: 'weekly', lastmod: catalog(['voice-model'], '2026-10-15') },
  { path: '/image-models', priority: 0.78, changefreq: 'weekly', lastmod: catalog(['image-model'], '2026-10-15') },
  { path: '/decision-models', priority: 0.78, changefreq: 'weekly', lastmod: catalog(['decision-model'], '2026-10-15') },
  { path: '/world-models', priority: 0.78, changefreq: 'weekly', lastmod: catalog(['world-model'], '2026-10-15') },
  { path: '/coupons', priority: 0.7, changefreq: 'weekly', lastmod: DATA },
  { path: '/about', priority: 0.4, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/contact', priority: 0.3, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/disclosure', priority: 0.3, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/methodology', priority: 0.6, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/guides', priority: 0.75, changefreq: 'weekly', lastmod: DATA },
  ...PRICING_GUIDE_SLUGS.map((slug) => ({ path: `/guides/${slug}`, priority: 0.75, changefreq: 'daily' as const, lastmod: DATA })),
  { path: '/reports/api-price-index', priority: 0.8, changefreq: 'daily', lastmod: DATA },
  { path: '/privacy', priority: 0.3, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/terms', priority: 0.3, changefreq: 'monthly', lastmod: INFO_PAGES },
  { path: '/submit-provider', priority: 0.4, changefreq: 'monthly', lastmod: { source: 'date', date: '2026-09-16' } },
  // Note: /compare/api was removed because it only existed as a non-locale
  // route that proxy.ts redirected into a 404. /compare/models and /calculator
  // are locale routes and intentionally remain in the sitemap.
];

function validDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Real last-modified time for a fixed URL, or undefined to omit <lastmod>
 * (better than a made-up date) when the source is unavailable. Future
 * timestamps are clamped to `now`.
 */
export function resolveStaticLastmod(
  rule: StaticLastmod,
  context: { dataUpdatedAt: Date | string | null | undefined; catalog: Pick<AiCatalogItem, 'kind' | 'verifiedAt'>[]; now: Date },
): Date | undefined {
  let date: Date | undefined;
  if (rule.source === 'data') {
    date = validDate(context.dataUpdatedAt);
  } else if (rule.source === 'catalog') {
    const verified = context.catalog
      .filter((item) => rule.kinds.includes(item.kind))
      .map((item) => validDate(item.verifiedAt))
      .filter((value): value is Date => Boolean(value));
    date = verified.length
      ? new Date(Math.max(...verified.map((value) => value.getTime())))
      : validDate(rule.date);
  } else {
    date = validDate(rule.date);
  }
  if (!date) return undefined;
  return date.getTime() > context.now.getTime() ? context.now : date;
}
