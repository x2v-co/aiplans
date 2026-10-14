import assert from 'node:assert/strict';
import test from 'node:test';
import { effectivePrice, introductoryEndDate, isIntroductoryPriceActive, priceSnapshotExpiresAt } from './effective-price';
import { getCheapestChannel } from './channel-price-utils';
import type { ChannelPrice, GroupedProduct } from './grouped-products';

const row = {
  id: 42, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.1,
  promo_ends_at: '2026-12-01T08:00:00Z', regular_input_price_per_1m: 4,
  regular_output_price_per_1m: 20, regular_cached_input_price_per_1m: 0.2,
};
const before = new Date('2026-12-01T07:59:59.999Z');
const cutoff = new Date(row.promo_ends_at);

test('read-time price switches all three rates at the first instant after promotion without mutation', () => {
  assert.equal(effectivePrice(row, before), row);
  const result = effectivePrice(row, cutoff);
  assert.deepEqual([result.input_price_per_1m, result.output_price_per_1m, result.cached_input_price_per_1m], [4, 20, 0.2]);
  assert.equal(row.input_price_per_1m, 2);
  assert.equal(result.id, 42);
  assert.deepEqual(effectivePrice(row, new Date('2027-02-01')), result);
  assert.equal(isIntroductoryPriceActive(row, before), true);
  assert.equal(isIntroductoryPriceActive(row, cutoff), false);
});

test('plain prices, invalid dates, absent regular fields, and zero prices are handled independently', () => {
  assert.equal(effectivePrice({ ...row, promo_ends_at: null }, cutoff).input_price_per_1m, 2);
  assert.equal(effectivePrice({ ...row, promo_ends_at: 'invalid' }, cutoff).input_price_per_1m, 2);
  const partial = effectivePrice({ ...row, regular_input_price_per_1m: 0,
    regular_output_price_per_1m: null, regular_cached_input_price_per_1m: undefined }, cutoff);
  assert.deepEqual([partial.input_price_per_1m, partial.output_price_per_1m, partial.cached_input_price_per_1m], [0, 10, 0.1]);
});

test('inclusive notice date uses the data boundary and Pacific calendar in both locales', () => {
  assert.equal(introductoryEndDate(row.promo_ends_at, 'en'), 'Nov 30, 2026');
  assert.equal(introductoryEndDate(row.promo_ends_at, 'zh'), '2026-11-30');
  assert.equal(introductoryEndDate('2027-01-01T08:00:00Z', 'en'), 'Dec 31, 2026');
});

test('list/compare cheapest-channel selection changes after expiry even when stored price has not changed', () => {
  const channels = [
    { ...row, currency: 'USD', providers: { slug: 'google', type: 'producer' } },
    { id: 43, input_price_per_1m: 3, output_price_per_1m: 15, currency: 'USD', providers: { slug: 'other', type: 'aggregator' } },
  ];
  const pricesAt = (now: Date) => channels.map(cp => effectivePrice(cp, now)) as ChannelPrice[];
  assert.equal(getCheapestChannel({ versions: pricesAt(before) } as GroupedProduct)?.id, 42);
  assert.equal(getCheapestChannel({ versions: pricesAt(cutoff) } as GroupedProduct)?.id, 43);
});

test('immutable snapshot expires at a pending price change and resumes normal lifetime after switching', () => {
  const nominal = new Date('2026-12-01T12:00:00Z');
  assert.equal(priceSnapshotExpiresAt([row], nominal, before), cutoff.toISOString());
  assert.equal(priceSnapshotExpiresAt([row], nominal, cutoff), nominal.toISOString());
  assert.equal(priceSnapshotExpiresAt([row], new Date('2026-11-30T23:00:00Z'), before), '2026-11-30T23:00:00.000Z');
});
