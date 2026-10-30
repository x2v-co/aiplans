import assert from 'node:assert/strict';
import test from 'node:test';
import { priceSnapshotExpiresAt } from '../../src/lib/effective-price';
import { parsePlanpriceV1TtlHours } from './planprice-v1-ttl';

test('v1 TTL defaults to 30 hours when unset', () => {
  assert.equal(parsePlanpriceV1TtlHours(undefined), 30);
});

test('v1 TTL accepts positive finite hours, including fractions', () => {
  for (const [value, expected] of [['6', 6], ['48', 48], ['0.5', 0.5], [' 30 ', 30]] as const) {
    assert.equal(parsePlanpriceV1TtlHours(value), expected);
  }
});

test('v1 TTL rejects empty, nonnumeric, nonpositive, and nonfinite values with a clear error', () => {
  for (const value of ['', '   ', 'abc', '30h', '0', '-1', 'NaN', 'Infinity', '-Infinity', '1e309']) {
    assert.throws(() => parsePlanpriceV1TtlHours(value), {
      message: `PLANPRICE_V1_TTL_HOURS must be a positive finite number; received ${JSON.stringify(value)}`,
    });
  }
});

test('v1 TTL spans daily publication while scheduled price changes can still shorten expiry', () => {
  const now = new Date('2026-10-30T19:15:00Z');
  const nominalExpiry = new Date(now.getTime() + parsePlanpriceV1TtlHours(undefined) * 3_600_000);
  assert.equal(priceSnapshotExpiresAt([], nominalExpiry, now), '2026-11-01T01:15:00.000Z');

  const scheduled = { promo_ends_at: '2026-10-31T08:00:00Z' };
  assert.equal(priceSnapshotExpiresAt([scheduled], nominalExpiry, now), '2026-10-31T08:00:00.000Z');
  assert.equal(priceSnapshotExpiresAt([{ promo_ends_at: '2026-11-02T00:00:00Z' }], nominalExpiry, now), nominalExpiry.toISOString());
  assert.equal(priceSnapshotExpiresAt([scheduled], nominalExpiry, new Date(scheduled.promo_ends_at)), nominalExpiry.toISOString());
});
