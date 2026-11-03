import assert from 'node:assert/strict';
import test from 'node:test';
import { argonChannelRow, argonModelRow, seedChanges, seedValuesEqual } from './gemini-4-argon';

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

test('numeric columns read back as strings (int8/numeric) compare equal to the seeded number', () => {
  // meituan-longcat-2-5 after the 11-03 apply: max_output_tokens came back as "262144".
  assert.deepEqual(seedChanges({ max_output_tokens: '262144', context_window: '1048576' },
    { max_output_tokens: 262_144, context_window: 1_048_576 }), {});
  assert.deepEqual(seedChanges({ input_price_per_1m: '2.000000', cached_input_price_per_1m: '0.04', id_big: 7n },
    { input_price_per_1m: 2, cached_input_price_per_1m: 0.04, id_big: 7 }), {});
  assert.deepEqual(seedChanges({ provider_ids: ['40', '41'], raw_json: { limit: '256' } },
    { provider_ids: [40, 41], raw_json: { limit: 256 } }), {});
  // Real differences are still reported, with the original database value.
  assert.deepEqual(seedChanges({ max_output_tokens: '131072' }, { max_output_tokens: 262_144 }), {
    max_output_tokens: { from: '131072', to: 262_144 },
  });
  // Only numeric text is coerced, and only when the seed wants a number.
  for (const [db, want] of [['', 0], ['abc', 1], [' ', 0], ['1e', 1], [null, 0]] as const) assert.equal(seedValuesEqual(db, want), false);
  assert.equal(seedValuesEqual(262_144, '262144'), false, 'a seeded string stays a string');
  assert.equal(seedValuesEqual('1.5e3', 1500), true);
  assert.equal(seedValuesEqual(['1', 'x'], [1, 'x']), true);
  assert.equal(seedValuesEqual(['1'], [1, 2]), false);
});
