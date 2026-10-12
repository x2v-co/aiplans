import assert from 'node:assert/strict';
import test from 'node:test';
import { findSubscriptionContext } from './subscription-context';

test('matches GPT-6.1 Sol on ChatGPT plans', () => {
  const f = findSubscriptionContext(['gpt-6.1-sol'], 'chatgpt');
  assert.equal(f?.contextWindow, 500_000);
  assert.equal(f?.longContextPricing, 'included_in_subscription');
});

test('ignores other lines and models', () => {
  assert.equal(findSubscriptionContext(['gpt-6.1-sol'], 'claude'), null);
  assert.equal(findSubscriptionContext(['gpt-6.1'], 'chatgpt'), null);
  assert.equal(findSubscriptionContext(['gpt-6.1-sol'], null), null);
});
