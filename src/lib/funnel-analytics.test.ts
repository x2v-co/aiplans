import assert from 'node:assert/strict';
import test from 'node:test';
import { ANALYTICS_EVENT_DEFAULTS, FUNNEL_CUSTOM_DIMENSIONS, FUNNEL_GUIDE_SLUGS, resolveAnalyticsEventNames } from '../config/analytics-events';
import { PRICING_GUIDE_SLUGS } from './pricing-guides';
import {
  ANALYTICS_DIRECT,
  ANALYTICS_NOT_SET,
  FUNNEL_SESSION_TIMEOUT_MS,
  compareContext,
  funnelGuideSlug,
  gapBucket,
  outboundChannelDataset,
  pageGroup,
  priorVisitsBucket,
  readOutboundChannel,
  readUtm,
  referrerHost,
  sanitizeAnalyticsSlug,
  sanitizeAnalyticsToken,
  sanitizeChannelType,
  tickFunnel,
  trafficChannel,
  type FunnelSessionState,
  type FunnelVisitState,
} from './funnel-analytics';
import { buildFunnelWeeklyQueries, lastCompleteIsoWeek } from './funnel-weekly-query';

const ORIGIN = 'https://aiplans.dev';
const NOW = Date.parse('2026-10-18T03:00:00Z');

function tick(partial: Partial<Parameters<typeof tickFunnel>[0]> = {}) {
  return tickFunnel({
    pathname: '/en',
    search: '',
    referrer: '',
    origin: ORIGIN,
    today: '2026-10-18',
    now: NOW,
    session: null,
    visit: null,
    ...partial,
  });
}

test('event names are configurable and invalid overrides fall back', () => {
  assert.deepEqual(resolveAnalyticsEventNames({}), ANALYTICS_EVENT_DEFAULTS);
  assert.equal(
    resolveAnalyticsEventNames({ landing: 'visit_landed' }).landing,
    'visit_landed',
  );
  assert.equal(
    resolveAnalyticsEventNames({ landing: 'has space', outboundClick: '9nope' }).landing,
    ANALYTICS_EVENT_DEFAULTS.landing,
  );
  assert.equal(
    resolveAnalyticsEventNames({ outboundClick: 'click_out' }).outboundClick,
    'click_out',
  );
});

test('utm tokens drop emails, urls, and free text', () => {
  assert.equal(sanitizeAnalyticsToken('Zhihu'), 'zhihu');
  assert.equal(sanitizeAnalyticsToken('acq-2026-11'), 'acq-2026-11');
  assert.equal(sanitizeAnalyticsToken('ada@example.com'), null);
  assert.equal(sanitizeAnalyticsToken('https://evil.example/a'), null);
  assert.equal(sanitizeAnalyticsSlug('kimi-k2.5'), 'kimi-k2.5');
  const utm = readUtm('?utm_source=Zhihu&utm_medium=community&utm_campaign=acq-2026-11&utm_content=openai-api-pricing&utm_term=secret+query&email=ada@example.com');
  assert.deepEqual(utm, {
    utm_source: 'zhihu',
    utm_medium: 'community',
    utm_campaign: 'acq-2026-11',
    utm_content: 'openai-api-pricing',
  });
});

test('traffic channel prefers utm, then search, then referral, then direct', () => {
  assert.equal(trafficChannel('community', 'zhihu', 'zhihu.com'), 'community');
  assert.equal(trafficChannel('cpc', 'ads', null), 'paid');
  assert.equal(trafficChannel(ANALYTICS_NOT_SET, 'newsletter', null), 'campaign');
  assert.equal(referrerHost('https://www.google.com/search?q=secret', ORIGIN), 'google.com');
  assert.equal(trafficChannel(ANALYTICS_NOT_SET, ANALYTICS_NOT_SET, 'google.com'), 'organic');
  assert.equal(trafficChannel(ANALYTICS_NOT_SET, ANALYTICS_NOT_SET, 'news.ycombinator.com'), 'referral');
  assert.equal(referrerHost('https://aiplans.dev/zh/guides/x', ORIGIN), null);
  assert.equal(trafficChannel(ANALYTICS_NOT_SET, ANALYTICS_NOT_SET, null), 'direct');
});

test('page groups and compare context', () => {
  assert.equal(pageGroup('/zh'), 'home');
  assert.equal(pageGroup('/en/api-pricing'), 'api-pricing');
  assert.equal(pageGroup('/en/models/gpt-4o'), 'model');
  assert.equal(pageGroup('/zh/compare/plans'), 'compare-plans');
  assert.equal(pageGroup('/zh/compare/plans/kimi-k2.5'), 'compare-plan');
  assert.equal(pageGroup('/en/compare/models'), 'compare-models');
  assert.equal(pageGroup('/en/guides/openai-api-pricing'), 'guide');
  assert.deepEqual(compareContext('/zh/compare/plans/kimi-k2.5'), {
    compare_type: 'plans',
    model_slug: 'kimi-k2.5',
  });
  assert.equal(compareContext('/en/api-pricing'), null);
});

test('first consented visit records landing and not a return', () => {
  const result = tick({
    pathname: '/zh/guides/openai-api-pricing',
    search: '?utm_source=zhihu&utm_medium=community&utm_campaign=acq-2026-11&utm_content=openai-api-pricing',
    referrer: 'https://www.zhihu.com/question/1',
  });
  assert.deepEqual(result.events.map((event) => event.key), ['landing']);
  assert.equal(result.events[0].params.traffic_channel, 'community');
  assert.equal(result.events[0].params.utm_source, 'zhihu');
  assert.equal(result.events[0].params.page_group, 'guide');
  assert.equal(result.events[0].params.landing_page, '/zh/guides/openai-api-pricing');
  assert.equal(result.events[0].params.referrer_host, 'zhihu.com');
  assert.equal(result.events[0].params.guide_slug, 'openai-api-pricing');
  assert.equal(result.visit.sessions, 1);
  assert.equal(result.visit.outbound, false);
  assert.equal(JSON.stringify(result.events).includes('@'), false);
});

test('opening a compare page in the same session emits one compare view', () => {
  const landed = tick({ pathname: '/en/api-pricing' });
  const first = tick({
    pathname: '/en/compare/plans/gpt-4o',
    session: landed.session,
    visit: landed.visit,
  });
  assert.deepEqual(first.events.map((event) => event.key), ['compare']);
  assert.equal(first.events[0].params.compare_action, 'view');
  assert.equal(first.events[0].params.compare_type, 'plans');
  assert.equal(first.events[0].params.model_slug, 'gpt-4o');
  assert.equal(first.events[0].params.utm_source, ANALYTICS_NOT_SET);
  assert.equal(first.events[0].params.traffic_channel, 'direct');
  assert.equal(first.events[0].params.referrer_host, ANALYTICS_DIRECT);
  assert.equal(first.events[0].params.guide_slug, ANALYTICS_NOT_SET);

  const again = tick({
    pathname: '/en/compare/plans/gpt-4o',
    session: first.session,
    visit: first.visit,
  });
  assert.equal(again.events.length, 0);
});

test('a second tab inside 30 minutes does not count a return', () => {
  const landed = tick({ pathname: '/en' });
  const otherTab = tick({
    pathname: '/en/api-pricing',
    now: NOW + 5 * 60 * 1000,
    session: null,
    visit: landed.visit,
  });
  assert.equal(otherTab.events.length, 0);
  assert.equal(otherTab.visit.sessions, 1);
});

test('a later session is a return, and outbound is remembered without an id', () => {
  const landed = tick({ pathname: '/en/compare/models' });
  assert.deepEqual(landed.events.map((event) => event.key), ['landing', 'compare']);
  const afterClick: FunnelVisitState = { ...landed.visit, outbound: true };
  const returned = tick({
    pathname: '/zh',
    today: '2026-10-20',
    now: NOW + FUNNEL_SESSION_TIMEOUT_MS + 60_000,
    session: null,
    visit: afterClick,
    search: '',
    referrer: '',
  });
  assert.deepEqual(returned.events.map((event) => event.key), ['landing', 'returnVisit']);
  const back = returned.events[1];
  assert.equal(back.params.gap_bucket, '2-7d');
  assert.equal(back.params.prior_visits_bucket, '1');
  assert.equal(back.params.prior_outbound, 'yes');
  assert.equal(returned.visit.sessions, 2);
  assert.equal(JSON.stringify(returned.visit).includes('user'), false);
});

test('guide_slug is a published guide or (not set)', () => {
  assert.equal(funnelGuideSlug('/zh/guides/kimi-api-pricing'), 'kimi-api-pricing');
  assert.equal(funnelGuideSlug('/en/guides/cursor-x-subscription-pricing'), 'cursor-x-subscription-pricing');
  assert.equal(funnelGuideSlug('/en/guides'), ANALYTICS_NOT_SET);
  assert.equal(funnelGuideSlug('/en/guides/not-a-guide'), ANALYTICS_NOT_SET);
  assert.equal(funnelGuideSlug('/en/api-pricing'), ANALYTICS_NOT_SET);
  const home = tick({ pathname: '/en' });
  assert.equal(home.events[0].params.guide_slug, ANALYTICS_NOT_SET);
  assert.equal(home.events[0].key, 'landing');
  assert.deepEqual([...FUNNEL_GUIDE_SLUGS].sort(), [...PRICING_GUIDE_SLUGS].sort());
});

test('return buckets stay coarse', () => {
  assert.equal(gapBucket(0), 'same_day');
  assert.equal(gapBucket(1), '1d');
  assert.equal(gapBucket(7), '2-7d');
  assert.equal(gapBucket(30), '8-30d');
  assert.equal(gapBucket(31), '31d+');
  assert.equal(priorVisitsBucket(1), '1');
  assert.equal(priorVisitsBucket(4), '2-4');
  assert.equal(priorVisitsBucket(5), '5+');
});

test('outbound channel attributes keep provider type and model slug', () => {
  assert.deepEqual(outboundChannelDataset({
    channelSlug: 'OpenRouter',
    channelType: 'producer',
    modelSlug: 'kimi-k2.5',
  }), {
    'data-channel-slug': 'openrouter',
    'data-channel-type': 'official',
    'data-model-slug': 'kimi-k2.5',
  });
  assert.deepEqual(readOutboundChannel({
    channelSlug: 'siliconflow',
    channelType: 'aggregator',
    modelSlug: 'deepseek-chat',
  }), {
    channel_slug: 'siliconflow',
    channel_type: 'aggregator',
    model_slug: 'deepseek-chat',
  });
  assert.equal(sanitizeChannelType('not a channel'), ANALYTICS_NOT_SET);
  assert.equal(readOutboundChannel({}).channel_type, ANALYTICS_NOT_SET);
});

test('weekly queries cover the four stages and split by page and channel', () => {
  assert.deepEqual(lastCompleteIsoWeek('2026-10-18'), {
    startDate: '2026-10-05',
    endDate: '2026-10-11',
  });
  assert.deepEqual(lastCompleteIsoWeek('2026-10-19'), {
    startDate: '2026-10-12',
    endDate: '2026-10-18',
  });

  const report = buildFunnelWeeklyQueries({
    today: '2026-10-19',
    eventNames: ANALYTICS_EVENT_DEFAULTS,
  });
  assert.deepEqual(report.eventNames, [
    'funnel_landing',
    'funnel_compare',
    'funnel_outbound_click',
    'funnel_return_visit',
  ]);
  for (const request of [report.totals, report.byPageAndTraffic, report.byChannel, report.returns]) {
    assert.deepEqual(request.dateRanges, [{ startDate: '2026-10-12', endDate: '2026-10-18' }]);
    assert.deepEqual(request.dimensionFilter.filter.inListFilter.values, report.eventNames);
    assert.deepEqual(request.metrics.map((metric) => metric.name), ['eventCount', 'totalUsers']);
  }
  assert.deepEqual(report.byPageAndTraffic.dimensions.map((dimension) => dimension.name), [
    'eventName',
    'customEvent:page_group',
    'customEvent:traffic_channel',
    'customEvent:utm_source',
  ]);
  assert.ok(report.byChannel.dimensions.some((dimension) => dimension.name === 'customEvent:channel_type'));
  assert.ok(report.byChannel.dimensions.some((dimension) => dimension.name === 'customEvent:channel_slug'));
  assert.ok(report.customDimensions.includes('prior_outbound'));
  assert.ok(report.customDimensions.includes('guide_slug'));
  assert.equal(FUNNEL_CUSTOM_DIMENSIONS.length, 18);
  assert.deepEqual(report.bySourceCampaign.dimensions.map((dimension) => dimension.name), [
    'eventName',
    'customEvent:utm_source',
    'customEvent:utm_campaign',
  ]);
  assert.deepEqual(report.bySourceCampaign.dimensionFilter.filter.inListFilter.values, [
    'funnel_landing',
    'funnel_outbound_click',
  ]);
  assert.equal(report.eventNames.includes('funnel_alert_subscribe'), false);
  assert.equal(ANALYTICS_EVENT_DEFAULTS.alertSubscribe, 'funnel_alert_subscribe');
});

test('session state does not grow a transmitted identifier', () => {
  const result = tick({ pathname: '/en' });
  const session: FunnelSessionState = result.session;
  assert.equal('id' in session, false);
  assert.equal('clientId' in session, false);
  assert.ok(Array.isArray(session.compared));
});
