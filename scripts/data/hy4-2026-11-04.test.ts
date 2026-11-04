import assert from 'node:assert/strict';
import test from 'node:test';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { HY4_OFFICIAL_CURRENT, HY4_OFFICIAL_PROMO_ENDS_AT, hy4OfficialChannelRow, HY4_CHANNEL_NOTES, HY4_CURRENT, HY4_LIST, HY4_OPENROUTER_ID, HY4_SLUG, hy4ModelRow, hy4SeedOptions } from './hy4-2026-11-04';

test('Hy4 uses the OpenRouter-generated slug so the nightly scrape attaches to it', () => {
  assert.equal(generateOpenRouterSlug(HY4_OPENROUTER_ID), HY4_SLUG);
});

test('Hy4 discount follows the no-end-date convention: current price in the row, list price in notes', () => {
  assert.deepEqual(HY4_CURRENT, { input: 0.417, output: 1.251, cache: 0.021 });
  assert.deepEqual(HY4_LIST, { input: 0.834, output: 2.501, cache: 0.042 });
  assert.match(HY4_CHANNEL_NOTES, /50% off/);
  assert.match(HY4_CHANNEL_NOTES, /No end date published/);
  assert.match(HY4_CHANNEL_NOTES, /tencent channel/);
});

test('Hy4 model row keeps existing providers and states verified specs only', () => {
  const row = hy4ModelRow(7, [3, 7]);
  assert.deepEqual(row.provider_ids, [3, 7]);
  assert.equal(row.context_window, 1_048_576);
  assert.equal(row.max_output_tokens, 65_536);
  assert.deepEqual(row.input_modalities, ['text', 'image']);
  assert.ok(!('open_source' in row), 'license not published; not inferred');
  assert.throws(() => hy4SeedOptions(['--apply', '--dry-run']));
  assert.equal(hy4SeedOptions([]).apply, false);
});

test('official Tencent Cloud channel: list price in regular_*, 50% off until 2026-12-31 23:59:59 Beijing', () => {
  const row = hy4OfficialChannelRow(11, 7);
  assert.equal(row.provider_id, 7);
  assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m], [0.417, 1.2505, 0.021]);
  assert.deepEqual([row.regular_input_price_per_1m, row.regular_output_price_per_1m, row.regular_cached_input_price_per_1m], [0.834, 2.501, 0.042]);
  assert.equal(HY4_OFFICIAL_PROMO_ENDS_AT.toISOString(), '2026-12-31T15:59:59.000Z');
  for (const [k, v] of Object.entries(HY4_OFFICIAL_CURRENT)) assert.ok(Math.abs(v * 2 - HY4_LIST[k as keyof typeof HY4_LIST]) < 1e-9, k);
});
