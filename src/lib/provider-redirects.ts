import { decodeSlugParam } from './route-params';

/** Only aliases whose targets do not depend on the database belong in config. */
export function providerRedirects() {
  return [
    { source: '/:locale(en|zh)/plans/cursor', destination: '/:locale/providers/xai', statusCode: 301 as const },
    { source: '/plans/cursor', destination: '/en/providers/xai', statusCode: 301 as const },
  ];
}

export type PlanRedirectRequest = { locale: string; slug: string };
export type PlanRedirectRow = {
  kind: 'provider' | 'plan';
  slug: string;
  provider_slug: string | null;
};

/** Exactly one slug, with the same static-child and metadata exclusions as before. */
export function planRedirectRequest(pathname: string, staticSegments: string[] = []): PlanRedirectRequest | null {
  const match = /^(?:\/(en|zh))?\/plans\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const slug = decodeSlugParam(match[2]);
  const reserved = ['opengraph-image', 'twitter-image', 'icon', 'apple-icon', ...staticSegments];
  if (reserved.some(segment => slug === segment || slug.startsWith(`${segment}.`))) return null;
  return { locale: match[1] || 'en', slug };
}

export function resolvePlanRedirect({ locale, slug }: PlanRedirectRequest, catalog: readonly PlanRedirectRow[]): string {
  const base = `/${locale}/providers/`;
  if (slug === 'cursor') return `${base}xai`;
  if (!catalog.some(row => row.kind === 'provider' && row.slug === slug)) {
    // Count rows, not distinct owners: even duplicate plans of one provider are ambiguous.
    const plans = catalog.filter(row => row.kind === 'plan' && row.slug === slug);
    if (plans.length === 1 && plans[0].provider_slug) {
      return `${base}${encodeURIComponent(plans[0].provider_slug)}#${encodeURIComponent(slug)}`;
    }
  }
  return `${base}${encodeURIComponent(slug)}`;
}

/** Bound both the proxy wait and cached loads so a stalled DB cannot block retries. */
export async function withPlanRedirectCatalogTimeout(load: () => Promise<PlanRedirectRow[]>): Promise<PlanRedirectRow[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Plan redirect catalog load timed out after 2000ms')), 2000);
  });
  try {
    return await Promise.race([load(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** One bounded catalog per process, shared by locales and unknown slugs. */
export function cachePlanRedirectCatalog(
  load: () => Promise<PlanRedirectRow[]>,
  { ttlMs = 5 * 60 * 1000, now = Date.now } = {},
): () => Promise<PlanRedirectRow[]> {
  let cached: PlanRedirectRow[] | undefined;
  let expiresAt = 0;
  let pending: Promise<PlanRedirectRow[]> | undefined;
  return async () => {
    if (cached && now() < expiresAt) return cached;
    if (!pending) {
      pending = withPlanRedirectCatalogTimeout(load).then(rows => {
        cached = rows;
        expiresAt = now() + ttlMs;
        return rows;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}
