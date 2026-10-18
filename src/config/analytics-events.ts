/**
 * Closed-loop analytics event names sent to the existing GA4 property.
 *
 * Call sites use the keys (`landing`, `compare`, `outboundClick`, `returnVisit`).
 * `alertSubscribe` is reserved for the price-change alert card, which is not
 * built yet. Do not send it until that card ships.
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
  /**
   * Placeholder only. The price-change alert card does not exist yet.
   * When it ships, send this after analytics consent with FunnelAlertSubscribeParams.
   * Nothing in the app calls it today, and the weekly queries do not include it.
   */
  alertSubscribe: 'funnel_alert_subscribe',
} as const;

/**
 * Published guide slugs allowed on funnel events. Kept in sync with
 * PRICING_GUIDE_SLUGS by unit test. Any other path, including the guides
 * index, is reported as `(not set)`.
 */
export const FUNNEL_GUIDE_SLUGS = [
  'glm-chatglm-api-pricing',
  'claude-anthropic-pricing',
  'grok-pricing',
  'kimi-api-pricing',
  'openai-api-pricing',
  'cursor-x-subscription-pricing',
] as const;

export type FunnelGuideSlug = (typeof FUNNEL_GUIDE_SLUGS)[number];

/** Delivery channel for the future alert card. Not a pricing-channel type. */
export const ALERT_SUBSCRIBE_CHANNELS = ['email', 'rss'] as const;

export type AlertSubscribeChannel = (typeof ALERT_SUBSCRIBE_CHANNELS)[number];

/**
 * Params to send with `funnel_alert_subscribe` once the alert card exists.
 * `guide_slug` is a FUNNEL_GUIDE_SLUGS value or `(not set)`.
 * `channel` is email or rss. Register that custom dimension at ship time;
 * it is intentionally absent from FUNNEL_CUSTOM_DIMENSIONS until then.
 */
export type FunnelAlertSubscribeParams = {
  page_group: string;
  guide_slug: string;
  model_slug: string;
  channel: AlertSubscribeChannel;
};

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
    alertSubscribe: process.env.NEXT_PUBLIC_ANALYTICS_EVENT_ALERT,
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
  'guide_slug',
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
