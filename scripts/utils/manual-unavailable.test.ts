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
