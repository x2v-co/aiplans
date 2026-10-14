import { getAnalyticsConsentSnapshot } from '@/lib/consent';

export type AnalyticsEventName =
  | 'compare_start'
  | 'comparison_model_change'
  | 'outbound_click'
  | 'pricing_filter_change'
  | 'pricing_search'
  | 'global_search'
  | 'guide_model_click';

export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type TrackedLink =
  | { kind: 'comparison'; compareType: 'models' | 'plans'; targetPath: string }
  | { kind: 'outbound'; domain: string; url: string }
  | { kind: 'guide_target'; targetType: 'model' | 'plan'; targetSlug: string; targetPath: string }
  | null;

/** Guide slug when the current page is /{locale}/guides/{slug}, else null. */
export function guideSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/(?:en|zh)\/guides\/([^/?#]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Classify a clicked link. Pass `fromPath` (current page path) so that
 * guide → model / guide → plan clicks can be observed separately as
 * `guide_model_click`; other internal links stay untracked.
 */
export function classifyTrackedLink(href: string, siteOrigin: string, fromPath?: string): TrackedLink {
  let url: URL;
  let origin: URL;

  try {
    origin = new URL(siteOrigin);
    url = new URL(href, origin);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null;

  if (url.origin !== origin.origin) {
    return { kind: 'outbound', domain: url.hostname, url: url.toString() };
  }

  if (fromPath && guideSlugFromPath(fromPath)) {
    const target = url.pathname.match(/^\/(?:en|zh)\/(models|plans|providers)\/([^/]+)\/?$/);
    if (target) {
      return {
        kind: 'guide_target',
        targetType: target[1] === 'models' ? 'model' : 'plan',
        targetSlug: decodeURIComponent(target[2]),
        targetPath: `${url.pathname}${url.search}`,
      };
    }
  }

  const comparison = url.pathname.match(/^\/(?:en|zh)\/compare\/(models|plans)(?:\/|$)/);
  if (!comparison) return null;

  return {
    kind: 'comparison',
    compareType: comparison[1] as 'models' | 'plans',
    targetPath: `${url.pathname}${url.search}`,
  };
}

export function trackAnalyticsEvent(
  name: AnalyticsEventName,
  params: AnalyticsEventParams = {},
) {
  if (typeof window === 'undefined' || !getAnalyticsConsentSnapshot()) return;

  window.gtag?.('event', name, {
    ...params,
    page_path: `${window.location.pathname}${window.location.search}`,
  });
}
