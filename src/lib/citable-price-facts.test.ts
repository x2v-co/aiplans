import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CITABLE_SCHEMA,
  COVERAGE_WORDING,
  PUBLIC_QUOTE_FIELDS,
  citableRequestPlan,
  prepareQuotes,
  snapshotToCsv,
  type RawChannelQuote,
} from './citable-price-facts';

const AS_OF = new Date('2026-11-01T00:00:00.000Z');
const VERIFIED = '2026-10-20T00:00:00.000Z';
const SECRET = 'fixture-secret-note-9f3a';
const TOKEN = 'secret-token-should-not-export';
const FORBIDDEN_KEYS = new Set([
  'id', 'notes', 'invite_url', 'api_key', 'raw_json', 'channel_price_id',
  'data_for_discount', 'token', 'password', 'email', 'model_id', 'provider_id',
]);

function row(overrides: Record<string, unknown> = {}): RawChannelQuote {
  return {
    model_slug: 'example-alpha',
    model_name: 'Example Alpha',
    provider_slug: 'example-official',
    provider_name: 'Example Official',
    provider_type: 'official',
    currency: 'usd',
    price_unit: 'per_1m_tokens',
    input_price_per_1m: 2,
    output_price_per_1m: 8,
    source_url: 'https://pricing.example.com/alpha',
    last_verified: VERIFIED,
    is_available: true,
    ...overrides,
  };
}

function quotes(overrides: Record<string, unknown> = {}, options: { allowFixture?: boolean; asOf?: Date; generatedAt?: Date } = {}) {
  return prepareQuotes([row(overrides)], { asOf: AS_OF, generatedAt: AS_OF, ...options });
}

function walk(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(FORBIDDEN_KEYS.has(key), false, key);
    walk(child);
  }
}

test('normalizes case, unit aliases, and a stable snapshot id', () => {
  const first = prepareQuotes([
    row({ price_unit: 'per-million-tokens', model_name: ' Example   Alpha ' }),
    row({ model_slug: 'example-beta', model_name: 'Example Beta', input_price_per_1m: 4, output_price_per_1m: 4, source_url: 'https://pricing.example.com/beta' }),
  ], { asOf: AS_OF, generatedAt: AS_OF });
  const reversed = prepareQuotes([
    row({ model_slug: 'example-beta', model_name: 'Example Beta', input_price_per_1m: 4, output_price_per_1m: 4, source_url: 'https://pricing.example.com/beta' }),
    row({ price_unit: 'PER_1M_TOKENS' }),
  ], { asOf: AS_OF, generatedAt: new Date('2026-12-01T00:00:00.000Z') });
  assert.equal(first.snapshot.schema, CITABLE_SCHEMA);
  assert.equal(first.snapshot.prior_snapshots_retained, false);
  assert.equal(first.snapshot.history, 'current_sample_only');
  assert.equal(first.snapshot.redistribution.granted_license, null);
  assert.equal(first.snapshot.redistribution.cc0, false);
  assert.equal(first.snapshot.redistribution.mit, false);
  assert.match(first.snapshot.snapshot_id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.snapshot.snapshot_id, reversed.snapshot.snapshot_id);
  assert.notEqual(first.snapshot.generated_at, reversed.snapshot.generated_at);
  assert.equal(first.publishable[0].currency, 'USD');
  assert.equal(first.publishable[0].price_unit, 'per_1m_tokens');
  assert.equal(first.publishable[0].model_name, 'Example Alpha');
  assert.deepEqual(Object.keys(first.publishable[0]), [...PUBLIC_QUOTE_FIELDS]);
  assert.match(first.publishable[0].citation_url_zh, /\/zh\/models\/example-alpha$/);
  assert.match(first.publishable[0].billing_conditions, /cache=missing/);
  assert.equal(first.publishable[0].input_missing, false);
  assert.equal(first.publishable[0].cached_input_missing, true);
  assert.equal(first.publishable[0].cached_input_price, null);
});

test('download fields omit secrets and mark missing prices instead of inventing zero', () => {
  const prepared = quotes({
    id: 424242,
    notes: SECRET,
    invite_url: `https://evil.example/invite?token=${TOKEN}`,
    api_key: 'sk-test-secret',
    output_price_per_1m: null,
    cached_input_price_per_1m: null,
  });
  const encoded = JSON.stringify(prepared.snapshot);
  assert.equal(encoded.includes(SECRET), false);
  assert.equal(encoded.includes(TOKEN), false);
  assert.equal(encoded.includes('sk-test-secret'), false);
  assert.equal(encoded.includes('424242'), false);
  walk(prepared.snapshot);
  const quote = prepared.publishable[0];
  assert.equal(quote.output_price, null);
  assert.equal(quote.output_missing, true);
  assert.equal(quote.zero_price, false);
  const csv = snapshotToCsv(prepared.snapshot);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.includes(SECRET), false);
  assert.ok(csv.startsWith(`\uFEFF${PUBLIC_QUOTE_FIELDS.join(',')}`));
});

test('guards spreadsheet formulas in csv cells', () => {
  const csv = snapshotToCsv(quotes({ model_name: '=HYPERLINK("https://evil.example")' }).snapshot);
  assert.match(csv, /'=HYPERLINK/);
});

test('keeps an active promo and its regular price, and restores a finished promo', () => {
  const active = quotes({
    input_price_per_1m: 1,
    output_price_per_1m: 2,
    promo_ends_at: '2026-12-31T00:00:00.000Z',
    regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 8,
  });
  assert.equal(active.publishable[0].promo_active, true);
  assert.equal(active.publishable[0].input_price, 1);
  assert.equal(active.publishable[0].regular_input_price, 4);
  assert.match(active.publishable[0].billing_conditions, /promo=until:2026-12-31T00:00:00.000Z/);

  const expired = quotes({
    input_price_per_1m: 1,
    output_price_per_1m: 2,
    promo_ends_at: '2026-10-01T00:00:00.000Z',
    regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 8,
    regular_cached_input_price_per_1m: 0.5,
  });
  assert.equal(expired.publishable[0].promo_active, false);
  assert.equal(expired.publishable[0].input_price, 4);
  assert.equal(expired.publishable[0].output_price, 8);
  assert.equal(expired.publishable[0].cached_input_price, 0.5);
  assert.equal(expired.publishable[0].promo_ends_at, null);
  assert.match(expired.publishable[0].billing_conditions, /promo=none/);

  const expiredCacheMissing = quotes({
    input_price_per_1m: 1,
    output_price_per_1m: 2,
    cached_input_price_per_1m: 0.1,
    promo_ends_at: '2026-10-01T00:00:00.000Z',
    regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 8,
  });
  assert.equal(expiredCacheMissing.publishable[0].input_price, 4);
  assert.equal(expiredCacheMissing.publishable[0].cached_input_missing, true);
});

test('rejects incomparable or non-public rows and blocks fixture hosts on the live path', () => {
  const live = prepareQuotes([
    row({ provider_type: 'aggregator' }),
    row({ provider_type: 'cloud', model_slug: 'example-cloud' }),
    row({ provider_type: 'producer', model_slug: 'example-producer', provider_slug: 'example-producer', provider_name: 'Example Producer' }),
    row({ model_slug: 'example-stale', last_verified: '2026-01-01T00:00:00.000Z' }),
    row({ model_slug: 'example-boundary', last_verified: '2026-10-02T00:00:00.000Z' }),
    row({ model_slug: 'example-older', last_verified: '2026-10-01T23:59:59.999Z' }),
    row({ model_slug: 'example-missing', source_url: undefined, pricing_url: undefined, website: undefined, invite_url: 'https://pricing.example.com/invite' }),
    row({ model_slug: 'example-http', source_url: 'http://pricing.example.com/list' }),
    row({ model_slug: 'example-auth', source_url: 'https://user:pass@pricing.example.com/list' }),
    row({ model_slug: 'example-fixture-host', source_url: 'https://example.test/pricing' }),
    row({ model_slug: 'example-synthetic', sample: 'synthetic_fixture', source_url: 'https://pricing.example.com/synthetic' }),
    row({ model_slug: 'example-zero', input_price_per_1m: 0, output_price_per_1m: 0 }),
    row({ model_slug: 'example-blank', input_price_per_1m: null, output_price_per_1m: null }),
    row({ model_slug: 'example-negative', input_price_per_1m: -1 }),
    row({ model_slug: 'example-unit', price_unit: 'per_token_mystery' }),
    row({ model_slug: 'example-restricted', data_for_discount: true }),
    row({ model_slug: 'example-off', is_available: false }),
    row({ model_slug: 'example-promo', regular_input_price_per_1m: 9, promo_ends_at: '2026-10-01T00:00:00.000Z' }),
    row({ model_slug: 'example-ambiguous', regular_input_price_per_1m: 9 }),
  ], { asOf: AS_OF, allowFixture: false });

  const slugs = live.publishable.map((quote) => quote.model_slug);
  assert.deepEqual(slugs, ['example-boundary', 'example-producer', 'example-zero']);
  assert.equal(live.publishable.find((quote) => quote.model_slug === 'example-zero')?.zero_price, true);
  assert.equal(live.publishable.find((quote) => quote.model_slug === 'example-producer')?.channel_role, 'producer');
  assert.equal(live.excluded_counts.non_official_channel, 2);
  assert.equal(live.excluded_counts.stale, 2);
  assert.equal(live.excluded_counts.missing_source, 1);
  assert.equal(live.excluded_counts.invalid_source, 2);
  assert.equal(live.excluded_counts.fixture_source_blocked, 1);
  assert.equal(live.excluded_counts.synthetic_blocked, 1);
  assert.equal(live.excluded_counts.missing_price, 1);
  assert.equal(live.excluded_counts.negative_or_invalid_price, 1);
  assert.equal(live.excluded_counts.invalid_unit, 1);
  assert.equal(live.excluded_counts.restricted_or_nonpublic, 1);
  assert.equal(live.excluded_counts.unavailable, 1);
  assert.equal(live.excluded_counts.expired_promo_without_regular, 1);
  assert.equal(live.excluded_counts.ambiguous_promo, 1);
  assert.equal(live.observations.some((item) => item.model_slug === 'example-stale' && item.withhold === 'stale'), true);
  assert.ok(COVERAGE_WORDING.zh.includes('收录且经核验'));
  assert.equal(COVERAGE_WORDING.en.toLowerCase().includes('lowest price on the web'), false);
});

test('drops conflicting duplicates and keeps identical ones once', () => {
  const conflict = prepareQuotes([
    row(),
    row({ input_price_per_1m: 9 }),
  ], { asOf: AS_OF });
  assert.equal(conflict.publishable.length, 0);
  assert.equal(conflict.excluded_counts.ambiguous_duplicate, 1);

  const identical = prepareQuotes([row(), row()], { asOf: AS_OF });
  assert.equal(identical.publishable.length, 1);
  assert.equal(identical.duplicates_collapsed, 1);
});

test('request plan serves only the current json or csv sample', () => {
  assert.deepEqual(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices')), { kind: 'ok', format: 'json' });
  assert.deepEqual(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?format=csv')), { kind: 'ok', format: 'csv' });
  assert.equal(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?format=xml')).kind, 'bad_format');
  assert.equal(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?snapshot=old')).kind, 'history_missing');
  assert.equal(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?history=1')).kind, 'history_missing');
  assert.equal(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?date=2020-01-01')).kind, 'history_missing');
  assert.equal(citableRequestPlan(new URL('https://aiplans.dev/api/citable-prices?limit=10')).kind, 'bad_query');
});

test('the price index page keeps its canonical path and does not publish a fixed catalog size', () => {
  const page = readFileSync(new URL('../app/[locale]/reports/api-price-index/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /buildMetadata\(\{ locale, path: '\/reports\/api-price-index'/);
  assert.equal(page.includes('noindex'), false);
  assert.equal(page.includes('497'), false);
  assert.equal(page.includes('711'), false);
  assert.equal(page.includes('全网最低'), false);
  assert.match(page, /CitablePriceDownload/);
  assert.match(page, /价格历史日志/);
});
