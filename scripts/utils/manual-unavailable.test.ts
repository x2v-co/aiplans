import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIABLE_ROUTER_SENTINEL, retainManualUnavailable } from './manual-unavailable';

const locked = { is_available: false, notes: `${VARIABLE_ROUTER_SENTINEL}; OpenRouter -1 sentinel is not a price. Source: https://openrouter.ai/nvidia/switchyard` };

test('无数字价格的写入不能把审计下架的路由行改回可用', () => {
  const out = retainManualUnavailable({ is_available: true, input_price_per_1m: null, output_price_per_1m: null }, locked);
  assert.equal(out.is_available, false);
});

test('上游给出真实固定价后允许恢复可用', () => {
  const out = retainManualUnavailable({ is_available: true, input_price_per_1m: 0.5, output_price_per_1m: 1 }, locked);
  assert.equal(out.is_available, true);
});

test('普通行不受影响', () => {
  const out = retainManualUnavailable({ is_available: true, input_price_per_1m: null, output_price_per_1m: null }, { is_available: false, notes: 'retired: absent' });
  assert.equal(out.is_available, true);
  assert.equal(retainManualUnavailable({ is_available: true, input_price_per_1m: null, output_price_per_1m: null }, null).is_available, true);
});

import { keepUnavailableForSeed as keepSeed } from './manual-unavailable';

test('seed does not resurrect scrape-retired rows (3405/59, 2646/59 in 10-16 dry-run)', () => {
  const existing = { is_available: false, notes: 'Old Mistral Large: $2/$6 | retired 2026-10-15T13:16:01.582Z: absent from successful full-catalog OpenRouter scrape' };
  const out = keepSeed({ is_available: true, input_price_per_1m: 2, output_price_per_1m: 6, notes: 'Old Mistral Large: $2/$6' }, existing);
  assert.equal(out.is_available, false);
  assert.equal(out.notes, existing.notes);
});

test('seed keeps -1 sentinel rows unavailable and leaves priced live rows alone', () => {
  const sentinel = { is_available: false, notes: '[needs-verification] Variable/router pricing; OpenRouter -1 sentinel is not a price.' };
  assert.equal(keepSeed({ is_available: true, input_price_per_1m: null, output_price_per_1m: null, notes: 'x' }, sentinel).is_available, false);
  assert.equal(keepSeed({ is_available: true, input_price_per_1m: 1, output_price_per_1m: 2, notes: 'x' }, { is_available: true, notes: '' }).is_available, true);
  assert.equal(keepSeed({ is_available: true, input_price_per_1m: 1, output_price_per_1m: 2, notes: 'x' }, null).is_available, true);
});
