import { loadQueryModule } from './test-helpers/query-module';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { availableUsagePrices, officialUsageFallback, usagePriceHeadline, type ModelUsagePriceRow } from './model-usage-prices';
import type { ModelPlanCardRow } from '@/components/model-plan-card';
import type { PricingChannel } from './model-pricing-seo';
import { catalogForKind } from './ai-vertical-catalog';
import type { VerticalModelDetail } from './vertical-model-detail';

const slug = 'gemini-omni-1-1-flash';
const rows: ModelUsagePriceRow[] = [1.5, 9, 17.5].map((price, i) => ({
  id: 580 + i, model_id: 10, provider_id: 3, plan_id: null,
  price_kind: ['input_tokens', 'text_output_tokens', 'video_output_tokens'][i],
  unit: 'per_1m_tokens', price, currency: 'USD', is_available: true,
  constraints_json: null, source_url: 'https://ai.google.dev/gemini-api/docs/pricing',
  last_verified: '2026-10-30', provider_name: 'Google', provider_slug: 'google',
  provider_type: 'producer', plan_name: null, plan_slug: null,
}));
const planRows = rows.map((row, i) => ({ ...row, id: 583 + i, plan_id: 2256,
  plan_name: 'Gemini API paid tier', plan_slug: 'gemini-api-paid' }));
const channel: PricingChannel = { id: 7, input_price_per_1m: 2, output_price_per_1m: 10,
  cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
  providers: { name: 'Google', type: 'producer' } };

// Load real routes and renderers with read-only data dependencies stubbed, no DB.
function loadModule(path: string, mocks: Record<string, unknown>): Record<string, unknown> {
  return loadQueryModule(new URL(path, import.meta.url), mocks);
}

async function modelHtml(usagePrices: ModelUsagePriceRow[], channels: PricingChannel[], locale: string,
  fixture?: { slug: string; producer: { id: number; name: string; slug: string }; plans: ModelPlanCardRow[] }) {
  const requestedSlug = fixture?.slug ?? slug;
  const producer = fixture?.producer ?? { name: 'Google', slug: 'google' };
  const sql = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (/FROM models\s+WHERE slug/.test(query)) return [{ id: 10, name: fixture ? requestedSlug : 'Gemini Omni Flash', slug: requestedSlug,
      provider_ids: [], description: null }];
    if (query.includes('FROM api_channel_prices cp')) return channels;
    if (query.includes('FROM plans pl')) {
      if (fixture) return fixture.plans;
      // The combined query also runs when only producer plans may be present.
      const usagePlanIds = values[1] as number[];
      if (!usagePlanIds.includes(2256)) return [];
      return [{ id: 2256, name: 'Gemini API paid tier', slug: 'gemini-api-paid', price: null,
        annual_price: null, tier: 'payg', currency: 'USD', plan_kind: 'api', features: [],
        providers: { id: 3, name: 'Google', slug: 'google', logo: null } }];
    }
    return [];
  }, { array: (values: unknown[]) => values });
  const route = loadModule('../app/[locale]/models/[slug]/page.tsx', {
    '@/lib/db': { sql, INT4_ARRAY: 1007 },
    '@/lib/model-plans-query': loadModule('./model-plans-query.ts', { './db': { sql, INT4_ARRAY: 1007 } }),
    '@/lib/schema-adapters': { getPrimaryProvidersForModels: async () => new Map([[10, producer]]) },
    '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => usagePrices },
    '@/lib/coupons': { getActiveCouponMap: async () => new Map() },
    '@/lib/coding-agents': { getCodingAgentRowsForModel: async () => [] },
    'next-intl/server': { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale, messages: locale === 'zh' ? zh : en, namespace: namespace as 'modelDetail' }) },
    '@/components/SiteHeader': { default: () => null, __esModule: true },
  });
  const Page = route.default as (props: { params: Promise<{ locale: string; slug: string }> }) => Promise<ReactElement>;
  const providerProps = {
    locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en,
    children: await Page({ params: Promise.resolve({ locale, slug: requestedSlug }) }),
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
}

function summaryCards(html: string) {
  return {
    cheapest: html.split(/Cheapest Option|最低价选项/)[1].split(/Official Price|官方价格/)[0],
    official: html.split(/Official Price|官方价格/)[1].split(/Best in China|国内优选/)[0],
  };
}

test('plan query still runs without model/usage links and binds only the exact producer for supplementary subscriptions', async () => {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const sql = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ query: strings.join('?'), values });
    return [];
  }, { array: (values: unknown[], oid: number) => {
    assert.equal(oid, 1007);
    return values;
  } });
  const { getModelPlans } = loadModule('./model-plans-query.ts', { './db': { sql, INT4_ARRAY: 1007 } });
  const fetch = getModelPlans as (model: number, producer: number | null, usage: number[], now: Date) => Promise<unknown[]>;
  await fetch(10, 3, [], new Date('2026-10-30T00:00:00Z'));
  assert.equal(calls.length, 1, 'no association must not short-circuit producer subscriptions');
  assert.deepEqual(Array.from(calls[0].values), [10, [], 3, '2026-10-30']);
  assert.match(calls[0].query, /mapping\.model_id = \? AND mapping\.plan_id = pl\.id/);
  assert.match(calls[0].query, /OR pl\.id = ANY\(\?\)/);
  assert.match(calls[0].query, /pl\.provider_id = \?\s+AND pl\.pricing_model = 'subscription'/);
  for (const field of ['quotas', 'payment_methods', 'context_window', 'daily_message_limit', 'monthly_api_credit_usd', 'included_usage_amount'])
    assert.ok(calls[0].query.includes(`pl.${field}`), `card query must select ${field}`);
  for (const field of ['features_zh', 'features_en', 'limits', 'benefits', 'name_en']) assert.ok(calls[0].query.includes(field));
  assert.doesNotMatch(calls[0].query, /provider_ids|p\.type|JOIN models/, 'shared providers and channel types must not imply plan access');
  assert.match(calls[0].query, /pl\.legacy_ends_on/);
  assert.match(calls[0].query, /NOT LIKE '%\[aiplans:superseded-by %'/);
  assert.match(calls[0].query, /\)\)\s+AND COALESCE\(pl.notes/, 'superseded filter must cover mapping, usage and producer branches');
  assert.doesNotMatch(calls[0].query, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  await fetch(10, null, [2256], new Date('2026-10-30T00:00:00Z'));
  assert.deepEqual(Array.from(calls[1].values), [10, [2256], null, '2026-10-30']);
});

test('usage-only model gives both summary cards an input price and billing unit', async () => {
  for (const locale of ['en', 'zh']) {
    // Output rows arrive first: the headline must still prefer input.
    const cards = summaryCards(await modelHtml([...rows].reverse(), [], locale));
    for (const card of Object.values(cards)) {
      assert.doesNotMatch(card, /N\/A|See official usage rates|官方用量报价见/);
      assert.match(card, /Google/);
      assert.match(card, /USD 1\.5/);
      assert.match(card, locale === 'zh' ? /百万 token/ : /1M tokens/);
      assert.match(card, locale === 'zh' ? /输入 token/ : /Input tokens/);
    }
  }
});

test('without channels the cheapest card can use a lower plan input price', async () => {
  const discounted = planRows.map(row => ({ ...row, price: row.price_kind === 'input_tokens' ? 0.7 : 0.01 }));
  for (const locale of ['en', 'zh']) {
    const cards = summaryCards(await modelHtml([...rows, ...discounted], [], locale));
    assert.match(cards.cheapest, /Gemini API paid tier/);
    assert.match(cards.cheapest, /USD 0\.7/);
    assert.match(cards.cheapest, locale === 'zh' ? /百万 token/ : /1M tokens/);
    assert.match(cards.official, /Google/);
    assert.match(cards.official, /USD 1\.5/);
  }
});

test('usage-only model renders official dimensions and units once in each locale', async () => {
  for (const locale of ['en', 'zh']) {
    const html = await modelHtml([...rows, { ...rows[0], id: 999 }], [], locale);
    assert.doesNotMatch(html, /No official quote recorded|暂无官方报价|No official channel available/);
    for (const price of [1.5, 9, 17.5]) assert.equal(html.split(`USD ${price} /`).length - 1, 1);
    for (const label of locale === 'zh'
      ? ['输入 token', '文本输出 token', '视频输出 token', '百万 token']
      : ['Input tokens', 'Text output tokens', 'Video output tokens', '1M tokens']) assert.ok(html.includes(label));
    assert.ok(html.includes(rows[0].source_url!));
  }
});

test('existing API official quotes keep exactly the same rendered page when usage rows also exist', async () => {
  for (const locale of ['en', 'zh']) {
    const html = await modelHtml(rows, [channel], locale);
    assert.equal(html, await modelHtml([], [channel], locale));
    for (const card of Object.values(summaryCards(html))) {
      assert.match(card, /1M input/);
      assert.match(card, /1M output/);
      assert.doesNotMatch(card, /USD 1\.5/);
    }
  }
  assert.deepEqual(officialUsageFallback([channel], rows), []);
  assert.equal(officialUsageFallback([{ ...channel, providers: { type: 'aggregator' } }], rows).length, 3);
});

test('plan-only usage rows populate the matching plan card without becoming official quotes', async () => {
  assert.deepEqual(officialUsageFallback([], planRows), []);
  for (const locale of ['en', 'zh']) {
    const html = await modelHtml(planRows, [], locale);
    assert.match(html, /Gemini API paid tier/);
    assert.match(html, locale === 'zh' ? /价格未公开/ : /Price not published/);
    assert.match(html, locale === 'zh' ? /暂无官方报价/ : /No official quote recorded/);
    for (const price of [1.5, 9, 17.5]) assert.equal(html.split(`USD ${price} /`).length - 1, 1);
  }
});

test('unavailable, missing and invalid model prices are excluded; zero and distinct units remain', () => {
  const sample = [rows[0], { ...rows[0], id: 999 }, { ...rows[0], is_available: false },
    ...[null, -1, NaN, Infinity].map(price => ({ ...rows[0], price })),
    { ...rows[0], price: 0 }, { ...rows[0], unit: 'minute' }];
  assert.deepEqual(availableUsagePrices(sample).map(row => [row.price, row.unit]),
    [[1.5, 'per_1m_tokens'], [0, 'per_1m_tokens'], [1.5, 'minute']]);
  assert.equal(availableUsagePrices([{ ...rows[0], price: null }], true).length, 1);
  assert.deepEqual(officialUsageFallback([], [{ ...rows[0], provider_type: 'aggregator' }]), []);
});

test('usage headlines preserve free prices and compare matching input units across currencies', () => {
  const cheaperCny = { ...rows[0], id: 900, price: 1, currency: 'CNY' };
  const differentUnit = { ...rows[0], id: 901, price: 0.001, unit: 'per_1k_tokens' };
  assert.equal(usagePriceHeadline([rows[1], rows[0], cheaperCny, differentUnit])?.id, 900);
  assert.equal(usagePriceHeadline([rows[0], { ...rows[0], id: 902, price: 0 }])?.price, 0);
  assert.equal(usagePriceHeadline([{ ...rows[0], price: -1 }, { ...rows[0], is_available: false }]), undefined);
  assert.equal(usagePriceHeadline([rows[2]])?.price_kind, 'video_output_tokens');
});

test('video detail reads structured usage sources while retaining the audited headline in both locales', async () => {
  const item = { ...catalogForKind('video-model').find(item => item.slug === slug)!, providerLogoUrl: '/providers/google.ico' };
  const data = loadModule('./vertical-model-detail.ts', {
    '@/lib/vertical-models': { getVerticalModelCatalog: async () => [item] },
    '@/lib/model-usage-prices-query': { getModelUsagePrices: async (requestedSlug: string) => {
      assert.equal(requestedSlug, slug);
      return [...rows, { ...rows[0], id: 999 }, { ...rows[0], is_available: false }];
    } },
  });
  const getDetail = data.getVerticalModelDetail as (kind: string, slug: string, locale: string) => Promise<VerticalModelDetail>;
  const component = loadModule('../components/vertical-model-detail-page.tsx', {
    '@/lib/vertical-model-detail': { verticalKindPath: () => 'video-models' },
    '@/components/SiteHeader': { default: () => null, __esModule: true },
  });
  const Page = component.default as ComponentType<{ locale: string; kind: 'video-model'; detail: VerticalModelDetail }>;
  for (const locale of ['en', 'zh']) {
    const detail = await getDetail('video-model', slug, locale);
    assert.equal(detail.usagePrices.length, 3);
    assert.equal(detail.item.pricePerUnit, 17.5);
    const html = renderToStaticMarkup(createElement(Page, { locale, kind: 'video-model', detail }));
    assert.doesNotMatch(html, /No structured pricing reference row yet|暂无结构化价格来源行/);
    for (const row of rows) assert.ok(html.includes(`${row.price_kind}:`));
    assert.ok(html.includes(rows[0].source_url!));
    assert.match(html, /per_1m_tokens/);
  }
});

test('shared usage query scopes by model and availability, reads plan ownership and makes no writes', async () => {
  let calls = 0;
  const query = loadModule('./model-usage-prices-query.ts', {
    './db': { sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls++;
      const sql = strings.join('?');
      assert.deepEqual(values, [slug]);
      assert.match(sql, /FROM usage_prices up/);
      assert.match(sql, /JOIN models m ON m.id = up.model_id/);
      assert.match(sql, /LEFT JOIN plans pl ON pl.id = up.plan_id/);
      assert.match(sql, /WHERE m.slug = \? AND COALESCE\(up.is_available, true\)/);
      assert.match(sql, /m.shutdown_date IS NULL/);
      assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
      return planRows;
    } },
  });
  const read = query.getModelUsagePrices as (slug: string) => Promise<ModelUsagePriceRow[]>;
  assert.deepEqual([...await read(slug)], planRows);
  assert.equal(calls, 1);
});


test('model overview headings and channel badges follow the requested locale', async () => {
  const channels = [channel, { ...channel, id: 8, providers: { name: 'OpenRouter', type: 'aggregator' } }];
  const zhHtml = await modelHtml([], channels, 'zh');
  for (const label of Object.values(zh.modelDetail).slice(0, 6)) assert.ok(zhHtml.includes(label), label);
  for (const label of Object.values(en.modelDetail).slice(0, 6)) assert.ok(!zhHtml.includes(label), label);
  assert.match(zhHtml, /聚合平台/);
  const enHtml = await modelHtml([], channels, 'en');
  for (const label of Object.values(en.modelDetail).slice(0, 6)) assert.ok(enHtml.includes(label), label);
  assert.match(enHtml, /Aggregator/);
  assert.match(enHtml, /Official/);
  assert.doesNotMatch(enHtml, /聚合平台|官方/);
});

test('PM six-model bilingual walkthrough renders localized identities and structured plan highlights', async () => {
  const cases = [
    ['openai-gpt-6-astra', 33, 'OpenAI', 'openai', 'ChatGPT Pro', 200, null],
    ['anthropic-claude-opus-5-5', 34, 'Anthropic', 'anthropic', 'Claude Pro', 20, 200],
    ['gemini-3.1-pro', 35, 'Google', 'google', 'Gemini Code Assist Enterprise', 54, 540],
    ['deepseek-v4-pro', 36, 'DeepSeek', 'deepseek', 'DeepSeek', 0, null],
    ['kimi-k3', 42, '月之暗面 (Moonshot/Kimi)', 'moonshot', 'Kimi Basic', 49, 468],
    ['glm-5.2', 43, '智谱', 'zhipu-china', 'GLM Coding Lite', 118, 991.2],
  ] as const;
  for (const [modelSlug, id, name, providerSlug, planName, price, annual] of cases) {
    for (const locale of ['zh', 'en']) {
      const provider = { id, name, slug: providerSlug, logo: null };
      const samplePlan: ModelPlanCardRow = {
        id: 100, name: planName, slug: 'sample-plan', tier: price ? 'pro' : 'free', price,
        annual_price: annual, currency: providerSlug === 'zhipu-china' || providerSlug === 'moonshot' ? 'CNY' : 'USD',
        features: [], payment_methods: ['Credit Card', 'Debit Card'], context_window: 32000,
        access_from_china: true, plan_kind: 'chat', last_verified: '2026-10-29 00:15:00', providers: provider,
      };
      const sampleChannel = { ...channel, providers: { ...provider, type: 'producer', access_from_china: true } };
      const html = await modelHtml([], [sampleChannel], locale, { slug: modelSlug, producer: provider, plans: [samplePlan] });
      const card = html.split('data-plan-card="100"')[1].split('</details>')[0];
      const highlights = card.split('<details')[0];
      assert.equal((highlights.match(/<li\b/g) ?? []).length, 4, `${modelSlug}/${locale}`);
      assert.match(highlights, /32000/);
      assert.match(html, locale === 'zh' ? /支付宝\/微信可用/ : /Alipay\/WeChat Pay accepted/);
      if (locale === 'en') {
        assert.doesNotMatch(html, /月之暗面|智谱|支付宝\/微信可用/);
        if (providerSlug === 'moonshot') assert.ok(html.split('Moonshot AI / Kimi').length > 4, 'header, prose, card and table use English provider');
        if (providerSlug === 'zhipu-china') assert.ok(html.split('Zhipu AI / Z.ai').length > 4);
      }
    }
  }
});
