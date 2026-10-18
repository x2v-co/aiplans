/**
 * GA4 Data API runReport bodies for the weekly closed-loop report.
 *
 * Paste each request into the GA4 Query Explorer for the existing property.
 * No new analytics product and no database query. Custom dimensions listed in
 * FUNNEL_CUSTOM_DIMENSIONS must be registered before the split reports return
 * rows; the totals request uses only the built-in eventName dimension.
 */

import {
  FUNNEL_CUSTOM_DIMENSIONS,
  resolveAnalyticsEventNames,
  type AnalyticsEventNameOverrides,
} from '@/config/analytics-events';

export type Ga4ReportRequest = {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter: {
    filter: {
      fieldName: 'eventName';
      inListFilter: { values: string[] };
    };
  };
  limit: string;
  metricAggregations?: string[];
};

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday–Sunday that ended before `today` (UTC). */
export function lastCompleteIsoWeek(today: string): { startDate: string; endDate: string } {
  const day = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) {
    throw new Error(`Invalid day: ${today}`);
  }
  const dow = day.getUTCDay();
  const back = dow === 0 ? 7 : dow;
  const end = new Date(day.getTime() - back * 86_400_000);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function eventNames(overrides?: AnalyticsEventNameOverrides): string[] {
  const names = resolveAnalyticsEventNames(overrides);
  return [names.landing, names.compare, names.outboundClick, names.returnVisit];
}

function baseRequest(
  range: { startDate: string; endDate: string },
  names: string[],
  dimensions: string[],
): Ga4ReportRequest {
  return {
    dateRanges: [range],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: names },
      },
    },
    limit: '10000',
  };
}

export type FunnelWeeklyQueries = {
  range: { startDate: string; endDate: string };
  eventNames: string[];
  customDimensions: readonly string[];
  /** One row per stage. Use totalUsers for the weekly ratios. */
  totals: Ga4ReportRequest;
  /** Stage × page family × acquisition channel. */
  byPageAndTraffic: Ga4ReportRequest;
  /** Outbound stage × provider channel. Filter to the outbound event when reading. */
  byChannel: Ga4ReportRequest;
  /** Return stage × gap × whether this browser had an earlier outbound click. */
  returns: Ga4ReportRequest;
  /** Landing and outbound users by campaign. Compare and return are excluded. */
  bySourceCampaign: Ga4ReportRequest;
};

export function buildFunnelWeeklyQueries(options?: {
  today?: string;
  eventNames?: AnalyticsEventNameOverrides;
}): FunnelWeeklyQueries {
  const today = options?.today ?? isoDate(new Date());
  const range = lastCompleteIsoWeek(today);
  const names = eventNames(options?.eventNames);
  const resolved = resolveAnalyticsEventNames(options?.eventNames);
  return {
    range,
    eventNames: names,
    customDimensions: FUNNEL_CUSTOM_DIMENSIONS,
    totals: baseRequest(range, names, ['eventName']),
    byPageAndTraffic: baseRequest(range, names, [
      'eventName',
      'customEvent:page_group',
      'customEvent:traffic_channel',
      'customEvent:utm_source',
    ]),
    byChannel: baseRequest(range, names, [
      'eventName',
      'customEvent:page_group',
      'customEvent:channel_type',
      'customEvent:channel_slug',
    ]),
    returns: baseRequest(range, names, [
      'eventName',
      'customEvent:gap_bucket',
      'customEvent:prior_visits_bucket',
      'customEvent:prior_outbound',
    ]),
    bySourceCampaign: baseRequest(range, [resolved.landing, resolved.outboundClick], [
      'eventName',
      'customEvent:utm_source',
      'customEvent:utm_campaign',
    ]),
  };
}
