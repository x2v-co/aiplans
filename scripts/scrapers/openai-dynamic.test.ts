import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpenAIPricingTables } from './openai-dynamic';

const header = ['Model', 'Input', 'Cached input', 'Output'];

test('OpenAI pricing parser emits prices but never invents a context window', () => {
  const prices = parseOpenAIPricingTables([
    [header, ['gpt-6-sol', '$5.00', '$0.50', '$40.00'], ['gpt-5', '$1.25', '$0.125', '$10.00'], ['gpt-5', '$9', '$9', '$9']],
    [['Model', 'Training', 'Input'], ['gpt-4.1', '$25', '$3']],
  ]);
  assert.deepEqual(prices.map(price => [price.modelName, price.inputPricePer1M, price.cachedInputPricePer1M, price.outputPricePer1M]), [
    ['gpt-6-sol', 5, 0.5, 40], ['gpt-5', 1.25, 0.125, 10]]);
  for (const price of prices) assert.equal(price.contextWindow, undefined, price.modelName);
});
