import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeepSeekTable, pickDeepSeekPricingTable } from './deepseek-dynamic';

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
    ['deepseek-v4.1-flash', 0.3, 1.2, 0.006], ['deepseek-v4-pro', 1.32, 3.96, 0.044],
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

// Live layout on 2026-10-15: rowspan labels prefix OFF-PEAK rows, OFF-PEAK listed first.
const liveRows = [
  ['MODEL', 'deepseek-flash (1)', 'deepseek-v4-pro'],
  ['MODEL VERSION', 'DeepSeek-V4.1-Flash', 'DeepSeek-V4-Pro-0813'],
  ['PRICING (2)', '1M INPUT TOKENS (CACHE HIT)', 'OFF-PEAK', '$0.003', '$0.022'],
  ['PEAK', '$0.006', '$0.044'],
  ['1M INPUT TOKENS (CACHE MISS)', 'OFF-PEAK', '$0.15', '$0.66'],
  ['PEAK', '$0.3', '$1.32'],
  ['1M OUTPUT TOKENS', 'OFF-PEAK', '$0.6', '$1.98'],
  ['PEAK', '$1.2', '$3.96'],
  ['Concurrency Limit (3)', '2500', '500'],
];
test('rowspan layout with OFF-PEAK first parses both windows', () => {
  const result = parseDeepSeekTable(liveRows, new Date('2026-10-15T09:21Z'));
  assert.equal(result.errors, undefined);
  assert.equal(result.success, true);
  assert.deepEqual(result.variants!.map(v => [v.modelSlug, v.variantKey, v.inputPricePer1M, v.outputPricePer1M, v.cachedInputPricePer1M]), [
    ['deepseek-v4.1-flash', 'peak', 0.3, 1.2, 0.006], ['deepseek-v4.1-flash', 'off-peak', 0.15, 0.6, 0.003],
    ['deepseek-v4-pro', 'peak', 1.32, 3.96, 0.044], ['deepseek-v4-pro', 'off-peak', 0.66, 1.98, 0.022],
  ]);
});

// Docusaurus SSR shell renders a PARAM/VALUE table before the pricing table hydrates.
const ssrShellRows = [
  ['PARAM', 'VALUE'],
  ['base_url *', 'https://api.deepseek.com'],
  ['api_key', 'apply for an API key'],
];
test('multiple tables: picks the MODEL+PEAK pricing table, not the first one', () => {
  const picked = pickDeepSeekPricingTable([ssrShellRows, liveRows, [['MODEL', 'x'], ['Concurrency', '1']]]);
  assert.equal(picked, liveRows);
  const result = parseDeepSeekTable(picked, new Date('2026-10-15T09:21Z'));
  assert.equal(result.success, true);
  assert.deepEqual(result.prices.map(p => p.modelSlug), ['deepseek-v4.1-flash', 'deepseek-v4-pro']);
});
test('SSR shell PARAM/VALUE table alone is never used as pricing', () => {
  assert.deepEqual(pickDeepSeekPricingTable([ssrShellRows]), []);
  assert.deepEqual(pickDeepSeekPricingTable([]), []);
  const result = parseDeepSeekTable(pickDeepSeekPricingTable([ssrShellRows]));
  assert.equal(result.success, false);
  assert.deepEqual(result.errors, ['No DeepSeek peak prices found']);
});
