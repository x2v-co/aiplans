import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Metadata } from 'next';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { NextRequest } from 'next/server';
import { createProxy } from '@/proxy';
import { loadQueryModule } from './test-helpers/query-module';
import { STATIC_PATHS } from './sitemap-static-paths';
import { planHasLimitedTimeOffer } from './plan-limited-time-offer';

const active = { id: 11, provider_id: 1, pricing_model: 'subscription', price: 10,
  regular_price: 20, price_unit: 'per_month', promo_ends_at: '2099-12-01T08:00:00Z' };
const providers = [{ id: 1, slug: 'fixture-offer', name: 'Fixture Offer Vendor', planCount: 3 },
  { id: 2, slug: 'fixture-plain', name: 'Fixture Plain Vendor', planCount: 2 }];
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ promo?: string; kind?: string }> };
function route(offerRows = [active]) {
  return loadQueryModule(new URL('../app/[locale]/plans/catalog-page.tsx', import.meta.url), {
    '@/lib/db': { sql: async (strings: TemplateStringsArray) => strings.join('?').includes('COUNT(pl.id)') ? providers : [] },
    '@/lib/plan-offers-query': { getActivePlanOffers: async () => offerRows.filter(row => planHasLimitedTimeOffer(row)) },
    '@/lib/pricing-seo-data': { getPlansSeoProviders: async () => providers },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    '@/components/SiteHeader': { default: () => null, __esModule: true },
  });
}
async function html(locale: string, promo?: string, kind?: string, offers = [active]) {
  const mod = route(offers);
  const props: Props = { params: Promise.resolve({ locale }), searchParams: Promise.resolve({ promo, kind }) };
  const element = await (mod.default as (props: Props) => Promise<ReactElement>)(props);
  return renderToStaticMarkup(element);
}

test('real plans route SSR filters providers/counts, preserves kind, handles empty/expired data in both languages', async () => {
  for (const locale of ['zh', 'en']) {
    const filtered = await html(locale, '1', 'gateway_subscription');
    assert.match(filtered, /Fixture Offer Vendor/);
    assert.doesNotMatch(filtered, /Fixture Plain Vendor/);
    assert.match(filtered, locale === 'zh' ? /1 个套餐/ : /1 plans/);
    assert.match(filtered, new RegExp(`href="/${locale}/plans\\?kind=gateway_subscription"`));
    assert.match(filtered, /aria-pressed="true"/);
    assert.doesNotMatch(filtered, /<script[^>]*src=|coupon|优惠码/i);
    const plain = await html(locale);
    assert.match(plain, /Fixture Offer Vendor/);
    assert.match(plain, /Fixture Plain Vendor/);
    assert.match(plain, /promo=1/);
    assert.match(plain, /aria-pressed="false"/);
    for (const rows of [[], [{ ...active, promo_ends_at: '2000-01-01T00:00:00Z' }]]) {
      const empty = await html(locale, '1', undefined, rows);
      assert.doesNotMatch(empty, /Fixture Offer Vendor|Fixture Plain Vendor/);
      assert.match(empty, locale === 'zh' ? /暂无有效的限时优惠套餐/ : /No active limited-time plan offers/);
    }
  }
});

test('real metadata and proxy protect filtered SEO, canonical stays on plans, sitemap has no filter URL', async () => {
  for (const locale of ['zh', 'en']) {
    const props: Props = { params: Promise.resolve({ locale }), searchParams: Promise.resolve({ promo: '1' }) };
    const meta = await (route().generateMetadata as (props: Props) => Promise<Metadata>)(props);
    assert.equal((meta.robots as { index: boolean }).index, false);
    assert.equal(meta.alternates?.canonical, `https://aiplans.dev/${locale}/plans`);
    const plain = await (route().generateMetadata as (props: Props) => Promise<Metadata>)({ ...props, searchParams: Promise.resolve({}) });
    assert.notEqual((plain.robots as { index?: boolean } | undefined)?.index, false);
    const proxy = createProxy(async () => { throw new Error('ordinary list must not load redirect DB'); });
    const response = await proxy(new NextRequest(`https://aiplans.dev/${locale}/plans?promo=1&kind=gateway_subscription`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-middleware-rewrite'), `https://aiplans.dev/${locale}/filtered/plans?promo=1&kind=gateway_subscription`);
    const redirect = await proxy(new NextRequest(`https://aiplans.dev/${locale}/filtered/plans?promo=1`));
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get('location'), `https://aiplans.dev/${locale}/plans?promo=1`);
  }
  for (const entry of STATIC_PATHS) assert.doesNotMatch(entry.path, /\?|filtered|promotions/);
});

test('HTTP response carries route-generated SSR without JS and removes expired offers', async t => {
  // In-process HTTP harness of the real catalog view with DB reads stubbed.
  // This is not a Next integration server or a browser/visual test.
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://localhost');
      const locale = url.pathname.split('/')[1];
      const body = await html(locale, url.searchParams.get('promo') ?? undefined,
        undefined, url.searchParams.has('expired') ? [{ ...active, promo_ends_at: '2000-01-01' }] : [active]);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') {
      t.skip('HTTP NOT VERIFIED: sandbox prohibits localhost listen; run in normal shell. See preserved route-diagnostic.log.');
      return;
    }
    throw error;
  }
  try {
    const address = server.address() as { port: number };
    for (const locale of ['zh', 'en']) {
      const url = `http://127.0.0.1:${address.port}/${locale}/plans?promo=1`;
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type')!, /text\/html/);
      const body = await response.text();
      assert.match(body, /Fixture Offer Vendor/);
      assert.doesNotMatch(body, /Fixture Plain Vendor/);
      assert.match(body, locale === 'zh' ? /只看限时优惠/ : /Limited-time offers only/);
      const expired = await fetch(`${url}&expired=1`);
      assert.equal(expired.status, 200);
      assert.doesNotMatch(await expired.text(), /Fixture Offer Vendor/);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});


test('real provider plan details SSR shows the correct monthly/annual offer and hides expired metadata', async () => {
  for (const locale of ['zh', 'en']) for (const yearly of [false, true]) for (const expired of [false, true]) {
    const sample = { ...active, slug: 'fixture-subscription', name: 'Fixture Subscription', tier: 'pro',
      annual_price: 100, regular_annual_price: 200, plan_kind: 'chat', currency: 'USD', features: [], notes: null,
      monthly_message_limit: null, promo_ends_at: expired ? '2000-01-01T00:00:00Z' : active.promo_ends_at };
    const mod = loadQueryModule(new URL('../app/[locale]/providers/[slug]/catalog-page.tsx', import.meta.url), {
      '@/lib/db': { sql: async () => { throw new Error('unexpected DB read in SSR fixture'); } },
      '@/lib/provider-plans-query': { getPlansByProvider: async () => ({
        provider: { id: 1, slug: 'fixture-vendor', name: 'Fixture Vendor', region: 'global' },
        plans: [sample], models: [], comparisons: [],
      }) },
      '@/lib/grouped-products': { getGroupedProducts: async () => [] },
      // Async API section has separate coverage; this fixture exercises plan details.
      '@/components/provider-api-models': { ProviderApiModels: () => null },
      '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
      '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
      'next-intl/server': { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale, messages: locale === 'zh' ? zh : en, namespace: namespace as 'providerPage' }) },
      '@/components/SiteHeader': { default: () => null, __esModule: true },
    });
    const Page = mod.default as (props: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ period?: string }> }) => Promise<ReactElement>;
    const element = await Page({ params: Promise.resolve({ locale, slug: 'fixture-vendor' }), searchParams: Promise.resolve({ period: yearly ? 'yearly' : undefined }) });
    const providerProps = { locale, messages: locale === 'zh' ? zh : en, timeZone: 'UTC', children: element };
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
    assert.match(html, /id="fixture-subscription"/);
    if (expired) assert.doesNotMatch(html, /data-plan-limited-time-offer/);
    else {
      const mark = html.split('data-plan-limited-time-offer="active"')[1].split('</div>')[0];
      assert.match(mark, yearly ? /\$100.*\$200/ : /\$10.*\$20/);
      assert.match(mark, locale === 'zh' ? /限时优惠/ : /Limited-time offer/);
      assert.match(mark, yearly ? (locale === 'zh' ? /年/ : /year/) : (locale === 'zh' ? /月/ : /month/));
    }
    // Expiry never rewrites the plan headline or underlying price.
    assert.equal(sample.price, 10);
    assert.equal(sample.annual_price, 100);
  }
});
