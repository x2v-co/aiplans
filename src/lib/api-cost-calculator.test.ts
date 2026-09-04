import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateApiCost, pricePerMillion } from './api-cost-calculator';

test('converts daily traffic to a 30-day monthly estimate', () => {
  const result = estimateApiCost({
    period: 'day', requests: 100, inputTokensPerRequest: 1000,
    outputTokensPerRequest: 500, cacheHitRate: 0, batchRate: 0,
  }, {
    id: 1, input_price_per_1m: 2, output_price_per_1m: 8,
    currency: 'USD', price_unit: 'per_1m_tokens',
  });

  assert.equal(result.monthlyRequests, 3000);
  assert.equal(result.monthlyInputTokens, 3_000_000);
  assert.equal(result.monthlyOutputTokens, 1_500_000);
  assert.equal(result.monthlyCost, 18);
});

test('uses cached-input price and applies batch discount to eligible traffic', () => {
  const result = estimateApiCost({
    period: 'month', requests: 1000, inputTokensPerRequest: 1000,
    outputTokensPerRequest: 1000, cacheHitRate: 0.5, batchRate: 0.4,
  }, {
    id: 1, input_price_per_1m: 4, output_price_per_1m: 10,
    cached_input_price_per_1m: 1, currency: 'USD', price_unit: 'per_1m_tokens',
  });

  assert.equal(result.uncachedInputCost, 2);
  assert.equal(result.cachedInputCost, 0.5);
  assert.equal(result.outputCost, 10);
  assert.equal(result.batchSavings, 2.5);
  assert.equal(result.monthlyCost, 10);
});

test('falls back to normal input price when a channel has no cache price', () => {
  const result = estimateApiCost({
    period: 'month', requests: 1, inputTokensPerRequest: 1_000_000,
    outputTokensPerRequest: 0, cacheHitRate: 1, batchRate: 0,
  }, {
    id: 1, input_price_per_1m: 3, output_price_per_1m: 9,
    currency: 'USD', price_unit: 'per_1m_tokens',
  });
  assert.equal(result.monthlyCost, 3);
});

test('normalises legacy per-1K token rows', () => {
  assert.equal(pricePerMillion(0.002, 'per_1k_tokens'), 2);
});
