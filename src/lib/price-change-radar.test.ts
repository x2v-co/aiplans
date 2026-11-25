import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareQuotes, type RawChannelQuote } from './citable-price-facts';
import {
  analyzeObservations,
  classifyPriceHistoryRow,
  renderRadarDraft,
  type HistoryRow,
} from './price-change-radar';

const AS_OF = new Date('2026-11-01T00:00:00.000Z');
const VERIFIED = '2026-10-20T00:00:00.000Z';
const CONDITIONS = 'scope=headline;input=quoted;output=quoted;cache=missing;promo=none';

function row(overrides: Record<string, unknown> = {}): RawChannelQuote {
  return {
    model_slug: 'example-alpha',
    model_name: 'Example Alpha',
    provider_slug: 'example-official',
    provider_name: 'Example Official',
    provider_type: 'official',
    currency: 'USD',
    price_unit: 'per_1m_tokens',
    input_price_per_1m: 100,
    output_price_per_1m: 100,
    source_url: 'https://pricing.example.com/alpha',
    last_verified: VERIFIED,
    is_available: true,
    ...overrides,
  };
}

function bundle(name: string): { as_of: string; rows: RawChannelQuote[] } {
  return JSON.parse(readFileSync(new URL(`../../scripts/fixtures/citable-radar/${name}`, import.meta.url), 'utf8'));
}

function history(overrides: Record<string, unknown> = {}): HistoryRow {
  return {
    model_slug: 'example-alpha',
    model_name: 'Example Alpha',
    provider_slug: 'example-official',
    provider_name: 'Example Official',
    old_currency: 'USD',
    new_currency: 'USD',
    old_price_unit: 'per_1m_tokens',
    new_price_unit: 'per_million_tokens',
    old_billing_conditions: CONDITIONS,
    new_billing_conditions: CONDITIONS,
    old_input_price: 2,
    new_input_price: 3,
    old_output_price: 8,
    new_output_price: 8,
    source_url_previous: 'https://pricing.example.com/old',
    source_url_current: 'https://pricing.example.com/new',
    verified_at_previous: VERIFIED,
    verified_at_current: VERIFIED,
    change_percent: 0,
    ...overrides,
  };
}

function reasons(report: ReturnType<typeof analyzeObservations>, reason: string): string[] {
  return report.withheld.filter((item) => item.reason === reason).map((item) => item.identity);
}

test('fixture comparison emits only the same-scope move at or above 15 percent', () => {
  const previousBundle = bundle('previous.json');
  const currentBundle = bundle('current.json');
  const historyBundle = JSON.parse(readFileSync(new URL('../../scripts/fixtures/citable-radar/stock-history.json', import.meta.url), 'utf8')) as { rows: HistoryRow[] };
  const options = { allowFixture: true, asOf: AS_OF, generatedAt: AS_OF };
  const previous = prepareQuotes(previousBundle.rows, options);
  const current = prepareQuotes(currentBundle.rows, options);
  const report = analyzeObservations(previous.observations, current.observations, {
    thresholdPercent: 15,
    asOf: AS_OF,
    fixture: true,
    previousSnapshotId: previous.snapshot.snapshot_id,
    currentSnapshotId: current.snapshot.snapshot_id,
    previousAsOf: previous.as_of,
    currentAsOf: current.as_of,
    currentExcludedCounts: current.excluded_counts,
  }, historyBundle.rows, current.rejections);

  assert.equal(previous.snapshot.coverage.included, 11);
  assert.equal(current.snapshot.coverage.included, 8);
  assert.deepEqual(report.publishable_events.map((event) => event.model_slug), ['example-alpha']);
  const event = report.publishable_events[0];
  assert.equal(event.components.find((part) => part.component === 'input')?.change_percent, 50);
  assert.equal(event.currency, 'USD');
  assert.equal(event.price_unit, 'per_1m_tokens');
  assert.equal(event.source_url_current, 'https://example.test/pricing/alpha');
  assert.equal(event.citation_url_en, 'https://aiplans.dev/en/models/example-alpha');
  assert.equal(event.citation_url_zh, 'https://aiplans.dev/zh/models/example-alpha');
  assert.equal(current.publishable.find((quote) => quote.model_slug === 'example-delta')?.zero_price, true);
  assert.ok(reasons(report, 'below_threshold').some((identity) => identity.includes('example-beta')));
  assert.match(report.withheld.find((item) => item.identity.includes('example-beta'))?.detail ?? '', /max_abs_percent=10\.00/);
  assert.ok(reasons(report, 'unit_changed').some((identity) => identity.includes('example-gamma')));
  assert.ok(reasons(report, 'zero_value').some((identity) => identity.includes('example-delta')));
  assert.ok(reasons(report, 'missing_price').some((identity) => identity.includes('example-epsilon')));
  assert.ok(reasons(report, 'currency_changed').some((identity) => identity.includes('example-zeta')));
  assert.ok(reasons(report, 'condition_changed').some((identity) => identity.includes('example-eta')));
  assert.ok(reasons(report, 'stale').some((identity) => identity.includes('example-theta')));
  assert.ok(reasons(report, 'not_in_current_rows').some((identity) => identity.includes('example-iota')));
  assert.ok(reasons(report, 'version_replaced').some((identity) => identity.includes('example-kappa-v2')));
  assert.equal(reasons(report, 'not_in_current_rows').some((identity) => identity.includes('kappa')), false);
  assert.ok(reasons(report, 'new_listing').some((identity) => identity.includes('example-nu')));
  assert.ok(reasons(report, 'missing_source').some((identity) => identity.includes('example-omicron')));
  assert.ok(reasons(report, 'unverified').some((identity) => identity.includes('example-pi')));
  assert.equal(report.history_publishable_events.length, 0);
  assert.equal(report.history_withheld_counts.incomplete_history, 1);
  assert.equal(current.excluded_counts.non_official_channel, 2);

  const zh = renderRadarDraft(report, 'zh');
  const en = renderRadarDraft(report, 'en');
  for (const draft of [zh, en]) {
    assert.equal(draft.includes('fixture-secret-note-9f3a'), false);
    assert.equal(draft.includes('secret-token-should-not-export'), false);
    assert.equal(draft.includes('sk-test-secret'), false);
    assert.equal(draft.includes('424242'), false);
    assert.equal(draft.includes('497'), false);
    assert.equal(draft.includes('711'), false);
    assert.equal(draft.includes('全网最低'), false);
    assert.equal(draft.toLowerCase().includes('lowest price on the web'), false);
  }
  assert.match(zh, /示例数据，不是市场价格/);
  assert.match(zh, /不要发送/);
  assert.match(zh, /example-alpha/);
  assert.match(zh, /\+50%/);
  assert.match(zh, /incomplete_history: 1/);
  assert.match(zh, /non_official_channel: 2/);
  assert.match(en, /Synthetic fixture/);
  assert.match(en, /do not send/i);
  assert.equal(report.publishable_events.some((event) => event.model_slug === 'example-eta'), false);
  assert.equal(report.publishable_events.some((event) => event.model_slug === 'example-theta'), false);
});

test('15 percent is an inclusive denoising setting and duplicates collapse', () => {
  const previous = prepareQuotes([row()], { asOf: AS_OF }).observations;
  const atThreshold = prepareQuotes([row({ input_price_per_1m: 115 })], { asOf: AS_OF }).observations;
  const below = prepareQuotes([row({ input_price_per_1m: 114 })], { asOf: AS_OF }).observations;
  assert.equal(analyzeObservations(previous, atThreshold, { thresholdPercent: 15 }).publishable_events.length, 1);
  assert.equal(analyzeObservations(previous, below, { thresholdPercent: 15 }).publishable_events.length, 0);
  const fourteen = analyzeObservations(previous, below, { thresholdPercent: 14 }).publishable_events[0].components[0].change_percent;
  assert.ok(Math.abs(fourteen - 14) < 1e-6);
  assert.throws(() => analyzeObservations(previous, atThreshold, { thresholdPercent: -1 }), /thresholdPercent/);

  const duplicated = analyzeObservations(previous, [...atThreshold, ...atThreshold], { thresholdPercent: 15 });
  assert.equal(duplicated.publishable_events.length, 1);
  assert.ok(duplicated.duplicates_collapsed >= 1);

  const outputOnly = analyzeObservations(
    previous,
    prepareQuotes([row({ output_price_per_1m: 150 })], { asOf: AS_OF }).observations,
    { thresholdPercent: 15 },
  );
  assert.equal(outputOnly.publishable_events.length, 1);
  assert.equal(outputOnly.publishable_events[0].components.find((part) => part.component === 'output')?.change_percent, 50);

  const cacheOnly = analyzeObservations(
    prepareQuotes([row({ cached_input_price_per_1m: 1 })], { asOf: AS_OF }).observations,
    prepareQuotes([row({ cached_input_price_per_1m: 2 })], { asOf: AS_OF }).observations,
    { thresholdPercent: 15 },
  );
  assert.equal(cacheOnly.publishable_events[0].components.find((part) => part.component === 'cached_input')?.change_percent, 100);
});

test('a lower threshold can keep a 10 percent move that 15 percent drops', () => {
  const previousBundle = bundle('previous.json');
  const currentBundle = bundle('current.json');
  const options = { allowFixture: true, asOf: AS_OF, generatedAt: AS_OF };
  const previous = prepareQuotes(previousBundle.rows, options);
  const current = prepareQuotes(currentBundle.rows, options);
  const report = analyzeObservations(previous.observations, current.observations, { thresholdPercent: 10, fixture: true }, [], current.rejections);
  assert.deepEqual(report.publishable_events.map((event) => event.model_slug).sort(), ['example-alpha', 'example-beta']);
});

test('no previous snapshot establishes a baseline and does not invent events', () => {
  const current = prepareQuotes(bundle('current.json').rows, { allowFixture: true, asOf: AS_OF, generatedAt: AS_OF });
  const stock = JSON.parse(readFileSync(new URL('../../scripts/fixtures/citable-radar/stock-history.json', import.meta.url), 'utf8')) as { rows: HistoryRow[] };
  const report = analyzeObservations(null, current.observations, { fixture: true, currentSnapshotId: current.snapshot.snapshot_id }, stock.rows);
  assert.equal(report.baseline_only, true);
  assert.equal(report.publishable_events.length, 0);
  assert.equal(report.history_publishable_events.length, 0);
  assert.equal(report.withheld[0].reason, 'baseline_without_previous');
  const draft = renderRadarDraft(report, 'zh');
  assert.match(draft, /没有可发的快照对比事件/);
  assert.match(draft, /历史日志没有可发事件/);
  assert.equal(draft.includes('全网最低'), false);
});

test('stock price_history cannot publish, and a complete row ignores the stored percent', () => {
  const stock = classifyPriceHistoryRow({
    channel_price_id: 7,
    old_input_price: 2,
    new_input_price: 3,
    old_output_price: 8,
    new_output_price: 8,
    change_percent: 50,
    currency: 'USD',
    source: 'example-scraper',
    recorded_at: VERIFIED,
  }, { asOf: AS_OF });
  assert.equal(stock.event, null);
  assert.equal(stock.reason, 'incomplete_history');

  const ignoredPercent = classifyPriceHistoryRow(history({ old_input_price: 10, new_input_price: 11, change_percent: 80 }), { asOf: AS_OF, thresholdPercent: 15 });
  assert.equal(ignoredPercent.event, null);
  assert.equal(ignoredPercent.reason, 'below_threshold');

  const recomputed = classifyPriceHistoryRow(history({ change_percent: 0 }), { asOf: AS_OF, thresholdPercent: 15 });
  assert.equal(recomputed.event?.components.find((part) => part.component === 'input')?.change_percent, 50);
  assert.equal(recomputed.event?.price_unit, 'per_1m_tokens');

  assert.equal(classifyPriceHistoryRow(history({ new_currency: 'CNY' }), { asOf: AS_OF }).reason, 'currency_pair_changed');
  assert.equal(classifyPriceHistoryRow(history({ new_price_unit: 'per_1k_tokens' }), { asOf: AS_OF }).reason, 'unit_changed');
  assert.equal(classifyPriceHistoryRow(history({ new_billing_conditions: `${CONDITIONS};extra` }), { asOf: AS_OF }).reason, 'condition_changed');
  assert.equal(classifyPriceHistoryRow(history({ new_input_price: 0 }), { asOf: AS_OF }).reason, 'zero_value');
  assert.equal(classifyPriceHistoryRow(history({ verified_at_previous: '2020-01-01T00:00:00.000Z' }), { asOf: AS_OF }).reason, 'stale');
});

test('identical history and snapshot events collapse to one draft event', () => {
  const previous = prepareQuotes([row({ input_price_per_1m: 2, output_price_per_1m: 8 })], { asOf: AS_OF });
  const current = prepareQuotes([row({ input_price_per_1m: 3, output_price_per_1m: 8 })], { asOf: AS_OF });
  const event = classifyPriceHistoryRow(history({
    old_billing_conditions: current.publishable[0].billing_conditions,
    new_billing_conditions: current.publishable[0].billing_conditions,
    source_url_previous: 'https://pricing.example.com/alpha',
    source_url_current: 'https://pricing.example.com/alpha',
  }), { asOf: AS_OF });
  const report = analyzeObservations(previous.observations, current.observations, { thresholdPercent: 15, asOf: AS_OF }, event.event ? [history({
    old_billing_conditions: current.publishable[0].billing_conditions,
    new_billing_conditions: current.publishable[0].billing_conditions,
    source_url_previous: 'https://pricing.example.com/alpha',
    source_url_current: 'https://pricing.example.com/alpha',
  })] : []);
  assert.equal(report.publishable_events.length, 1);
  assert.equal(report.history_publishable_events.length, 0);
  assert.ok(report.duplicates_collapsed >= 1);
});
