import assert from 'node:assert/strict';
import test from 'node:test';
import { getExchangeRateSync } from '../exchange-rates';
import { PAYG_MIXES, payAsYouGoEstimate, type PaygChannelPrice } from './pay-as-you-go';

const asOf = new Date('2026-10-15T12:00:00Z');
const channel: PaygChannelPrice = {
  id: 42, provider_slug: 'test-cloud', model_slug: 'test-model',
  input_price_per_1m: 2, cached_input_price_per_1m: 0.2, output_price_per_1m: 8,
  currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
  last_verified: '2026-10-14T10:00:00Z', pricing_url: 'https://example.test/pricing', notes: 'Official list',
};

function estimate(overrides: Partial<PaygChannelPrice> = {}, mix = PAYG_MIXES[0], usdPerCurrencyUnit?: number) {
  const result = payAsYouGoEstimate({ ...channel, ...overrides }, mix, { asOf, usdPerCurrencyUnit });
  if (result.status !== 'ready') assert.fail(result.reason);
  return result;
}

function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`); }

test('official list prices × both requested mixes produce USD/MTok and an explicit reference basket', () => {
  const coding = estimate();
  close(coding.blendedPriceUsdPerMTok, 0.284);
  close(estimate({}, PAYG_MIXES[1]).blendedPriceUsdPerMTok, 3.5);
  assert.deepEqual({ ...coding.record, notes: undefined }, {
    plan_id: null, plan_slug: 'payg:test-cloud', served_model: 'test-model', window: 'monthly',
    est_tokens_low: '1000000', est_tokens_high: '1000000', usage_mix_id: 'coding-high-cache',
    confidence: 'high', verified_at: '2026-10-14T10:00:00.000Z', notes: undefined,
  });
  const notes = JSON.parse(coding.record.notes);
  assert.equal(notes.kind, 'payg-list-price');
  assert.equal(notes.blended_price_usd_per_mtok, coding.blendedPriceUsdPerMTok);
  assert.deepEqual(notes.usage_mix, { id: 'coding-high-cache', cache_read_pct: 97, input_pct: 2.5, output_pct: 0.5 });
  assert.match(notes.formula, /\/ 100$/);
  assert.match(notes.substitution, /USD\/MTok/);
  assert.equal(notes.original_currency, 'USD');
  assert.equal(notes.source.verified_at, coding.record.verified_at);
  assert.equal(notes.source.api_channel_price_id, 42);
  assert.equal(notes.source.url, channel.pricing_url);
  assert.match(notes.scope, /not an allowance or cap/);
  assert.match(notes.cache_write_handling, /not separately modeled/);
});

test('missing cache rate uses ordinary inputs for the whole cached share; explicit zero stays zero', () => {
  const missing = estimate({ cached_input_price_per_1m: null });
  close(missing.blendedPriceUsdPerMTok, 2.03);
  assert.match(JSON.parse(missing.record.notes).cache_handling, /missing: use ordinary input/);
  close(estimate({ cached_input_price_per_1m: 0 }).blendedPriceUsdPerMTok, 0.09);
  close(estimate({ input_price_per_1m: 0, cached_input_price_per_1m: null, output_price_per_1m: 0 }).blendedPriceUsdPerMTok, 0);
});

test('CNY uses the supplied existing FX snapshot and records the exact rate and units', () => {
  const rate = getExchangeRateSync('CNY', 'USD');
  const result = estimate({ currency: 'CNY', input_price_per_1m: 6.9, cached_input_price_per_1m: 0.69, output_price_per_1m: 27.6 }, PAYG_MIXES[0], rate);
  close(result.blendedPriceUsdPerMTok, 0.142);
  const notes = JSON.parse(result.record.notes);
  assert.equal(notes.original_currency, 'CNY');
  assert.equal(notes.conversion.usd_per_currency_unit, rate);
  assert.match(notes.conversion.method, /getExchangeRateSync\('CNY', 'USD'\)/);
  const perK = estimate({ price_unit: 'per_1k_tokens', input_price_per_1m: 0.002,
    cached_input_price_per_1m: 0.0002, output_price_per_1m: 0.008 });
  close(perK.blendedPriceUsdPerMTok, estimate().blendedPriceUsdPerMTok);
  assert.equal(JSON.parse(perK.record.notes).conversion.unit_factor, 1000);
});

test('ineligible or unverified rows are skipped instead of receiving high confidence', () => {
  for (const overrides of [
    { is_available: false }, { provider_slug: '' }, { model_slug: '' },
    { price_unit: 'per_request' }, { price_unit: null }, { currency: null }, { currency: 'UNKNOWN' },
    { currency: 'CNY' }, { last_verified: null }, { last_verified: 'bad-date' },
    { last_verified: '2026-10-16' }, { input_price_per_1m: null }, { output_price_per_1m: null },
    { input_price_per_1m: -1 }, { cached_input_price_per_1m: -1 }, { output_price_per_1m: Infinity },
    { cached_input_price_per_1m: NaN }, { promo_ends_at: 'bad-date' },
  ] satisfies Partial<PaygChannelPrice>[]) {
    assert.equal(payAsYouGoEstimate({ ...channel, ...overrides }, PAYG_MIXES[0], { asOf }).status, 'skipped', JSON.stringify(overrides));
  }
  const variable = payAsYouGoEstimate({
    ...channel, input_price_per_1m: null, output_price_per_1m: null, last_verified: null,
  }, PAYG_MIXES[0], { asOf });
  assert.equal(variable.status, 'skipped');
  if (variable.status === 'skipped') assert.match(variable.reason, /variable\/router/);
  for (const fx of [0, -1, Infinity, NaN]) {
    assert.equal(payAsYouGoEstimate({ ...channel, currency: 'CNY' }, PAYG_MIXES[0], { asOf, usdPerCurrencyUnit: fx }).status, 'skipped');
  }
});

test('promotion expiry resolves regular prices, with regular input fallback for missing regular cache price', () => {
  const scheduled = { promo_ends_at: asOf, regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 16, regular_cached_input_price_per_1m: 0.4 };
  close(estimate(scheduled).blendedPriceUsdPerMTok, 0.568);
  close(estimate({ ...scheduled, promo_ends_at: '2026-10-16' }).blendedPriceUsdPerMTok, 0.284);
  const missingCache = estimate({ ...scheduled, regular_cached_input_price_per_1m: null });
  close(missingCache.blendedPriceUsdPerMTok, 4.06);
  assert.match(JSON.parse(missingCache.record.notes).cache_handling, /missing: use ordinary input/);
  for (const invalid of [{ regular_output_price_per_1m: null }, { regular_input_price_per_1m: NaN }, { regular_cached_input_price_per_1m: Infinity }]) {
    assert.equal(payAsYouGoEstimate({ ...channel, ...scheduled, ...invalid }, PAYG_MIXES[0], { asOf }).status, 'skipped');
  }
});

test('pure calculation validates mixes, preserves inputs and is stable across days without a price change', () => {
  const frozen = Object.freeze({ ...channel });
  const mix = Object.freeze({ ...PAYG_MIXES[0] });
  const first = payAsYouGoEstimate(frozen, mix, { asOf });
  assert.deepEqual(first, payAsYouGoEstimate(frozen, mix, { asOf: new Date('2026-10-20') }));
  assert.throws(() => estimate({}, { ...mix, outputPct: 1 }), /sum to 100/);
  assert.throws(() => estimate({}, { ...mix, outputPct: -1 }), /nonnegative/);
  assert.throws(() => payAsYouGoEstimate(channel, mix, { asOf: new Date(NaN) }), /date/);
});
