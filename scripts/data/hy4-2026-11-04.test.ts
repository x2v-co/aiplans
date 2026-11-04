import assert from 'node:assert/strict';
import test from 'node:test';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { HY4_CHANNEL_NOTES, HY4_CURRENT, HY4_LIST, HY4_OPENROUTER_ID, HY4_SLUG, hy4ModelRow, hy4SeedOptions } from './hy4-2026-11-04';

test('Hy4 uses the OpenRouter-generated slug so the nightly scrape attaches to it', () => {
  assert.equal(generateOpenRouterSlug(HY4_OPENROUTER_ID), HY4_SLUG);
});

test('Hy4 discount follows the no-end-date convention: current price in the row, list price in notes', () => {
  assert.deepEqual(HY4_CURRENT, { input: 0.417, output: 1.251, cache: 0.021 });
  assert.deepEqual(HY4_LIST, { input: 0.834, output: 2.501, cache: 0.042 });
  assert.match(HY4_CHANNEL_NOTES, /50% off/);
  assert.match(HY4_CHANNEL_NOTES, /No end date published/);
  assert.match(HY4_CHANNEL_NOTES, /only Hy4 Preview/);
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
