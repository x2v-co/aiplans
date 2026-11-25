import { cache } from 'react';
import { getPlanComparison } from './compare-plans';
import { getSeoIndexCatalog } from './seo-index-data';
import { compareSeoFallback, SEO_MODEL_ALLOWLIST } from './seo-index-policy';
import { legacySlugRedirect } from './legacy-slug-redirects';

/** A single payload/renderer serves both routes, including plan kinds, features,
 * quota units, currencies, annual tiers and coverage. No content projection.
 */
export const getPlanComparisonForPage = cache((slug: string) => getPlanComparison(slug, 'USD'));

export const getIntegratedPlanComparison = cache(async (slug: string) => {
  if (!SEO_MODEL_ALLOWLIST.has(slug)) return null;
  const catalog = await getSeoIndexCatalog();
  // Avoid loading subscription data for retired/otherwise ineligible models.
  if (!compareSeoFallback('en', slug, catalog, slug)) return null;
  const data = await getPlanComparisonForPage(slug);
  return data && compareSeoFallback('en', slug, catalog, data.model.slug) ? data : null;
});

/** Resolve old names as identity data before making any redirect decision.
 * A failed parity check retains an accessible comparison at the requested URL.
 * Both metadata/body and the proxy use this loader, so aliases cannot bypass it.
 */
export const getComparisonPage = cache(async (requestedSlug: string) => {
  const { findModelSlugRedirect } = await import('./model-slug-redirects');
  const legacy = legacySlugRedirect(`/en/compare/plans/${encodeURIComponent(requestedSlug)}`);
  const match = legacy && /^\/en\/(?:models|compare\/plans)\/([^/]+)$/.exec(legacy);
  let slug = match ? decodeURIComponent(match[1]) : requestedSlug;
  let data = await getPlanComparisonForPage(slug);
  if (!data && !legacy) {
    const renamed = await findModelSlugRedirect(requestedSlug);
    if (renamed && renamed !== requestedSlug) {
      slug = renamed;
      data = await getPlanComparisonForPage(slug);
    }
  }
  const catalog = await getSeoIndexCatalog();
  const exists = catalog.some(row => row.slug === slug);
  if (!data && !exists && !legacy && slug === requestedSlug) return null;
  // Never display another product's comparison as this model's content.
  const exactData = data?.model.slug === slug ? data : null;
  return { slug, data: exactData,
    redirect: compareSeoFallback('en', slug, catalog, exactData?.model.slug),
  };
});
