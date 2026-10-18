/**
 * Closed-loop analytics event names sent to the existing GA4 property.
 *
 * Call sites use the keys (`landing`, `compare`, `outboundClick`, `returnVisit`).
 * Rename an event by changing the default below, or set the matching
 * NEXT_PUBLIC_ANALYTICS_EVENT_* variable at build time. Invalid overrides are
 * ignored so a bad env value cannot drop the event on the floor.
 *
 * GA4 event names: start with a letter, then letters, digits, or underscores,
 * at most 40 characters. Do not put personal data in a name.
 */

const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

export const ANALYTICS_EVENT_DEFAULTS = {
  landing: 'funnel_landing',
  compare: 'funnel_compare',
  outboundClick: 'funnel_outbound_click',
  returnVisit: 'funnel_return_visit',
} as const;

export type FunnelEventKey = keyof typeof ANALYTICS_EVENT_DEFAULTS;

export type AnalyticsEventNameOverrides = Partial<Record<FunnelEventKey, string | undefined>>;

export function resolveAnalyticsEventNames(
  overrides?: AnalyticsEventNameOverrides,
): Record<FunnelEventKey, string> {
  const source: AnalyticsEventNameOverrides = overrides ?? {
    landing: process.env.NEXT_PUBLIC_ANALYTICS_EVENT_LANDING,
    compare: process.env.NEXT_PUBLIC_ANALYTICS_EVENT_COMPARE,
    outboundClick: process.env.NEXT_PUBLIC_ANALYTICS_EVENT_OUTBOUND,
    returnVisit: process.env.NEXT_PUBLIC_ANALYTICS_EVENT_RETURN,
  };

  const resolved = {} as Record<FunnelEventKey, string>;
  for (const key of Object.keys(ANALYTICS_EVENT_DEFAULTS) as FunnelEventKey[]) {
    const candidate = source[key]?.trim();
    resolved[key] = candidate && EVENT_NAME.test(candidate)
      ? candidate
      : ANALYTICS_EVENT_DEFAULTS[key];
  }
  return resolved;
}

export const ANALYTICS_EVENTS = resolveAnalyticsEventNames();

/**
 * Event-scoped parameters the weekly report splits on.
 * Each one must be registered once in GA4 Admin → Custom definitions
 * (scope: Event). Registration is not retroactive and is not a database migration.
 */
export const FUNNEL_CUSTOM_DIMENSIONS = [
  'page_group',
  'landing_page',
  'traffic_channel',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'referrer_host',
  'channel_type',
  'channel_slug',
  'model_slug',
  'link_domain',
  'compare_type',
  'compare_action',
  'gap_bucket',
  'prior_visits_bucket',
  'prior_outbound',
] as const;

export type FunnelCustomDimension = (typeof FUNNEL_CUSTOM_DIMENSIONS)[number];
