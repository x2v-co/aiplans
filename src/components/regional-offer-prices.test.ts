// SSR structure only, fictional SYNTHETIC offers. This is not 390px browser/visual proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegionalOfferPrices } from './regional-offer-prices';
import { ProviderPlanPrice } from './provider-plan-price';
import { ModelPlanCard, type ModelPlanCardRow } from './model-plan-card';
import { syntheticOffer, syntheticContext } from '@/lib/price-offers/synthetic-fixture';
import { offerDTO, type OfferDTO } from '@/lib/price-offers/read';
import type { ComparisonContext } from '@/lib/price-offers/compare';
import type { Offer } from '@/lib/price-offers/contract';
import { createHash } from 'node:crypto';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { loadQueryModule } from '@/lib/test-helpers/query-module';

const now = new Date(syntheticContext().now);
const dto = (offer = syntheticOffer()) => offerDTO({ offer, revision: 1 });
function render(locale: string, offers: unknown[] = [dto()], comparison?: ComparisonContext) {
  return renderToStaticMarkup(createElement(RegionalOfferPrices, { planId: 1, offers, locale, now: now.toISOString(), comparison }));
}
const plan: ModelPlanCardRow = { id: 1, name: 'SYNTHETIC FICTIONAL legacy plan', slug: 'synthetic-only', tier: 'pro',
  price: 77, annual_price: null, currency: 'USD', price_unit: 'per_month', features: {}, access_from_china: true, plan_kind: 'chat', providers: null };
function provider(locale: string, fields: { priceOffers?: OfferDTO[]; priceOfferStatus?: 'available' | 'missing-table' } = {}) {
  return renderToStaticMarkup(createElement(ProviderPlanPrice, { plan: { ...plan, ...fields }, showYearly: false, currency: 'USD', locale, now }));
}
function model(locale: string, fields: { priceOffers?: OfferDTO[]; priceOfferStatus?: 'available' | 'missing-table' } = {}) {
  return renderToStaticMarkup(createElement(ModelPlanCard, { plan: { ...plan, ...fields }, locale, now }));
}
for (const locale of ['zh', 'en']) test(`${locale}: exact missing/empty/null/unapproved fallback preserves legacy provider and model HTML`, () => {
  const blocked = syntheticOffer(); blocked.state = 'unverified';
  for (const renderLegacy of [provider, model]) {
    const legacy = renderLegacy(locale);
    for (const fields of [{ priceOffers: [] }, { priceOffers: null as unknown as OfferDTO[] },
      { priceOffers: [], priceOfferStatus: 'missing-table' as const }, { priceOffers: [dto(blocked)] },
      { priceOffers: [{ status: 'quarantine', price: 999999 } as unknown as OfferDTO] }]) assert.equal(renderLegacy(locale, fields), legacy);
    assert.doesNotMatch(legacy, /data-original-offer-price|Reviewed regional offers|已核验的地区报价|CN|International website/);
    assert.match(legacy, /77\.00/);
  }
  assert.equal(provider(locale), locale === 'zh'
    ? '<span class="text-3xl font-bold">US$77.00</span><span class="text-zinc-500 text-sm ml-1">/月</span>'
    : '<span class="text-3xl font-bold">$77.00</span><span class="text-zinc-500 text-sm ml-1">/mo</span>');
});
for (const locale of ['zh', 'en']) test(`${locale}: region/channel adjacent to original charge, independent conditions/sources/times and native keyboard disclosure`, () => {
  const html = render(locale);
  assert.match(html, /data-original-offer-price="true">CNY 10\.00/);
  assert.match(html, locale === 'zh' ? /价格市场: CN/ : /Price market: CN/);
  assert.match(html, locale === 'zh' ? /官方网站/ : /Official website/);
  for (const text of locale === 'zh' ? ['税费', '账户／居住地条件', '付款／银行卡条件', '席位条件', '观察时间', '人工核验时间', '公开来源']
    : ['Tax', 'Account / residency conditions', 'Payment / card conditions', 'Seat conditions', 'Observed at', 'Human reviewed at', 'Public source']) assert.ok(html.includes(text), text);
  assert.match(html, /<details class=/); assert.match(html, /<summary class="[^"]*focus-visible/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b|<table|<script|<iframe|overflow-x-scroll/);
  assert.match(html, /min-w-0 max-w-full/); assert.match(html, /flex-wrap/); assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /dateTime="2026-11-01T00:00:00\.000Z"/); assert.match(html, /dateTime="2026-11-01T01:00:00\.000Z"/);
  assert.doesNotMatch(html, /Lowest among comparable|可比报价中最低|FX valuation time|汇率估值时间/);
});
test('international website is a commercial scope, not locale/currency inferred countries or availability', () => {
  const o = syntheticOffer(); o.price.currency = 'USD'; o.identity.market = { scope: 'international', country: null };
  for (const locale of ['zh', 'en']) {
    const html = render(locale, [dto(o)]);
    assert.match(html, /USD 10\.00/); assert.match(html, locale === 'zh' ? /具体国家待核验/ : /precise countries unverified/);
    assert.doesNotMatch(html, /🇨🇳|🇺🇸|United States|China Available|国内可用/);
  }
});
test('unknown tax/payment and known restricted conditions remain visible without cheapest claims', () => {
  const o = syntheticOffer(); o.tax = { status: 'unknown', review: 'unknown', description: null }; o.reviews.tax = 'unknown';
  o.qualification.payment = { status: 'unknown', description: null };
  o.qualification.account.description = 'SYNTHETIC account upgrade and residency restriction';
  for (const locale of ['zh', 'en']) {
    const html = render(locale, [dto(o)], syntheticContext());
    assert.match(html, /CNY 10\.00/); assert.match(html, /SYNTHETIC account upgrade and residency restriction/);
    assert.match(html, locale === 'zh' ? /税费待核验/ : /Tax unverified/);
    assert.match(html, locale === 'zh' ? /不参与最低价排名/ : /Excluded from cheapest ranking/);
    assert.doesNotMatch(html, /Lowest among comparable|可比报价中最低/);
  }
});
for (const [period, count, label] of [['year', 1, 'annual'], ['month', 3, 'quarterly']] as const)
  test(`${label}: primary original charge and derived equivalent cannot be relabeled monthly billing`, () => {
    const o = syntheticOffer(); o.identity.billing = { period, count }; o.price.amount = '1';
    for (const locale of ['zh', 'en']) {
      const html = render(locale, [dto(o)]);
      assert.match(html, /data-original-offer-price="true">CNY 1\.00/);
      assert.ok(html.includes(locale === 'zh' ? '并非按月扣费' : 'not a monthly charge'));
      assert.ok(html.includes(period === 'year' ? '1/12' : '1/3'));
    }
  });
test('regular, first-purchase and renewal stay separate; FK never manufactures a renewal amount', () => {
  const intro = syntheticOffer(); intro.identity.promotion = 'intro'; intro.identity.promotionId = 'synthetic-campaign'; intro.renewalOfferId = 'synthetic-renewal-unresolved';
  const renewal = syntheticOffer(); renewal.identity.promotion = 'renewal'; renewal.identity.promotionId = 'synthetic-campaign';
  for (const locale of ['zh', 'en']) {
    assert.ok(render(locale).includes(locale === 'zh' ? '常规价格' : 'Regular price'));
    const html = render(locale, [dto(intro)]);
    assert.ok(html.includes(locale === 'zh' ? '首次购买／入门优惠条款' : 'First-purchase / introductory terms'));
    assert.ok(html.includes(locale === 'zh' ? '不等于已核验的续费价格' : 'not a verified renewal quote'));
    assert.equal((html.match(/data-original-offer-price/g) ?? []).length, 1);
    assert.ok(render(locale, [dto(renewal)]).includes(locale === 'zh' ? '续费条款' : 'Renewal terms'));
  }
});
test('public text is escaped, credential URLs reject whole offer; quarantined/archive/malformed never reach markup', () => {
  const o = syntheticOffer(); o.sources[0].note = '<script>SYNTHETIC hostile text</script>';
  assert.match(render('en', [dto(o)]), /&lt;script&gt;/); assert.doesNotMatch(render('en', [dto(o)]), /<script>/);
  for (const input of [{ ...dto(), sources: [{ ...o.sources[0], url: 'https://example.com/?token=do-not-show' }] },
    { status: 'archive', amount: '999999' }, { status: 'quarantine', offer: dto() }, { ...dto(), state: 'conflict' }]) assert.equal(render('en', [input]), '');
});
test('optional coherent CNY conversion is secondary with distinct original, review, FX valuation and observation times', () => {
  const o = syntheticOffer(); o.price.currency = 'USD';
  const source = 'https://example.com/synthetic-fx';
  const ctx = { ...syntheticContext(), fx: { target: 'CNY' as const, source, validAt: '2026-11-16T00:00:00Z', basis: 'SYNTHETIC-only', quotes: [{
    base: 'USD' as const, quote: 'CNY' as const, source, rate: '7.1', validAt: '2026-11-16T00:00:00Z', observedAt: '2026-11-16T02:00:00Z', basis: 'SYNTHETIC-only', status: 'reviewed' as const,
  }] } };
  for (const locale of ['zh', 'en']) {
    const html = render(locale, [dto(o)], ctx);
    assert.match(html, /data-original-offer-price="true">USD 10\.00/); assert.ok(html.includes('CNY 71'));
    assert.ok(html.includes(locale === 'zh' ? '人民币参考换算' : 'Secondary CNY conversion'));
    assert.match(html, /dateTime="2026-11-16T00:00:00\.000Z"/); assert.match(html, /dateTime="2026-11-16T02:00:00\.000Z"/);
    assert.match(html, /USD\/CNY/);
  }
});
test('approved additive quote appears in both integrations while the legacy amount remains unchanged', () => {
  for (const locale of ['zh', 'en']) for (const renderer of [provider, model]) {
    const html = renderer(locale, { priceOffers: [dto()] });
    assert.match(html, /77\.00/); assert.match(html, /CNY 10\.00/);
  }
});
test('future review timestamps and unknown scoped market labels do not acquire approval from a visitor locale', () => {
  const future = syntheticOffer(); future.observedAt = '2026-11-20T00:00:00Z'; future.reviewedAt = '2026-11-20T01:00:00Z';
  future.sources[0].observedAt = future.observedAt; future.sources[0].reviewedAt = future.reviewedAt;
  assert.equal(render('zh', [dto(future)]), '');
  const unknown: Offer = syntheticOffer(); unknown.identity.market = { scope: 'unknown', country: null }; unknown.identity.channel = 'unknown'; unknown.identity.merchant = null;
  for (const locale of ['zh', 'en']) assert.ok(render(locale, [dto(unknown)]).includes(locale === 'zh' ? '待核验' : 'Unverified'));
});

// Main-content SSR hashes captured before the regional ModelPlanCard edit.
// These bind fictional legacy promotion HTML, not an official current offer.
const promotionPlan = { ...plan, pricing_model: 'subscription', regular_price: 99, promo_ends_at: '2026-12-01T08:00:00Z' };
for (const [locale, expected] of [
  ['zh', '46b892ab3d6d3e7fa7ed0a86514f31e83018788d4aa10ce6a06cd7b8278dfdd7'],
  ['en', '9715d6b0a356db45e102350be71ad267da74a94b635fa09fd911200772f2241a'],
] as const) test(`${locale}: zero qualifying regional offers preserves exact deployed promotion card HTML`, () => {
  const unreviewed = syntheticOffer(); unreviewed.state = 'unverified';
  for (const fields of [{}, { priceOffers: [] }, { priceOffers: null },
    { priceOffers: [], priceOfferStatus: 'missing-table' }, { priceOffers: [dto(unreviewed)] },
    { priceOffers: [{ status: 'quarantine', amount: '999999' }] }]) {
    const html = renderToStaticMarkup(createElement(ModelPlanCard, {
      plan: { ...promotionPlan, ...fields } as ModelPlanCardRow, locale, now,
    }));
    assert.equal(createHash('sha256').update(html).digest('hex'), expected);
    assert.match(html, /data-plan-limited-time-offer="active"/);
    assert.doesNotMatch(html, /data-original-offer-price/);
  }
});

test('both locales keep independent deployed promotion and reviewed regional original charge on one model card', () => {
  const original = structuredClone(promotionPlan);
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(ModelPlanCard, {
      plan: { ...promotionPlan, priceOffers: [dto()] }, locale, now,
    }));
    assert.match(html, /data-plan-limited-time-offer="active"/);
    assert.match(html, /\$77.*\$99/);
    assert.match(html, /data-original-offer-price="true">CNY 10\.00/);
    assert.equal((html.match(/data-plan-limited-time-offer=/g) ?? []).length, 1);
    assert.equal((html.match(/data-original-offer-price=/g) ?? []).length, 1);
    const regional = html.split('<section aria-label=')[1].split('</section>')[0];
    assert.doesNotMatch(regional, /data-plan-limited-time-offer|\$77|\$99|Lowest among comparable|可比报价中最低/);
    assert.ok(regional.includes(locale === 'zh' ? '常规价格' : 'Regular price'));
  }
  assert.deepEqual(promotionPlan, original);
});

test('real provider price block retains monthly/annual promotion and exact empty-offer fallback alongside regional display', async () => {
  // Actual route/price/mark components; read-only dependencies only. No DB, HTTP or Next server.
  const sample = { ...promotionPlan, annual_price: 770, regular_annual_price: 990,
    provider_id: 1, promo_ends_at: '2099-12-01T08:00:00Z', notes: null, monthly_message_limit: null };
  const o = syntheticOffer(); o.validity.endsAt = null; o.validity.openEnded = true;
  const unreviewed = syntheticOffer(); unreviewed.state = 'unverified';
  for (const locale of ['zh', 'en']) for (const yearly of [false, true]) {
    async function page(fields: Record<string, unknown>) {
      let reads = 0;
      const mod = loadQueryModule(new URL('../app/[locale]/providers/[slug]/catalog-page.tsx', import.meta.url), {
        '@/lib/db': { sql: async () => { throw new Error('unexpected DB read'); } },
        '@/lib/provider-plans-query': { getPlansByProvider: async (slug: string, options: { includePriceOffers?: boolean }) => {
          reads++; assert.equal(slug, 'synthetic-only'); assert.deepEqual({ ...options }, { includePriceOffers: true });
          return { provider: { id: 1, slug, name: 'SYNTHETIC FICTIONAL vendor', region: 'global' },
            plans: [{ ...sample, ...fields }], models: [], comparisons: [] };
        } },
        '@/lib/grouped-products': { getGroupedProducts: async () => [] },
        '@/components/provider-api-models': { ProviderApiModels: () => null },
        '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
        '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
        'next-intl/server': { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({
          locale, messages: locale === 'zh' ? zh : en, namespace: namespace as 'providerPage',
        }) },
        '@/components/SiteHeader': { default: () => null, __esModule: true },
      });
      const Page = mod.default as (props: { params: Promise<{ locale: string; slug: string }>;
        searchParams: Promise<{ period?: string }> }) => Promise<ReactElement>;
      const element = await Page({ params: Promise.resolve({ locale, slug: 'synthetic-only' }),
        searchParams: Promise.resolve({ period: yearly ? 'yearly' : undefined }) });
      assert.equal(reads, 1);
      const providerProps = {
        locale, messages: locale === 'zh' ? zh : en, timeZone: 'UTC', children: element,
      };
      return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
    }
    const legacy = await page({});
    for (const fields of [{ priceOffers: [] }, { priceOffers: null }, { priceOffers: [], priceOfferStatus: 'missing-table' },
      { priceOffers: [dto(unreviewed)] }, { priceOffers: [{ status: 'quarantine', price: 999999 }] }])
      assert.equal(await page(fields), legacy);
    assert.match(legacy, /data-plan-limited-time-offer="active"/);
    assert.doesNotMatch(legacy, /data-original-offer-price/);
    const html = await page({ priceOffers: [dto(o)] });
    const priceBlock = html.slice(html.indexOf('<div class="mb-4">')).split('</section>')[0];
    assert.match(priceBlock, /data-original-offer-price="true">CNY 10\.00/);
    const mark = html.split('data-plan-limited-time-offer="active"')[1].split('</div>')[0];
    assert.match(mark, yearly ? /\$770.*\$990/ : /\$77.*\$99/);
    assert.doesNotMatch(html, /Lowest among comparable|可比报价中最低/);
    assert.equal(sample.price, 77); assert.equal(sample.annual_price, 770);
  }
});
