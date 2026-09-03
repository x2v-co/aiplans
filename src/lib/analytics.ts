import { getAnalyticsConsentSnapshot } from '@/lib/consent';

export type AnalyticsEventName =
  | 'compare_start'
  | 'comparison_model_change'
  | 'outbound_click'
  | 'pricing_filter_change'
  | 'pricing_search';

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
  | null;

export function classifyTrackedLink(href: string, siteOrigin: string): TrackedLink {
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
