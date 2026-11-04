/**
 * Catalog list/detail pages are ISR (see e.g. src/app/[locale]/models/page.tsx)
 * so crawlers and visitors get cached HTML. A few of them also accept filter
 * query strings, and a cached page cannot read the query. src/proxy.ts rewrites
 * those filtered requests to an internal per-request route under
 * /[locale]/filtered/..., which renders the same view with the query applied.
 *
 * Keep each entry's params in sync with the page's `searchParams` type.
 */
const LOCALE = '(?:en|zh)';
const FILTERED_PREFIX = 'filtered';

interface CatalogQueryRoute {
  pattern: RegExp;
  params: readonly string[];
}

const CATALOG_QUERY_ROUTES: readonly CatalogQueryRoute[] = [
  { pattern: new RegExp(`^/${LOCALE}/models$`), params: ['promo'] },
  { pattern: new RegExp(`^/${LOCALE}/plans$`), params: ['kind'] },
  { pattern: new RegExp(`^/${LOCALE}/api-pricing$`), params: ['q', 'sort', 'order', 'china', 'region', 'channel', 'promo'] },
  { pattern: new RegExp(`^/${LOCALE}/compare/models$`), params: ['models'] },
  { pattern: new RegExp(`^/${LOCALE}/providers/[^/]+$`), params: ['period'] },
];

/** Internal pathname for a filtered catalog request, or null when the cached page serves it. */
export function filteredCatalogPath(pathname: string, searchParams: URLSearchParams): string | null {
  const route = CATALOG_QUERY_ROUTES.find(candidate => candidate.pattern.test(pathname));
  if (!route || !route.params.some(param => searchParams.has(param))) return null;
  const [, locale, ...rest] = pathname.split('/');
  return `/${locale}/${FILTERED_PREFIX}/${rest.join('/')}`;
}

/** Public pathname for a direct request to the internal filtered route, or null. */
export function publicPathForFilteredRoute(pathname: string): string | null {
  const match = new RegExp(`^/(${LOCALE})/${FILTERED_PREFIX}(?:/(.*))?$`).exec(pathname);
  // The filtered pages' og:image points at their own opengraph-image route.
  if (!match || pathname.endsWith('/opengraph-image')) return null;
  return match[2] ? `/${match[1]}/${match[2]}` : `/${match[1]}`;
}
