import assert from 'node:assert/strict';
import test from 'node:test';
import { argonChannelRow, argonModelRow, seedChanges } from './gemini-4-argon';

test('seed fixes the producer and context and switches the Google price when rerun after expiry', () => {
  assert.deepEqual(argonModelRow(35).provider_ids, [35]);
  assert.equal(argonModelRow(35).name, 'Gemini 4 Argon');
  assert.equal(argonModelRow(35).context_window, 1_000_000);
  const promo = argonChannelRow(35, 100, new Date('2026-10-14'));
  const regular = argonChannelRow(35, 100, new Date('2026-12-01T08:00:00Z'));
  assert.deepEqual([promo.input_price_per_1m, promo.output_price_per_1m, promo.cached_input_price_per_1m], [2, 10, 0.1]);
  assert.deepEqual([regular.input_price_per_1m, regular.output_price_per_1m, regular.cached_input_price_per_1m], [4, 20, 0.2]);
  assert.equal(regular.promo_ends_at, '2026-12-01T08:00:00.000Z');
});

test('Cursor gets only verified current rates and no included entitlement or invented future price', () => {
  const row = argonChannelRow(50, 100, new Date('2026-12-02'), false);
  assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m], [2, 10, null]);
  assert.equal(row.promo_ends_at, null);
  assert.equal(row.regular_input_price_per_1m, null);
});

test('dry-run reports insert fields and exact corrections while equal rows need no update', () => {
  const row = argonModelRow(35);
  assert.equal(Object.keys(seedChanges(null, row)).length, Object.keys(row).length);
  assert.deepEqual(seedChanges(row, row), {});
  assert.deepEqual(seedChanges({ ...row, name: 'Old', context_window: 128_000 }, row), {
    name: { from: 'Old', to: 'Gemini 4 Argon' }, context_window: { from: 128_000, to: 1_000_000 },
  });
  assert.deepEqual(seedChanges({ last_verified: new Date('2026-10-13T00:00:00Z') },
    { last_verified: new Date('2026-10-13T00:00:00Z') }), {});
});
