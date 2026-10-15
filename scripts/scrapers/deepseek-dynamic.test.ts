import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeepSeekTable } from './deepseek-dynamic';

// Pricing values come exclusively from the DeepSeek section of the supplied facts.
const rows = [
  ['MODEL', 'deepseek-flash(1)', 'deepseek-v4-pro(2)'],
  ['PEAK', '$0.006', '$0.044'], ['OFF-PEAK', '$0.003', '$0.022'],
  ['PEAK', '$0.30', '$1.32'], ['OFF-PEAK', '$0.15', '$0.66'],
  ['PEAK', '$1.20', '$3.96'], ['OFF-PEAK', '$0.60', '$1.98'],
];
test('semantic DeepSeek table keeps peak list plus cache hit/miss/output for both windows', () => {
  const result = parseDeepSeekTable(rows, new Date('2026-10-17T02:00Z'));
  assert.equal(result.success, true);
  assert.deepEqual(result.prices.map(p => [p.modelSlug, p.inputPricePer1M, p.outputPricePer1M, p.cachedInputPricePer1M]), [
    ['deepseek-v4-flash', 0.3, 1.2, 0.006], ['deepseek-v4-pro', 1.32, 3.96, 0.044],
  ]);
  assert.deepEqual(result.variants!.map(v => [v.variantKey, v.isHeadline, v.inputPricePer1M, v.outputPricePer1M, v.cachedInputPricePer1M]), [
    ['peak', true, 0.3, 1.2, 0.006], ['off-peak', false, 0.15, 0.6, 0.003],
    ['peak', true, 1.32, 3.96, 0.044], ['off-peak', false, 0.66, 1.98, 0.022],
  ]);
  assert.ok(result.variants!.every(v => v.raw?.scheduled_window === 'off-peak'));
});
test('incomplete pricing tables fail rather than filling unknown prices with zero', () => {
  assert.equal(parseDeepSeekTable(rows.slice(0, -1)).success, false);
  const result = parseDeepSeekTable([['MODEL', 'deepseek-flash']]);
  assert.equal(result.success, false);
  assert.deepEqual(result.prices, []);
});
