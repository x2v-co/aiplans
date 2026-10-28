import assert from 'node:assert/strict';
import test from 'node:test';
import { providerSearchProfile } from './provider-search';
import { buildProviderPricingCopy, type SeoPlan } from './pricing-seo';

const plan = (pricing_model: string, price = 20): SeoPlan => ({ id: 1, name: 'Pro', pricing_model,
  price, price_unit: 'per_month', currency: 'USD', is_contact_sales: false });

test('search names connect creator brands and product names in both languages', () => {
  for (const locale of ['zh', 'en'] as const) {
    for (const [slug, expected] of [['anthropic', 'Claude'], ['moonshotai', 'Kimi'], ['z-ai', 'GLM'],
      ['google', 'Gemini'], ['qwen', 'Qwen'], ['grok', 'Grok'], ['openai', 'ChatGPT'], ['seed', 'Doubao']]) {
      assert.ok(providerSearchProfile(slug, 'Fallback', locale).name.includes(expected));
      assert.ok(providerSearchProfile(slug, 'Fallback', locale).guidance.length > 40);
    }
  }
});

test('API-only providers do not advertise subscription tiers or invent free allowances', () => {
  for (const locale of ['zh', 'en'] as const) {
    const copy = buildProviderPricingCopy('DeepSeek', [plan('pay_as_you_go', 0), plan('token_pack')], locale, 2026, 'deepseek');
    assert.match(copy.title, /API/);
    assert.doesNotMatch(copy.title, /Subscription|订阅|Pro|\$0/);
    assert.match(copy.description, locale === 'zh' ? /暂无已收录订阅套餐/ : /No subscription plans are listed/);
  }
  const mixed = buildProviderPricingCopy('Moonshot', [plan('subscription'), plan('pay_as_you_go', 0)], 'en', 2026, 'moonshot-china');
  assert.match(mixed.title, /Kimi/);
  assert.match(mixed.description, /1 listed subscription plan, from \$20/);
  assert.doesNotMatch(mixed.description, /from \$0/);
});

test('unknown providers get their actual name and neutral pricing guidance', () => {
  const profile = providerSearchProfile('new-provider', 'New Provider', 'en');
  assert.equal(profile.name, 'New Provider');
  assert.match(profile.guidance, /billing terms/);
  assert.doesNotMatch(profile.guidance, /unlimited|guaranteed|\$\d/);
});
