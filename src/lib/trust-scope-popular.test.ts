import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { isTrustProviderSlug, isTrustPage, planPriceTrust, reviewedPlanSource, TOP_TRUST_PAGES, USAGE_ESTIMATE_REVIEWED_ON } from './data-trust';
import { loadQueryModule } from './test-helpers/query-module';

const NOW = '2026-11-18T00:00:00Z';
const sample = {
  id: 1, slug: 'arbitrary-pro', name: 'Arbitrary Pro', tier: 'pro', price: 10,
  annual_price: 100, price_unit: 'per_month', pricing_model: 'subscription', currency: 'USD',
  plan_kind: 'chat', features: [], notes: null, monthly_message_limit: null,
  last_verified: '2026-11-01T00:00:00Z', legacy_ends_on: null as string | null,
};
type Plan = Omit<typeof sample, 'last_verified' | 'notes' | 'tier' | 'legacy_ends_on'> & {
  last_verified?: string | null; notes?: string | null; tier: string | null;
  legacy_ends_on?: string | null;
  regular_price?: number; regular_annual_price?: number; promo_ends_at?: string;
};
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ period?: string }> };
let renderIndex = 0;

// Only data reads and unrelated async sections are stubbed. Card markup, trust
// assessment, prices, translations and promotion logic are the real route code.
async function render(locale: string, plan: Plan, providerSlug = 'openai', yearly = false) {
  const messages = locale === 'zh' ? zh : en;
  const mod = loadQueryModule(new URL('../app/[locale]/providers/[slug]/catalog-page.tsx', import.meta.url), {
    '@/lib/db': { sql: async () => { throw new Error('unexpected DB read'); } },
    '@/lib/provider-plans-query': { getPlansByProvider: async () => ({
      provider: { id: 1, slug: providerSlug, name: 'Fixture Vendor', region: 'global', pricing_url: 'https://example.test/pricing' },
      plans: [plan], models: [], comparisons: [],
    }) },
    '@/lib/grouped-products': { getGroupedProducts: async () => [] },
    '@/components/provider-api-models': { ProviderApiModels: () => null },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    'next-intl/server': { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale, messages, namespace: namespace as 'providerPage' }) },
    '@/components/SiteHeader': { default: () => null, __esModule: true },
  });
  const element = await (mod.default as (props: Props) => Promise<ReactElement>)({
    params: Promise.resolve({ locale, slug: providerSlug }),
    searchParams: Promise.resolve({ period: yearly ? 'yearly' : undefined }),
  });
  const providerProps = { locale, messages, timeZone: 'UTC', children: element };
  const html = renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
  const dir = process.env.TRUST_RENDER_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    const name = `${++renderIndex}-${locale}-${providerSlug}-${plan.slug}-${yearly ? 'year' : 'month'}-${new Date().toISOString().replaceAll(':', '-')}.html`;
    writeFileSync(join(dir, name), html);
  }
  const opening = html.match(new RegExp(`<div(?=[^>]*id="${plan.slug}")[^>]*>`));
  assert.ok(opening, 'real provider route must render the fixture card');
  const content = html.slice(opening.index);
  let depth = 0;
  let card = '';
  for (const tag of content.matchAll(/<\/?div\b[^>]*>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      card = content.slice(0, tag.index + tag[0].length);
      break;
    }
  }
  assert.ok(card, 'fixture card has balanced container markup');
  return { html, card };
}

function popular(card: string, expected: boolean, locale: string) {
  assert.equal(/>Popular<|>热门</.test(card), expected, 'Popular badge must agree with plan state');
  const opening = card.slice(0, card.indexOf('>') + 1);
  assert.equal(opening.includes('border-blue-500'), expected, 'recommendation border must agree with badge');
  if (expected) assert.match(card, locale === 'zh' ? />热门</ : />Popular</);
  if (locale === 'zh') assert.doesNotMatch(card, />Popular</);
}

test('sample scope is zh-only while retained English review labels remain honest', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  for (const locale of ['zh', 'en']) {
    const { html } = await render(locale, sample);
    if (locale === 'zh') {
      assert.match(html, /选定的 10 个详情页 PV 样本/);
      assert.match(html, /不代表全站排名或全部已获官方核验/);
      assert.match(html, /估算不是确定权益/);
    } else {
      assert.match(html, /data-trust-scope="legacy-selected-review"/);
      assert.match(html, /data-trust-label=/);
      assert.match(html, /outside this detail-page PV sample/);
      assert.match(html, /Historical records do not confirm current prices or entitlements/);
      assert.doesNotMatch(html, /data-trust-scope="pv-detail-sample|belongs to a selected ten-detail-page/);
    }
  }
});

test('the frozen exact-locale sample stays separate from retained display; method date stays fixed', () => {
  assert.deepEqual(TOP_TRUST_PAGES.map(p => p.path), [
    '/zh/compare/plans/deepseek-v4-pro', '/zh/providers/openai',
    '/zh/compare/plans/gemini-4-argon', '/zh/providers/moonshot-china',
    '/zh/providers/google', '/zh/providers/minimax-china',
    '/zh/compare/plans/deepseek-v4.1-flash', '/zh/providers/deepseek',
    '/zh/models/deepseek-v4.1-flash', '/zh/compare/plans/kimi-k3',
  ]);
  for (const page of TOP_TRUST_PAGES) {
    assert.equal(isTrustPage('zh', page.kind, page.slug), true);
    assert.equal(isTrustPage('en', page.kind, page.slug), false);
  }
  assert.equal(USAGE_ESTIMATE_REVIEWED_ON, '2026-10-18');
});

test('generic expired pro cards lose Popular and its border inside and outside selected scope', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  assert.equal(isTrustProviderSlug('fixture-unselected', 'zh'), false);
  for (const provider of ['openai', 'fixture-unselected']) for (const locale of ['zh', 'en']) {
    const { card } = await render(locale, { ...sample, legacy_ends_on: '2026-10-29' }, provider);
    popular(card, false, locale);
    if (provider === 'openai') {
      assert.match(card, /data-trust-expired="true"/);
      assert.match(card, locale === 'zh' ? /已过期/ : /Expired/);
      assert.match(card, /dateTime="2026-11-01"/);
    }
  }
});

test('legacy grace date is inclusive through the UTC day, with the same state in zh/en', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T23:59:59.999Z') });
  const plan = { ...sample, legacy_ends_on: '2026-10-29', last_verified: '2026-10-28' };
  for (const [instant, expired] of [
    ['2026-10-28T23:59:59.999Z', false], ['2026-10-29T00:00:00.000Z', false],
    ['2026-10-29T23:59:59.999Z', false], ['2026-10-30T00:00:00.000Z', true],
    ['2026-10-30T00:00:00.001Z', true],
  ] as const) {
    t.mock.timers.setTime(new Date(instant).getTime());
    for (const locale of ['zh', 'en']) {
      const { card } = await render(locale, plan);
      assert.match(card, new RegExp(`data-trust-expired="${expired}"`), instant);
      popular(card, !expired, locale);
    }
  }
});

test('valid pro, stale verification and unknown verification retain Popular; non-pro stays unchanged', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  const variants = [
    sample,
    { ...sample, slug: 'stale-pro', last_verified: '2026-09-01' },
    { ...sample, slug: 'unknown-pro', last_verified: null, notes: '[needs-verification] unknown' },
    { ...sample, slug: 'invalid-verification', last_verified: 'invalid' },
    { ...sample, slug: 'free', tier: 'free', price: 0 },
    { ...sample, slug: 'team', tier: 'team' },
    { ...sample, slug: 'unknown-tier', tier: null },
    { ...sample, slug: 'expired-team', tier: 'team', legacy_ends_on: '2026-10-29' },
  ];
  for (const plan of variants) for (const locale of ['zh', 'en']) {
    const before = structuredClone(plan);
    const { card } = await render(locale, plan);
    popular(card, plan.tier === 'pro', locale);
    if (plan.slug === 'stale-pro') assert.match(card, /data-trust-stale="true"/);
    if (['unknown-pro', 'invalid-verification'].includes(plan.slug)) assert.match(card, /data-trust-unverified="true"/);
    if (plan.slug !== 'expired-team') assert.match(card, /data-trust-expired="false"/);
    assert.deepEqual(plan, before);
  }
});

test('missing and malformed legacy metadata keep existing trust parsing semantics', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  for (const legacy of [undefined, null, '', 'not-a-date', '2026-99-99', '2026-02-30', '2026-10-29T23:00:00Z']) {
    const plan = { ...sample, legacy_ends_on: legacy };
    const expected = planPriceTrust(plan, reviewedPlanSource('openai', 'en'), 'en', new Date(NOW)).flags.expired;
    // Existing parser accepts date-shaped prefixes without calendar validation.
    assert.equal(expected, legacy === '2026-02-30' || legacy === '2026-10-29T23:00:00Z');
    for (const locale of ['zh', 'en']) {
      const { card } = await render(locale, plan);
      popular(card, !expected, locale);
      assert.match(card, new RegExp(`data-trust-expired="${expected}"`));
    }
  }
});

test('a temporary promotion ending leaves an active pro plan Popular and its stored monthly/yearly prices intact', async t => {
  const cutoff = '2026-11-18T00:00:00Z';
  t.mock.timers.enable({ apis: ['Date'], now: new Date(cutoff).getTime() - 1 });
  const plan = { ...sample, regular_price: 20, regular_annual_price: 200, promo_ends_at: cutoff };
  const original = structuredClone(plan);
  for (const instant of [new Date(cutoff).getTime() - 1, new Date(cutoff).getTime(), new Date(cutoff).getTime() + 1]) {
    t.mock.timers.setTime(instant);
    for (const locale of ['zh', 'en']) for (const yearly of [false, true]) {
      const { card } = await render(locale, plan, 'openai', yearly);
      popular(card, true, locale);
      assert.match(card, /data-trust-expired="false"/);
      assert.equal(card.includes('data-plan-limited-time-offer="active"'), instant < new Date(cutoff).getTime());
      assert.match(card, yearly ? /\$100\.00/ : /\$10\.00/);
      assert.match(card, yearly ? (locale === 'zh' ? /\/年/ : /\/year</) : (locale === 'zh' ? /\/月/ : /\/mo</));
      assert.deepEqual(plan, original);
    }
  }
});
