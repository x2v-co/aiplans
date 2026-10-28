import assert from 'node:assert/strict';
import test from 'node:test';
import { providerSubscriptionComparisons, subscriptionSearchCopy } from './subscription-search';
import { buildComparisonPricingCopy } from './pricing-seo';

test('DeepSeek brand intent leads to the requested model while prices remain data driven', () => {
  const slug = 'deepseek-v4.1-flash';
  const name = 'DeepSeek V4.1 Flash (1017)';
  const copy = subscriptionSearchCopy(slug, name, 'zh');
  assert.match(copy.heading, /^DeepSeek 订阅套餐对比：DeepSeek V4.1 Flash/);
  assert.match(copy.linkLabel, /^DeepSeek 订阅套餐与价格对比/);
  assert.match(copy.answer, /不等于.*官方会员/);
  const metadata = buildComparisonPricingCopy(name, [{ id: 1, name: 'Go', price: 10,
    price_unit: 'per_month', currency: 'USD', pricing_model: 'subscription', is_contact_sales: false }], 'zh', 2026, slug);
  assert.match(metadata.title, /^DeepSeek 订阅套餐对比/);
  assert.match(metadata.title, /月付 \$10 起/);
  assert.match(subscriptionSearchCopy('kimi-k2', 'Kimi K2', 'en').heading, /^Kimi K2 Subscription Plans$/);
  assert.doesNotMatch(subscriptionSearchCopy('deepseek-r1', 'DeepSeek R1', 'zh').heading, /V4.1/);
});

test('provider links prioritize DeepSeek only while eligible and omit empty, variant and superseded comparisons', () => {
  const candidates = [
    { slug: 'deepseek-v4.1-flash', name: 'DeepSeek', plan_count: 2 },
    { slug: 'claude-opus-4.5', name: 'Old', plan_count: 8, released_at: '2025-11-01' },
    { slug: 'claude-opus-4.8', name: 'New', plan_count: 8, released_at: '2026-08-01' },
    { slug: 'claude-opus-4.8-(batch)', name: 'Batch', plan_count: 8 },
    { slug: 'api-only', name: 'API', plan_count: 0 },
  ];
  assert.deepEqual(providerSubscriptionComparisons(candidates).map(row => row.slug),
    ['deepseek-v4.1-flash', 'claude-opus-4.8']);
  assert.equal(providerSubscriptionComparisons([{ ...candidates[0], plan_count: 1 }]).length, 0);
  assert.equal(providerSubscriptionComparisons([]).length, 0);
});

 test('provider subsets cannot promote globally superseded comparison pages', () => {
  const candidates = [
    { slug: 'claude-opus-4.5', name: 'Old', plan_count: 8, released_at: '2025-11-01' },
    { slug: 'claude-opus-4.8', name: 'New', plan_count: 8, released_at: '2026-08-01' },
  ];
  assert.deepEqual(providerSubscriptionComparisons(candidates, new Set(['claude-opus-4.5'])), []);
});

test('subscription snippets exclude pay-as-you-go and packs from counts', () => {
  const common = { name: 'Plan', price: 10, price_unit: 'per_month', currency: 'USD', is_contact_sales: false };
  const plans = [{ ...common, id: 1, pricing_model: 'subscription' },
    { ...common, id: 2, pricing_model: 'pay_as_you_go' },
    { ...common, id: 3, pricing_model: 'token_pack' }];
  assert.match(buildComparisonPricingCopy('Kimi K2', plans, 'zh', 2026).title, /1 个套餐/);
  assert.match(buildComparisonPricingCopy('Kimi K2', plans, 'en', 2026).title, /1 Plan,/);
});


test('provider discovery leads with its own models before cross-provider entitlements', () => {
  const results = providerSubscriptionComparisons([
    { slug: 'minimax-m2.5', name: 'MiniMax', plan_count: 20, isPrimaryProvider: false },
    { slug: 'qwen3-coder-plus', name: 'Qwen', plan_count: 3, isPrimaryProvider: true },
  ]);
  assert.equal(results[0].slug, 'qwen3-coder-plus');
});
