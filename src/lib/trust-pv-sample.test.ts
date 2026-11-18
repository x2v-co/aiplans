import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { loadQueryModule } from './test-helpers/query-module';
import { TOP_TRUST_PAGES, LEGACY_TRUST_PAGES, isTrustDisplayPage, isTrustPage, channelListPriceTrust, planEntitlementTrust, planPriceTrust, quotaEstimateTrust, reviewedPlanSource, variantPriceTrust, usagePriceTrust } from './data-trust';
import type { VerifiedQuotaEstimate } from './quota/estimates';
import type { PlanComparison } from './compare-plans';
import type { Metadata } from 'next';

// Entirely synthetic offline records. No production/current-price or GUI proof.
const NOW = '2026-11-18T00:00:00Z';
const provider = { id: 1, name: 'Synthetic producer', slug: 'synthetic-producer', type: 'producer', region: 'global',
  pricing_url: 'https://producer.example.test/pricing', website: 'https://producer.example.test/', logo: null };
const reseller = { ...provider, id: 2, name: 'Synthetic third party', slug: 'synthetic-reseller', type: 'aggregator',
  pricing_url: null, website: 'https://reseller.example.test/' };
const plans = [provider, reseller].map((p, i) => ({
  id: i + 1, provider_id: p.id, slug: `synthetic-${i ? 'third-party' : 'official'}-pro`, name: `Synthetic ${i ? 'Third Party' : 'Official'} Pro`,
  tier: 'pro', price: i ? 7 : 20, annual_price: i ? 70 : 200, currency: 'USD', price_unit: 'per_month',
  pricing_model: 'subscription', plan_kind: 'chat', features: ['Recorded feature', 'Estimated 2 million tokens'],
  notes: null, last_verified: i ? null : '2026-11-01', legacy_ends_on: i ? '2026-10-29' : null,
  requests_per_minute: 10, tokens_per_minute: 1000, qps: 2, context_window: 32000, monthly_message_limit: 100,
  quota_unit: 'tokens', third_party_coverage: 'unknown', providers: p, quotas: null,
}));
const channel = { id: 10, model_id: 100, provider_id: 1, input_price_per_1m: 2, output_price_per_1m: 8,
  cached_input_price_per_1m: 0.2, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
  last_verified: '2026-11-02', providers: provider,
  price_variants: [{ id: 11, variant_name: 'Synthetic unknown variant', variant_kind: 'tier',
    input_price_per_1m: 3, output_price_per_1m: 9, currency: 'USD', price_unit: 'per_1m_tokens',
    source_url: null, last_verified: null, is_headline: true, constraints_json: { region: 'fixture-only' } }],
};
const usage = { id: 22, model_id: 100, provider_id: 1, plan_id: 1, price: 0.5, price_kind: 'input_tokens',
  currency: 'USD', unit: 'per_1m_tokens', source_url: null, last_verified: null, constraints_json: { batch: true },
  is_available: true, provider_name: provider.name, provider_slug: provider.slug, provider_type: provider.type,
  plan_name: plans[0].name, plan_slug: plans[0].slug };
const estimate: VerifiedQuotaEstimate = {
  id: 30, planSlug: plans[0].slug, planName: plans[0].name, providerName: provider.name,
  servedModel: 'Synthetic model', window: 'weekly', low: 100000, high: 200000,
  mix: { id: 'fixture', name: 'Synthetic mix', cacheReadPct: 50, inputPct: 30, outputPct: 20 },
  confidence: 'low', verifiedAt: '2026-10-20T00:00:00Z', createdAt: '2026-10-19T00:00:00Z',
  notes: 'Synthetic estimate; not guaranteed rights', isCurrent: true, supersededBy: null,
  evidence: [{ id: 1, url: 'https://evidence.example.test/experiment', capturedAt: '2026-10-20T00:00:00Z', type: 'experiment' }],
};
const estimates = [estimate, { ...estimate, id: 31, planSlug: plans[1].slug, evidence: [] }];
const translations = (locale: string) => ({ getTranslations: async ({ namespace }: { namespace: string }) =>
  createTranslator({ locale, messages: locale === 'zh' ? zh : en, namespace: namespace as 'modelDetail' }) });
const header = { default: () => null, __esModule: true };
const load = (path: string, mocks: Record<string, unknown>) => loadQueryModule(new URL(path, import.meta.url), mocks);
const sqlArray = { array: (values: unknown[]) => values };

function markup(element: ReactElement, locale: string) {
  return renderToStaticMarkup(jsx(NextIntlClientProvider, {
    locale, timeZone: 'UTC', now: new Date(NOW), messages: locale === 'zh' ? zh : en, children: element,
  } satisfies ComponentProps<typeof NextIntlClientProvider>));
}

function fact(html: string, record: string) {
  const escaped = record.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<aside[^>]*data-trust-record="${escaped}"[\\s\\S]*?</aside>`));
  assert.ok(match, `real rendered field label ${record}`);
  assert.match(match[0], /适用条件|Conditions/);
  assert.match(match[0], /最近核验|核验时间|估算 \/ 方法记录日期|Last verified|Verification time|Estimate \/ method record date/);
  return match[0];
}

async function comparisonData(slug: string, planRows = plans, providers = [provider, reseller]) {
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (/FROM models/.test(query)) return [{ id: 100, slug, name: 'Synthetic model', provider_ids: [1], context_window: 32000 }];
    if (/FROM model_plan_mapping/.test(query)) return planRows.map(p => ({ plan_id: p.id, model_id: 100 }));
    if (/FROM plans/.test(query)) {
      assert.match(query, /legacy_ends_on/, 'existing expiry metadata is read, never fabricated');
      return structuredClone(planRows);
    }
    if (/FROM providers/.test(query)) return providers;
    throw new Error(`Unexpected offline SQL: ${query}`);
  }, sqlArray);
  const mod = load('./compare-plans.ts', {
    '@/lib/db': { sql },
    '@/lib/schema-adapters': { getPrimaryProvidersForModels: async () => new Map([[100, provider]]),
      getPlanYearlyMonthly: (p: { annual_price: number }) => p.annual_price / 12 },
  });
  return (mod.getPlanComparison as (slug: string) => Promise<PlanComparison>)(slug);
}

async function compareHtml(slug: string, locale: string, planRows = plans, providers = [provider, reseller]) {
  const data = await comparisonData(slug, planRows, providers);
  const view = load('../app/[locale]/compare/plans/[model]/compare-plans-view.tsx', { '@/components/SiteHeader': header });
  const route = load('../app/[locale]/compare/plans/[model]/page.tsx', {
    './compare-plans-view': view, '@/lib/compare-plans': { getPlanComparison: async () => data },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => estimates },
    '@/lib/seo-index-data': { getSeoIndexCatalog: async () => [{ slug, active: true, is_llm: true, available_api_count: 1,
      api_price_count: 1, usage_price_count: 0, priced_plan_count: 2, plan_count: 2, priced_subscription_count: 2,
      priced_subscription_provider_count: 2, released_at: '2026-11-01', description: 'Synthetic catalog eligibility fixture' }] },
  });
  const page = await (route.default as (p: { params: Promise<{ locale: string; model: string }> }) => Promise<ReactElement>)({ params: Promise.resolve({ locale, model: slug }) });
  assert.equal(route.revalidate, 300);
  return { html: markup(page, locale), data };
}

async function providerHtml(slug: string, locale: string, planRows = plans) {
  const realApi = load('../components/provider-api-models.tsx', { 'next-intl/server': translations(locale) }).ProviderApiModels as
    (props: Record<string, unknown>) => Promise<ReactElement>;
  // Resolve the actual async server section before legacy static React SSR.
  // Its data, markup, labels, prices and route-supplied gate remain real.
  function DeferredApi() { return null; }
  async function resolve(node: ReactNode): Promise<ReactNode> {
    if (!isValidElement(node)) return node;
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.type === DeferredApi) return realApi(el.props);
    if (!el.props.children) return el;
    const children = await Promise.all(Children.toArray(el.props.children).map(resolve));
    return cloneElement(el, {}, ...children);
  }
  const route = load('../app/[locale]/providers/[slug]/catalog-page.tsx', {
    '@/lib/db': { sql: async () => { throw new Error('unexpected DB read'); } },
    '@/lib/provider-plans-query': { getPlansByProvider: async () => ({ provider: { ...provider, slug }, plans: structuredClone(planRows), models: [], comparisons: [] }) },
    '@/lib/grouped-products': { getGroupedProducts: async () => [{ id: 100, slug: 'synthetic-model', name: 'Synthetic model', versions: [channel] }] },
    '@/components/provider-api-models': { ProviderApiModels: DeferredApi },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => estimates },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    'next-intl/server': translations(locale), '@/components/SiteHeader': header,
  });
  const page = await (route.default as (p: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<object> }) => Promise<ReactElement>)({
    params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({}),
  });
  return markup(await resolve(page) as ReactElement, locale);
}

async function modelHtml(slug: string, locale: string, channelRows = [channel], usageRows = [usage]) {
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (/FROM models\s+WHERE slug/.test(query)) return [{ id: 100, slug, name: 'Synthetic model', provider_ids: [1], context_window: 32000, description: null }];
    if (/SELECT m\.slug, m\.name/.test(query)) return [];
    if (/FROM api_channel_prices cp/.test(query)) return channelRows;
    if (/FROM arena_leaderboard|FROM price_history|FROM model_benchmark_scores/.test(query)) return [];
    throw new Error(`Unexpected offline model SQL: ${query}`);
  }, sqlArray);
  const route = load('../app/[locale]/models/[slug]/page.tsx', {
    '@/lib/db': { sql }, '@/lib/model-plans-query': { getModelPlans: async (_id: number, _producer: number, _usage: number[], _now: Date, options: unknown) => {
      assert.equal((options as { includePriceOffers?: boolean }).includePriceOffers, true);
      assert.deepEqual(Object.keys(options as object), ['includePriceOffers']); return structuredClone(plans);
    } },
    '@/lib/schema-adapters': { getPrimaryProvidersForModels: async () => new Map([[100, provider]]) },
    '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => usageRows },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    '@/lib/coding-agents': { getCodingAgentRowsForModel: async () => [] },
    'next-intl/server': translations(locale), '@/components/SiteHeader': header,
  });
  const page = await (route.default as (p: { params: Promise<{ locale: string; slug: string }> }) => Promise<ReactElement>)({ params: Promise.resolve({ locale, slug }) });
  assert.equal(route.revalidate, 300);
  return markup(page, locale);
}

for (const page of TOP_TRUST_PAGES) test(`synthetic real-route coverage: ${page.path}`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  const html = page.kind === 'compare-plan' ? (await compareHtml(page.slug, 'zh')).html
    : page.kind === 'provider' ? await providerHtml(page.slug, 'zh') : await modelHtml(page.slug, 'zh');
  assert.match(html, /data-trust-scope="pv-detail-sample-20261118"/);
  assert.match(html, /不代表全站排名或全部已获官方核验/);
  for (const p of plans) {
    const price = fact(html, `plan:${p.slug}:price`);
    assert.match(price, /data-trust-unverified="true"/);
    assert.match(price, /历史价格记录/);
    assert.doesNotMatch(price, />已核验</);
    const rights = fact(html, `plan:${p.slug}:entitlements`);
    assert.match(rights, /data-trust-unverified="true"/);
    assert.match(rights, /核验时间：未知/);
    assert.doesNotMatch(rights, /<time|>已核验</);
    const calculation = fact(html, `plan:${p.slug}:calculated`);
    assert.match(calculation, /data-trust-estimated="true"/);
    if (page.kind !== 'model') {
      const quota = fact(html, `quota:${p.id === 1 ? 30 : 31}`);
      assert.match(quota, /data-trust-estimated="true"/);
      assert.doesNotMatch(quota, />已核验</);
      if (p.id === 2) assert.match(quota, /data-trust-unverified="true"/);
    }
    if (p.id === 2) {
      assert.match(price, /data-trust-expired="true"/);
      assert.match(price, /data-trust-unverified="true"/);
      assert.match(price, /核验时间：未知/);
      assert.doesNotMatch(price, /reseller\.example\.test/);
    } else assert.match(price, /dateTime="2026-11-01"/);
  }
  if (page.kind !== 'compare-plan') {
    assert.match(fact(html, page.kind === 'provider' ? 'channel:10:price' : 'channel:10:summary-price'), /2026-11-02/);
    const variant = fact(html, 'variant:11:price');
    assert.match(variant, /data-trust-unverified="true"/);
    assert.match(variant, /核验时间：未知/);
    assert.doesNotMatch(variant, /producer\.example\.test/);
    if (page.kind === 'model') assert.match(fact(html, 'usage:22'), /data-trust-unverified="true"/);
  } else {
    assert.doesNotMatch(html, /Data sources: Official pricing pages from each provider|价格最后核实/);
    assert.match(html, /https:\/\/aiplans\.dev\/zh\/compare\/plans\//);
  }
});

test('runtime English sample variants retain only PR379 coverage and outside-union paths stay unlabeled', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  for (const page of TOP_TRUST_PAGES) {
    const html = page.kind === 'compare-plan' ? (await compareHtml(page.slug, 'en')).html
      : page.kind === 'provider' ? await providerHtml(page.slug, 'en') : await modelHtml(page.slug, 'en');
    assert.equal(isTrustPage('en', page.kind, page.slug), false, page.path);
    if (page.kind === 'provider' && ['openai', 'google'].includes(page.slug)) {
      assert.match(html, /data-trust-label=/);
      assert.match(html, /data-trust-scope="legacy-selected-review"/);
      assert.match(html, /outside this detail-page PV sample/);
      assert.doesNotMatch(html, /data-trust-scope="pv-detail-sample/);
    } else assert.doesNotMatch(html, /data-trust-label=|data-trust-scope=/, page.path);
  }
  for (const [kind, slug] of [['model', 'synthetic-outside'], ['provider', 'fixture-unselected'], ['compare-plan', 'synthetic-outside']] as const) {
    assert.equal(isTrustPage('zh', kind, slug), false);
    assert.equal(isTrustDisplayPage('zh', kind, slug), false);
    const html = kind === 'model' ? await modelHtml(slug, 'zh') : kind === 'provider' ? await providerHtml(slug, 'zh') : (await compareHtml(slug, 'zh')).html;
    assert.doesNotMatch(html, /data-trust-label=|data-trust-scope=/);
  }
});

// Every PR379 locale path must keep actual route labels, not merely a helper entry.
for (const page of LEGACY_TRUST_PAGES) for (const locale of ['zh', 'en']) {
  test(`retained PR379 real-route coverage: /${locale}/${page.kind}/${page.slug}`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
    const html = page.kind === 'model' ? await modelHtml(page.slug, locale) : await providerHtml(page.slug, locale);
    const sampled = isTrustPage(locale, page.kind, page.slug);
    assert.equal(isTrustDisplayPage(locale, page.kind, page.slug), true);
    assert.equal(sampled, locale === 'zh' && page.kind === 'provider' && ['openai', 'google'].includes(page.slug));
    assert.match(html, sampled ? /data-trust-scope="pv-detail-sample-20261118"/ : /data-trust-scope="legacy-selected-review"/);
    if (!sampled) {
      assert.doesNotMatch(html, /data-trust-scope="pv-detail-sample|本页属于选定的 10 个详情页 PV 样本|This page belongs to a selected ten-detail-page/);
      assert.match(html, locale === 'zh' ? /不属于本轮详情页 PV 样本/ : /outside this detail-page PV sample/);
      assert.match(html, locale === 'zh' ? /历史记录不代表本轮已核验当前价格或权益/ : /Historical records do not confirm current prices or entitlements/);
    }
    for (const p of plans) {
      const price = fact(html, `plan:${p.slug}:price`);
      assert.match(price, /data-trust-unverified="true"/);
      assert.match(price, locale === 'zh' ? /历史价格记录/ : /Historical price record/);
      const rights = fact(html, `plan:${p.slug}:entitlements`);
      assert.match(rights, /data-trust-unverified="true"/);
      assert.match(rights, locale === 'zh' ? /核验时间：未知/ : /Verification time: unknown/);
      assert.doesNotMatch(rights, /<time|>已核验<|>Verified</);
      assert.match(fact(html, `plan:${p.slug}:calculated`), /data-trust-estimated="true"/);
      if (p.id === 2) {
        assert.match(price, /data-trust-expired="true"/);
        assert.match(price, locale === 'zh' ? /核验时间：未知/ : /Verification time: unknown/);
        assert.doesNotMatch(price, /reseller\.example\.test/);
      } else assert.match(price, /dateTime="2026-11-01"/);
    }
    const variant = fact(html, 'variant:11:price');
    assert.match(variant, /data-trust-unverified="true"/);
    assert.doesNotMatch(variant, /<time|producer\.example\.test/);
    if (page.kind === 'model') {
      assert.match(fact(html, 'channel:10:summary-price'), /2026-11-02/);
      assert.match(fact(html, 'usage:22'), /data-trust-unverified="true"/);
    } else assert.match(fact(html, 'channel:10:price'), /2026-11-02/);
  });
}

test('missing provenance cannot inherit homepage, price, variant or estimate verification', () => {
  const now = new Date(NOW);
  const source = reviewedPlanSource(reseller.slug, 'zh', reseller);
  assert.equal(source.url, null);
  const price = planPriceTrust(plans[1], source, 'zh', now);
  assert.equal(price.verifiedOn, null);
  assert.equal(price.flags.unverified, true);
  const rights = planEntitlementTrust(plans[0], reviewedPlanSource(provider.slug, 'zh', provider), 'zh', now);
  assert.equal(rights.verifiedOn, null);
  assert.equal(rights.flags.unverified, true);
  const v = variantPriceTrust(channel.price_variants[0], channel, 'zh', now);
  assert.equal(v.sourceUrl, null);
  assert.equal(v.verifiedOn, null);
  assert.equal(usagePriceTrust(usage, 'zh', now).flags.unverified, true);
  const api = channelListPriceTrust({ ...channel, providers: reseller }, 'zh', now);
  assert.equal(api.sourceUrl, null);
  assert.equal(api.flags.unverified, true);
  const quota = quotaEstimateTrust({ verifiedAt: '2026-10-20', windowLabel: 'weekly', mix: 'synthetic', servedModel: null, evidenceUrl: null, isCurrent: true }, 'zh', now);
  assert.equal(quota.flags.estimated, true);
  assert.equal(quota.flags.unverified, true);
  assert.match(quota.conditions.join(''), /不构成官方额度证据/);
});

test('selected comparison cannot certify Seed zeros or Qoder/Token Pass reference links as current prices', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  // Synthetic values exercising the audited failure shapes, not imported facts.
  for (const name of ['Seed Free Trial', 'Seed Enterprise', 'Qoder Lite', 'Token Pass']) {
    const raw = { ...plans[0], name, price: name.startsWith('Seed') ? 0 : 10, last_verified: '2026-11-01' };
    const references = [{ ...provider, pricing_url: 'https://reference.example.test/notfound' }, reseller];
    const { html } = await compareHtml('deepseek-v4-pro', 'zh', [raw], references);
    const price = fact(html, `plan:${raw.slug}:price`);
    assert.match(price, /data-trust-unverified="true"/);
    assert.match(price, /历史价格记录/);
    assert.match(price, /2026-11-01/);
    assert.match(price, /失效链接不能确认订阅价格/);
    assert.doesNotMatch(price, />已核验<|免费档公开标价/);
    if (raw.price === 0) assert.match(price, /不构成该档存在、正式发布或官方免费的确认/);
  }
});

test('DeepSeek provider with zero subscriptions labels API rows without inventing plans', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  const html = await providerHtml('deepseek', 'zh', []);
  assert.match(html, /0 个订阅套餐/);
  assert.doesNotMatch(html, /data-trust-record="plan:|id="synthetic-/);
  assert.match(fact(html, 'channel:10:price'), /2026-11-02/);
  assert.match(html, /API 代表价不能确认订阅价格或所有 API 数据已核验/);
  assert.match(html, /每百万 tokens|每百万 tokens/);
  assert.match(html, /高峰 \/ 低谷/);
});

test('representative amounts cannot verify rights, currency or current blocked sources', () => {
  const now = new Date(NOW);
  for (const providerSlug of ['openai', 'google', 'moonshot-china', 'minimax-china', 'opencode', 'volcengine']) {
    const raw = { ...plans[0], price: 10 };
    const source = reviewedPlanSource(providerSlug, 'zh', provider);
    const price = planPriceTrust(raw, source, 'zh', now, providerSlug, { historicalOnly: true });
    assert.equal(price.flags.unverified, true);
    assert.equal(price.verifiedOn, '2026-11-01');
    assert.match(price.conditions.join(''), /币种、税费、购买资格/);
    const rights = planEntitlementTrust(raw, source, 'zh', now);
    assert.equal(rights.flags.unverified, true);
    assert.equal(rights.verifiedOn, null);
  }
});

test('real comparison helper preserves stored values and keeps official/third-party evidence separate', async () => {
  const before = structuredClone(plans);
  const data = await comparisonData('deepseek-v4-pro');
  assert.equal(data.officialPlans.length, 1);
  assert.equal(data.thirdPartyPlans.length, 1);
  for (const row of [...data.officialPlans, ...data.thirdPartyPlans]) {
    const raw = plans.find(p => p.id === row.plan.id)!;
    assert.equal(row.pricing.monthly, raw.price);
    assert.equal(row.pricing.yearly, raw.annual_price);
    assert.equal(row.lastVerified, raw.last_verified);
    assert.equal(row.trust.last_verified, raw.last_verified);
    assert.equal(row.trust.legacy_ends_on, raw.legacy_ends_on);
    assert.deepEqual(row.plan.features, raw.features);
  }
  assert.deepEqual(plans, before);
});

test('real grouped API query carries independent channel and variant provenance without fallback dates', async () => {
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (/FROM model_benchmark_scores/.test(query)) return [];
    if (/JOIN providers p/.test(query)) {
      assert.match(query, /cp\.last_verified/);
      assert.match(query, /'source_url', v\.source_url/);
      assert.match(query, /'last_verified', v\.last_verified/);
      return [structuredClone(channel)];
    }
    if (/FROM models/.test(query)) return [{ id: 100, slug: 'synthetic-model', name: 'Synthetic model', provider_ids: [1] }];
    throw new Error(`Unexpected offline grouping SQL: ${query}`);
  }, sqlArray);
  const mod = load('./grouped-products.ts', { '@/lib/db': { sql },
    '@/lib/schema-adapters': { attachPrimaryProvidersToModels: async (rows: unknown[]) => rows },
  });
  const grouped = await (mod.getGroupedProducts as (type: string, providerId: number, now: Date) => Promise<Array<{ versions: typeof channel[] }>>)('llm', 1, new Date(NOW));
  assert.equal(grouped[0].versions[0].last_verified, channel.last_verified);
  assert.equal(grouped[0].versions[0].price_variants[0].last_verified, null);
  assert.equal(grouped[0].versions[0].price_variants[0].source_url, null);
});

test('real metadata keeps exact locale canonicals and index policy for all ten sample paths', async () => {
  for (const page of TOP_TRUST_PAGES) {
    const catalog = [{ slug: page.slug, active: true, is_llm: true, available_api_count: 1, api_price_count: 1,
      priced_plan_count: 2, usage_price_count: 0, plan_count: 2, priced_subscription_count: 2,
      priced_subscription_provider_count: 2, released_at: '2026-11-01', description: 'Synthetic indexable fixture' }];
    const routePath = page.kind === 'model' ? '../app/[locale]/models/[slug]/page.tsx'
      : page.kind === 'provider' ? '../app/[locale]/providers/[slug]/catalog-page.tsx' : '../app/[locale]/compare/plans/[model]/layout.tsx';
    const mod = load(routePath, {
      '@/lib/db': { sql: async (strings: TemplateStringsArray) => /FROM api_channel_prices/.test(strings.join('?')) ? []
        : [{ id: 100, slug: page.slug, name: 'Synthetic metadata model', updated_at: null, pricing_unit: null }] },
      '@/lib/seo-index-data': { getSeoIndexCatalog: async () => catalog },
      '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => [] },
      '@/lib/pricing-seo-data': { getComparisonSeoData: async () => ({ model: { slug: page.slug, name: 'Synthetic model' }, plans: [] }),
        getProviderSeoPlans: async () => [] },
    });
    const generate = mod.generateMetadata as (p: { params: Promise<{ locale: string; slug: string; model: string }> }) => Promise<Metadata>;
    for (const locale of ['zh', 'en']) {
      const metadata = await generate({ params: Promise.resolve({ locale, slug: page.slug, model: page.slug }) });
      assert.equal(metadata.alternates?.canonical, `https://aiplans.dev${page.path.replace('/zh/', `/${locale}/`)}`);
    }
  }
});
