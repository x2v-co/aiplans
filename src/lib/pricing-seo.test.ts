import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApiPricingSeo,
  buildComparisonPricingCopy,
  buildPlansIndexPricingCopy,
  buildProviderPricingCopy,
  databaseDate,
  monthlyPlanFloors,
  priceFloors,
  seoPrice,
  type SeoPlan,
} from './pricing-seo';
import { buildMetadata, faqPage } from './seo';
import { effectivePrice } from './effective-price';
import type { ChannelPrice, GroupedProduct } from './grouped-products';

const plan = (overrides: Partial<SeoPlan> = {}): SeoPlan => ({
  id: 1, name: 'ChatGPT Plus', pricing_model: 'subscription', price: 20,
  price_unit: 'per_month', currency: 'USD', is_contact_sales: false, ...overrides,
});

function product(channels: Partial<ChannelPrice>[]): GroupedProduct {
  return {
    id: 1, name: 'Test LLM', slug: 'test-llm', provider_ids: [1], context_window: 1000,
    benchmark_arena_elo: null, benchmarks: [], released_at: null, created_at: null,
    baseName: 'Test LLM', hasChinaVersion: false, hasGlobalVersion: true,
    versionCounts: channels.length,
    versions: channels.map((overrides, index) => ({
      id: index + 1, model_id: 1, provider_id: 1, input_price_per_1m: 0.001,
      output_price_per_1m: 0.002, currency: 'USD', price_unit: 'per_1m_tokens',
      is_available: true,
      providers: { id: 1, name: 'Test Provider', slug: 'test-provider', type: 'official', region: 'global', access_from_china: false },
      ...overrides,
    })),
  };
}

test('monthly floors retain free tiers and exclude sales placeholders, packs, annual and unknown prices', () => {
  const plans = [
    plan(), plan({ id: 2, name: 'Free', price: 0 }),
    plan({ id: 3, name: 'Enterprise', price: 0, is_contact_sales: true }),
    plan({ id: 4, price: 1, pricing_model: 'token_pack', price_unit: 'per_pack', currency: 'CNY' }),
    plan({ id: 5, price: 2, price_unit: 'per_year', currency: 'EUR' }),
    plan({ id: 6, price: null, currency: 'SGD' }),
    plan({ id: 7, price: 3, price_unit: null, currency: 'GBP' }),
    plan({ id: 8, price: -1, currency: 'JPY' }),
    plan({ id: 9, price: NaN, currency: 'KRW' }),
    plan({ id: 10, price: 4, currency: null }),
  ];
  assert.deepEqual(monthlyPlanFloors(plans), [{ name: 'Free', price: 0, currency: 'USD' }]);
  assert.equal(buildComparisonPricingCopy('Kimi K2', plans, 'en', 2026).title,
    'Kimi K2 Subscription Plans & Pricing 2026: 9 Plans, from $0/mo');
});

test('comparison snippets use DB row counts and monthly prices in both locales', () => {
  const plans = [plan({ name: 'Kimi Basic', price: 39, currency: 'CNY' }), plan({ id: 2, price: 12 })];
  const en = buildComparisonPricingCopy('Kimi K2', plans, 'en', 2026);
  const zh = buildComparisonPricingCopy('Kimi K2', plans, 'zh', 2026);
  assert.match(en.title, /2026: 2 Plans, from CNY 39 \/ \$12\/mo/);
  assert.match(zh.title, /2026：2 个套餐，月付 CNY 39 \/ \$12 起/);
  assert.doesNotMatch(en.description, /OpenAI|Anthropic|Google|every|daily/i);
  const changed = buildComparisonPricingCopy('Kimi K2', [plan({ price: 17 })], 'en', 2027);
  assert.match(changed.title, /2027: 1 Plan, from \$17\/mo/);
});

test('missing public monthly prices never become a made-up free or monthly quote', () => {
  const unpriced = [plan({ price: null }), plan({ id: 2, price: 0, is_contact_sales: true })];
  for (const locale of ['en', 'zh'] as const) {
    const copy = buildComparisonPricingCopy('Test LLM', unpriced, locale, 2026);
    assert.doesNotMatch(copy.title + copy.description, /\$|from|起/);
  }
  const empty = buildComparisonPricingCopy('Test LLM', [], 'en', 2026);
  assert.match(empty.title, /0 Plans/);
  assert.equal(monthlyPlanFloors([]).length, 0);
});

test('provider titles select existing tier names and skip repeated Pro variants', () => {
  const plans = [
    plan({ id: 0, name: 'ChatGPT Free', price: 0 }), plan(),
    plan({ id: 2, name: 'ChatGPT Pro', price: 100 }),
    plan({ id: 3, name: 'ChatGPT Pro 200', price: 200 }),
    plan({ id: 4, name: 'ChatGPT Team', price: 30 }),
  ];
  const en = buildProviderPricingCopy('OpenAI', plans, 'en', 2026);
  assert.equal(en.title, 'OpenAI Pricing: API Costs & Subscription Plans 2026: ChatGPT Plus, Pro, Team');
  assert.match(en.description, /5 listed subscription plans, from \$0\/mo/);
  assert.equal(buildProviderPricingCopy('OpenAI', plans, 'zh', 2026).title,
    'OpenAI API 价格与订阅套餐 2026：ChatGPT Plus, Pro, Team');
  const single = buildProviderPricingCopy('Other', [plan({ name: 'Actual Tier' })], 'en', 2026);
  assert.match(single.title, /Actual Tier/);
  assert.doesNotMatch(single.title, /Plus|Pro|Team|ChatGPT/);
  assert.equal(buildProviderPricingCopy('No Data', [], 'en', 2026).title, 'No Data API Pricing & Model Costs 2026');
});

test('moonshot china chinese copy targets API price and subscription queries', () => {
  const plans = [
    plan({ name: 'Kimi Basic', price: 49, currency: 'CNY' }),
    plan({ id: 2, name: 'Kimi Pro', price: 199, currency: 'CNY' }),
  ];
  const zh = buildProviderPricingCopy('月之暗面 (Moonshot/Kimi)', plans, 'zh', 2026, 'moonshot-china');
  assert.match(zh.title, /Kimi.*月之暗面.*API 价格与订阅套餐 2026/);
  assert.match(zh.title, /订阅/);
  assert.match(zh.description, /API 价格/);
  assert.match(zh.description, /订阅/);
  assert.match(zh.description, /2 个已收录订阅套餐/);
  assert.match(zh.title, /Kimi Pro, Basic/);
  const en = buildProviderPricingCopy('月之暗面 (Moonshot/Kimi)', plans, 'en', 2026, 'moonshot-china');
  assert.match(en.title, /Pricing: API Costs & Subscription Plans 2026/);
  assert.doesNotMatch(en.title, /月之暗面 API/);
});

test('plans index copy takes provider names and counts from the returned catalog', () => {
  const providers = [{ name: 'OpenAI', planCount: 5 }, { name: 'Anthropic', planCount: 4 }];
  assert.equal(buildPlansIndexPricingCopy(providers, 'en', 2026).title,
    'AI Plans & Pricing 2026: Compare 9 Plans from 2 Providers');
  assert.match(buildPlansIndexPricingCopy(providers, 'zh', 2026).description, /2 家供应商的 9 个套餐，包括 OpenAI, Anthropic/);
  assert.doesNotMatch(buildPlansIndexPricingCopy([], 'en', 2026).description, /OpenAI|daily/);
});

test('API FAQs quote native-currency input prices with zero and sub-cent rates intact', () => {
  const products = [product([
    { input_price_per_1m: 0.000001 },
    { input_price_per_1m: 0.02 },
    { currency: 'CNY', input_price_per_1m: 0, provider_id: 2 },
    { input_price_per_1m: -1 },
    { input_price_per_1m: NaN },
    { currency: 'EUR', input_price_per_1m: 0, is_available: false },
    { currency: 'GBP', input_price_per_1m: 0, price_unit: 'per_request' },
  ])];
  assert.equal(seoPrice({ price: 0.000001, currency: 'USD', name: '' }), '$0.000001');
  assert.deepEqual(priceFloors([{ name: '', price: 0, currency: 'unknown' }]), []);
  for (const locale of ['en', 'zh'] as const) {
    const copy = buildApiPricingSeo(products, '2026-10-13T22:00:00Z', locale, 2026);
    const lowest = copy.faqs[1].answer;
    assert.match(lowest, /CNY 0/);
    assert.match(lowest, /\$0\.000001/);
    assert.doesNotMatch(lowest, /EUR|GBP|NaN|-1/);
    assert.match(copy.description, /6/);
    assert.match(copy.description, /2026-10-13/);
    assert.equal(copy.updatedOn, '2026-10-13');
    const structured = JSON.parse(faqPage(copy.faqs));
    assert.equal(structured['@type'], 'FAQPage');
    assert.deepEqual(structured.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({
      question: q.name, answer: q.acceptedAnswer.text,
    })), copy.faqs);
  }
});

test('API copy consumes effective render-time prices after scheduled promotions expire', () => {
  const p = product([{ input_price_per_1m: 0.1, regular_input_price_per_1m: 0.5, promo_ends_at: '2026-10-14T00:00:00Z' }]);
  p.versions = p.versions.map((row) => effectivePrice(row, new Date('2026-10-14T01:00:00Z')));
  const copy = buildApiPricingSeo([p], null, 'en', 2026);
  assert.match(copy.faqs[1].answer, /\$0\.5/);
  assert.doesNotMatch(copy.faqs[1].answer, /\$0\.1/);
});

test('API FAQ attributes a merged variant price to its actual SKU', () => {
  const p = product([{ model_slug: 'test-llm-mini-batch', input_price_per_1m: 0.05 }]);
  const copy = buildApiPricingSeo([p], '2026-10-13', 'en', 2026);
  assert.match(copy.faqs[1].answer, /test-llm-mini-batch \(Test Provider\) at \$0\.05/);
  assert.doesNotMatch(copy.introduction, /2026-10-13/);
  assert.match(copy.description, /2026-10-13/);
});

test('API update dates come only from valid DB timestamps and use UTC consistently', () => {
  assert.equal(databaseDate('2026-10-14T01:00:00+08:00'), '2026-10-13');
  assert.equal(databaseDate(new Date('2026-10-14T12:00:00Z')), '2026-10-14');
  assert.equal(databaseDate(null), null);
  assert.equal(databaseDate('invalid'), null);
  for (const locale of ['en', 'zh'] as const) {
    const copy = buildApiPricingSeo([], null, locale, 2026);
    assert.equal(copy.updatedOn, null);
    assert.equal(copy.faqs.length, 2);
    assert.doesNotMatch(copy.description, /updated|更新|daily|每日|2026-10/);
  }
});

test('pricing metadata keeps canonical, bilingual alternates and social copy aligned', () => {
  const en = buildApiPricingSeo([product([{}])], '2026-10-13', 'en', 2026);
  const zh = buildApiPricingSeo([product([{}])], '2026-10-13', 'zh', 2026);
  assert.equal(zh.heading, 'AI 大模型 API 价格对比（每百万 token）');
  assert.equal(en.heading, 'AI Model API Pricing Comparison (per Million Tokens)');
  const metadata = buildMetadata({ locale: 'en', path: '/api-pricing',
    title: { en: en.title, zh: zh.title }, description: { en: en.description, zh: zh.description },
  });
  assert.equal(metadata.alternates?.canonical, 'https://aiplans.dev/en/api-pricing');
  assert.equal(metadata.alternates?.languages?.['zh-CN'], 'https://aiplans.dev/zh/api-pricing');
  assert.equal(metadata.openGraph?.title, en.title);
  assert.equal(metadata.twitter?.description, en.description);
});
