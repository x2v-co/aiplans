import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as projection from './api-pricing-catalog';
import * as validation from './api-pricing-query';
import { createPublicSnapshot } from './api-pricing-snapshot';
import { catalogPage, channelPage, variantPage } from './api-pricing-catalog';
import { catalogQueryParams, parseCatalogRequest } from './api-pricing-query';
import type { ChannelPrice, GroupedProduct } from './grouped-products';

const now = new Date('2026-11-25T10:00:00Z');
const query = (value = '') => parseCatalogRequest(new URLSearchParams(value)).query;
const provider = { id: 1, name: 'Fixture CN', slug: 'fixture-cn', type: 'official', region: 'china', access_from_china: null,
  supported_regions: ['CN'], regions_source_url: 'https://example.test/regions', regions_verified_at: '2026-11-20',
  pricing_url: 'https://example.test/prices' };
const channel = (id: number, slug: string, extra: Partial<ChannelPrice> = {}): ChannelPrice => ({
  id, model_id: id, provider_id: 1, model_slug: slug, input_price_per_1m: 1, output_price_per_1m: 2,
  cached_input_price_per_1m: 0.2, currency: 'USD', price_unit: 'per_1m_tokens', providers: provider, ...extra,
});
const product = (slug: string, extra: Partial<GroupedProduct> = {}): GroupedProduct => ({
  id: 1, name: slug, slug, baseName: slug, provider_ids: [1], context_window: 1000, benchmarks: [],
  benchmark_arena_elo: 1, released_at: null, created_at: null, versions: [channel(1, slug)],
  providers: { ...provider, logo: '' }, hasChinaVersion: true, hasGlobalVersion: false, versionCounts: 1, memberSlugs: [slug], ...extra,
});

function route(loadProducts: () => Promise<GroupedProduct[]>, loadCoupons: () => Promise<Record<string, import('./coupon-format').CouponOffer[]>> = async () => ({})) {
  const dependencies: Record<string, unknown> = {
    '@/lib/pricing-seo-data': { getApiPricingSeoData: async () => ({ products: await loadProducts() }) },
    '@/lib/coupons': { getActiveCouponMap: loadCoupons },
    '@/lib/api-pricing-catalog': projection,
    '@/lib/api-pricing-query': validation,
    '@/lib/api-pricing-snapshot': { createPublicSnapshot },
  };
  const source = readFileSync(new URL('../app/api/pricing/catalog/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod: Record<string, unknown> = {};
  // Only the existing backend services are doubled. Route and snapshot dependency run unchanged.
  runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URL, Response, TextEncoder })((id: string) => {
    assert.ok(Object.hasOwn(dependencies, id), id); return dependencies[id];
  }, mod);
  const GET = mod.GET as (req: Request) => Promise<Response>;
  return (params = '') => GET(new Request(`http://local/api?${params}`));
}

test('selection uses existing membership, Arena and stable slug ties, independently of input order', () => {
  const products = [product('unselected', { benchmark_arena_elo: 900 }), product('gpt-5'), product('glm-5.3'), product('deepseek-r1')];
  const expected = ['deepseek-r1', 'glm-5.3', 'gpt-5', 'unselected'];
  assert.deepEqual(catalogPage(products, query(), now).rows.map(p => p.slug), expected);
  assert.deepEqual(catalogPage([...products].reverse(), query(), now).rows.map(p => p.slug), expected);
  assert.deepEqual(products.map(p => p.slug), ['unselected', 'gpt-5', 'glm-5.3', 'deepseek-r1']);
});

test('all groups remain searchable, filterable and pageable beyond the first 50 with no duplicates', () => {
  const products = Array.from({ length: 137 }, (_, i) => product(`fixture-${String(i).padStart(3, '0')}`));
  const seen: string[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = catalogPage(products, { ...query(), offset }, now);
    assert.ok(page.rows.length <= 50);
    seen.push(...page.rows.map(p => p.slug)); offset = page.nextOffset;
  }
  assert.equal(seen.length, 137); assert.equal(new Set(seen).size, 137);
  assert.equal(catalogPage(products, query('q=fixture-136'), now).rows[0].slug, 'fixture-136');
  assert.equal(catalogPage(products, query('q=missing'), now).total, 0);
  assert.equal(catalogPage(products, query('region=global'), now).total, 0);
  assert.equal(catalogPage(products, query('channel=official&region=china&locale=zh&china=1'), now).total, 137);
  const unknown = product('unknown', { providers: undefined, versions: [channel(1, 'unknown', { providers: { ...provider, supported_regions: null, regions_source_url: null } })] });
  assert.equal(catalogPage([unknown], query('locale=zh&china=1'), now).total, 0);
  assert.equal(catalogPage([unknown], query('locale=en&china=1'), now).total, 1);
});

test('member search retains thinking/free/preview/instruct identities; base quote excludes cheap sibling mini/batch prices', () => {
  const base = product('gpt-5', { memberSlugs: ['gpt-5', 'gpt-5-mini-batch'], versions: [channel(1, 'gpt-5'), channel(2, 'gpt-5-mini-batch', { input_price_per_1m: 0, variant: ['mini', 'batch'] })] });
  const products = [base, ...['kimi-thinking', 'kimi-free', 'kimi-preview', 'kimi-instruct'].map(slug => product(slug))];
  assert.equal(catalogPage(products, query('q=gpt-5-mini-batch'), now).rows[0].quote?.model_slug, 'gpt-5');
  assert.equal(catalogPage(products, query(), now).rows.find(p => p.slug === 'gpt-5')?.quote?.input_price_per_1m, 1);
  for (const slug of ['kimi-thinking', 'kimi-free', 'kimi-preview', 'kimi-instruct']) assert.equal(catalogPage(products, query(`q=${slug}`), now).rows[0].slug, slug);
  const channels = channelPage(products, 'gpt-5', 0, now)!;
  assert.equal(channels.rows[1].model_slug, 'gpt-5-mini-batch');
  assert.deepEqual(channels.rows[1].variant, ['mini', 'batch']);
  assert.equal(channels.rows[1].input_price_per_1m, 0);
});

test('zero, currencies and token units sort correctly; non-token rates do not become token minima', () => {
  const products = [product('usd'), product('cny', { versions: [channel(1, 'cny', { currency: 'CNY', input_price_per_1m: 3 })] }),
    product('free', { versions: [channel(1, 'free', { input_price_per_1m: 0 })] }),
    product('per-k', { versions: [channel(1, 'per-k', { input_price_per_1m: 0.002, price_unit: 'per_1k_tokens' })] }),
    product('request', { versions: [channel(1, 'request', { input_price_per_1m: 0.0001, price_unit: 'per_request' })] })];
  const rows = catalogPage(products, query('sort=price&order=asc'), now).rows;
  assert.deepEqual(rows.map(p => p.slug), ['free', 'cny', 'usd', 'per-k', 'request']);
  assert.equal(rows[1].quote?.currency, 'CNY'); assert.equal(rows[3].quote?.price_unit, 'per_1k_tokens');
  assert.equal(catalogPage(products, query('sort=price&order=desc'), now).rows.at(-1)?.slug, 'request');
});

test('cutoff, cache, native currency, training, quota, retirement, verification and safe provider links survive projection', () => {
  const cp = channel(1, 'promo', { promo_ends_at: now.toISOString(), regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 8, regular_cached_input_price_per_1m: 0.8, currency: 'CNY',
    data_for_discount: true, data_for_discount_note: 'fixture disclosure', quota_unit: 'credits',
    member_shutdown_date: '2026-12-20', notes: '[needs-verification] fixture only' });
  const products = [product('promo', { versions: [cp] })];
  assert.equal(catalogPage(products, query('promo=1'), new Date(now.getTime() - 1)).total, 1);
  assert.equal(catalogPage(products, query('promo=1'), now).total, 0);
  const row = channelPage(products, 'promo', 0, now)!.rows[0];
  assert.equal(row.input_price_per_1m, 4); assert.equal(row.cached_input_price_per_1m, 0.8);
  for (const key of ['currency', 'data_for_discount', 'data_for_discount_note', 'quota_unit', 'member_shutdown_date', 'notes'] as const) assert.equal(row[key], cp[key]);
  assert.equal(row.providers.href, 'https://example.test/prices'); assert.equal(row.providers.china, true);
  const unsafe = product('unsafe', { versions: [channel(2, 'unsafe', { providers: { ...provider, pricing_url: 'javascript:alert(1)' } })] });
  assert.equal(channelPage([unsafe], 'unsafe', 0, now)!.rows[0].providers.href, null);
});

test('channel/variant pages are bounded, lossless across pages, scoped to exact group and channel, and preserve variant units/cache/windows', () => {
  const variants = Array.from({ length: 31 }, (_, i) => ({ id: i + 1, variant_key: `key-${i}`, variant_name: `variant-${i}`,
    variant_kind: i === 0 ? 'time_window' : 'default_route', input_price_per_1m: 0.01, output_price_per_1m: 0.02,
    cached_input_price_per_1m: 0, currency: 'CNY' as const, price_unit: 'per_1k_tokens' as const, is_headline: i === 1,
    constraints_json: { time_window: 'off-peak', peak_schedule: 'fixture schedule', raw_endpoint_metadata: 'large' } }));
  const products = [product('many', { versions: Array.from({ length: 19 }, (_, i) => channel(i + 1, 'many', { price_variants: variants })) })];
  assert.equal(channelPage(products, 'many', 0, now)!.rows.length, 8);
  assert.equal(channelPage(products, 'many', 16, now)!.rows.length, 3);
  assert.equal(channelPage(products, 'many', 16, now)!.nextOffset, null);
  assert.equal(channelPage(products, 'other', 0, now), null);
  assert.equal(variantPage(products, 'many', 999, 0, now), null);
  const pages = [0, 12, 24].map(offset => variantPage(products, 'many', 1, offset, now)!);
  assert.deepEqual(pages.map(p => p.rows.length), [12, 12, 7]);
  assert.equal(new Set(pages.flatMap(p => p.rows.map(v => v.id))).size, 31);
  assert.equal(pages[0].rows[0].cached_input_price_per_1m, 0);
  assert.equal(pages[0].rows[0].price_unit, 'per_1k_tokens');
  assert.deepEqual(pages[0].rows[0].constraints_json, { time_window: 'off-peak', peak_schedule: 'fixture schedule' });
  assert.ok(!JSON.stringify(channelPage(products, 'many', 0, now)).includes('variant-0'));
});

test('strict validation rejects malformed, duplicate, oversized and arbitrary requests, roundtrips supported filters', () => {
  for (const input of ['limit=99999', 'offset=-1', 'offset=100001', 'offset=1e3', 'q=a&q=b', `q=${'a'.repeat(129)}`,
    'sort=sql', 'region=elsewhere', 'locale=xx', 'china=true', 'mode=channels', 'mode=channels&slug=a/b',
    'mode=variants&slug=a&channelId=1%20OR%201=1', 'slug=a', 'url=https://example.test', 'q=%00']) {
    assert.throws(() => parseCatalogRequest(new URLSearchParams(input)), input);
  }
  const q = query('q=deepseek&sort=context&order=asc&locale=zh&china=1&promo=1&offset=50&channel=official&region=china');
  assert.deepEqual(query(catalogQueryParams(q).toString()), q);
});

test('endpoint validates before reading; caps bytes; reports missing entries and read failure without leaking errors', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  let reads = 0, failure = false, products = [product('fixture')];
  const GET = route(async () => { reads++; if (failure) throw Error('secret DB details'); return products; },
    async () => ({ 'fixture-cn': [], unrelated: [] }));
  assert.equal((await GET('limit=999')).status, 400); assert.equal(reads, 0);
  let response = await GET();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.deepEqual(Object.keys((await response.json()).couponByProvider), ['fixture-cn']);
  assert.equal((await GET('mode=channels&slug=missing')).status, 404);
  t.mock.timers.tick(30_000); failure = true;
  response = await GET(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /secret/);
  t.mock.timers.tick(1_000); failure = false; products = [product('oversized', { name: 'x'.repeat(130_000) })];
  response = await GET(); assert.equal(response.status, 503); assert.ok((await response.text()).length < 200);
});

// The demonstrated independent-existence failure: neither channel satisfies both controls.
test('channel controls conjoin on one actual channel, including promo and sourced China; producer metadata cannot satisfy them', () => {
  const official = channel(1, 'mixed', { input_price_per_1m: 5, providers: { ...provider, region: 'global', supported_regions: null } });
  const reseller = channel(2, 'mixed', { input_price_per_1m: 1, providers: { ...provider, type: 'reseller' } });
  const mixed = product('mixed', { versions: [official, reseller] });
  assert.equal(catalogPage([mixed], query('channel=official&region=china'), now).total, 0);
  assert.equal(catalogPage([mixed], query('channel=official&locale=zh&china=1'), now).total, 0);
  assert.equal(catalogPage([mixed], query('channel=official'), now).rows[0].quote?.id, 1);
  assert.equal(catalogPage([mixed], query('region=china'), now).rows[0].quote?.id, 2);
  assert.equal(catalogPage([product('producer-only', { versions: [] })], query('region=china'), now).total, 0);
  assert.equal(catalogPage([product('producer-only', { versions: [] })], query(), now).rows[0].quote, null);
  const promo = { ...reseller, promo_ends_at: '2026-11-26T00:00:00Z', regular_input_price_per_1m: 10 };
  const products = [{ ...mixed, versions: [official, promo] }];
  assert.equal(catalogPage(products, query('promo=1&channel=official'), now).total, 0);
  const row = catalogPage(products, query('promo=1'), now).rows[0];
  assert.equal(row.quote?.id, 2); assert.equal(row.channelCount, 1);
  assert.deepEqual(channelPage(products, 'mixed', 0, now, query('promo=1'))!.rows.map(cp => cp.id), [2]);
  assert.equal(variantPage(products, 'mixed', 1, 0, now, query('promo=1')), null);
});

test('matching siblings retain availability without canonical quotes; eligible exact quotes also establish price order at expiry', () => {
  const promo = { promo_ends_at: '2026-11-25T10:00:01Z', regular_input_price_per_1m: 9 };
  const sibling = product('family', { versions: [channel(1, 'family'),
    ...['family-mini-batch', 'family-2026-11-20'].map((slug, i) => channel(i + 2, slug, { ...promo, input_price_per_1m: 0, variant: i ? [] : ['mini', 'batch'] }))] });
  assert.equal(catalogPage([sibling], query('promo=1'), now).rows[0].quote, null);
  assert.equal(catalogPage([sibling], query('promo=1'), now).rows[0].channelCount, 2);
  const products = [sibling, product('priced', { versions: [channel(4, 'priced', { ...promo, input_price_per_1m: 3 })] })];
  for (const order of ['asc', 'desc']) assert.equal(catalogPage(products, query(`promo=1&sort=price&order=${order}`), now).rows.at(-1)?.slug, 'family');
  const competing = product('competing', { versions: [channel(5, 'competing', { ...promo, input_price_per_1m: 0.1 }), channel(6, 'competing', { input_price_per_1m: 2 })] });
  assert.equal(catalogPage([competing], query(), now).rows[0].quote?.id, 5);
  assert.equal(catalogPage([competing], query(), new Date(promo.promo_ends_at)).rows[0].quote?.id, 6);
  const a = product('a', { versions: [channel(7, 'a', { input_price_per_1m: 50 }), channel(8, 'a', { input_price_per_1m: 0, providers: { ...provider, type: 'reseller' } })] });
  assert.deepEqual(catalogPage([a, product('b')], query('channel=official&sort=price&order=asc'), now).rows.map(p => p.slug), ['b', 'a']);
});

test('real route snapshot dependency coalesces 16 concurrent expansions and arbitrary queries; unknown variants share catalog and skip coupons', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  let catalogLoads = 0, couponLoads = 0;
  let release!: (products: GroupedProduct[]) => void;
  const gate = new Promise<GroupedProduct[]>(resolve => { release = resolve; });
  const GET = route(async () => { catalogLoads++; return gate; }, async () => { couponLoads++; return {}; });
  const pending = Array.from({ length: 16 }, () => GET('mode=channels&slug=fixture'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, 0);
  release([product('fixture')]);
  assert.ok((await Promise.all(pending)).every(r => r.status === 200));
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, 1);
  for (let i = 0; i < 60; i++) assert.equal((await GET(`q=query-${i}&offset=${i}&locale=${i % 2 ? 'en' : 'zh'}`)).status, 200);
  assert.equal((await GET('mode=variants&slug=missing&channelId=99')).status, 404);
  assert.equal((await GET('mode=variants&slug=fixture&channelId=99')).status, 404);
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, 1);
  t.mock.timers.tick(30_000);
  const refreshed = await Promise.all(Array.from({ length: 16 }, () => GET('mode=channels&slug=fixture')));
  assert.ok(refreshed.every(r => r.status === 200));
  assert.equal(catalogLoads, 2); assert.equal(couponLoads, 2);
  let coldCoupons = 0;
  const unknown = route(async () => [product('fixture')], async () => { coldCoupons++; return {}; });
  assert.equal((await unknown('mode=variants&slug=missing&channelId=99')).status, 404); assert.equal(coldCoupons, 0);
});

test('warm cached schedules and coupons expire at the request cutoff without another backend load', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  let catalogLoads = 0, couponLoads = 0;
  const cutoff = new Date(now.getTime() + 1000).toISOString();
  const scheduled = product('fixture', { versions: [channel(1, 'fixture', { input_price_per_1m: 0.1, promo_ends_at: cutoff,
    regular_input_price_per_1m: 9, regular_output_price_per_1m: 18, regular_cached_input_price_per_1m: 1,
    price_variants: [{ id: 1, variant_key: 'default', variant_name: 'Default', variant_kind: 'default_route', is_headline: true,
      input_price_per_1m: 0.1, output_price_per_1m: 2, currency: 'USD', price_unit: 'per_1m_tokens' }] }), channel(2, 'fixture', { input_price_per_1m: 2 })] });
  const GET = route(async () => { catalogLoads++; return [scheduled]; }, async () => { couponLoads++; return { 'fixture-cn': [
    { id: 1, code: 'PUBLIC', providerId: 1, providerSlug: 'fixture-cn', description: '', discountType: 'percentage', discountValue: 10, expiresAt: cutoff, offerUrl: null, scope: 'api' },
    { id: 2, code: 'NO-EXPIRY', providerId: 1, providerSlug: 'fixture-cn', description: '', discountType: 'percentage', discountValue: 5, expiresAt: null, offerUrl: null, scope: 'api' },
  ] }; });
  let body = await (await GET('promo=1')).json();
  assert.equal(body.page.rows[0].quote.id, 1); assert.equal(body.couponByProvider['fixture-cn'].length, 2);
  t.mock.timers.tick(1000);
  body = await (await GET('promo=1')).json(); assert.equal(body.page.total, 0);
  body = await (await GET()).json(); assert.equal(body.page.rows[0].quote.id, 2); assert.equal(body.couponByProvider['fixture-cn'].length, 1);
  body = await (await GET('mode=channels&slug=fixture')).json(); assert.equal(body.page.rows[0].input_price_per_1m, 9);
  body = await (await GET('mode=variants&slug=fixture&channelId=1')).json(); assert.equal(body.page.rows[0].input_price_per_1m, 9);
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, 1);
});

for (const failedSlot of ['catalog', 'coupons']) test(`route ${failedSlot} failures coalesce, cool down, retry, and refuse expired stale data`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  let catalogLoads = 0, couponLoads = 0, failing = true;
  const GET = route(async () => { catalogLoads++; if (failing && failedSlot === 'catalog') throw Error('private'); return [product('fixture')]; },
    async () => { couponLoads++; if (failing && failedSlot === 'coupons') throw Error('private'); return {}; });
  const batch = () => Promise.all(Array.from({ length: 16 }, () => GET('mode=channels&slug=fixture')));
  assert.ok((await batch()).every(r => r.status === 503));
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, failedSlot === 'catalog' ? 0 : 1);
  assert.ok((await batch()).every(r => r.status === 503));
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, failedSlot === 'catalog' ? 0 : 1);
  failing = false; t.mock.timers.tick(1000);
  assert.ok((await batch()).every(r => r.status === 200));
  assert.equal(catalogLoads, failedSlot === 'catalog' ? 2 : 1); assert.equal(couponLoads, failedSlot === 'coupons' ? 2 : 1);
  failing = true; t.mock.timers.tick(30_000);
  assert.ok((await batch()).every(r => r.status === 503));
});

for (const oversized of ['catalog', 'coupons']) test(`real route enforces the ${oversized} snapshot admission cap and recovers without retaining oversize data`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  let catalogLoads = 0, couponLoads = 0, large = true;
  const GET = route(async () => { catalogLoads++; return [product('fixture', { name: large && oversized === 'catalog' ? 'x'.repeat(8 * 1024 * 1024) : 'fixture' })]; }, async () => {
    couponLoads++;
    return { 'fixture-cn': [{ id: 1, code: 'PUBLIC', providerId: 1, providerSlug: 'fixture-cn',
      description: large && oversized === 'coupons' ? 'x'.repeat(512 * 1024) : '', discountType: 'percentage', discountValue: 10,
      expiresAt: null, offerUrl: null, scope: 'api' }] };
  });
  const responses = await Promise.all(Array.from({ length: 16 }, () => GET()));
  assert.ok(responses.every(r => r.status === 503));
  assert.ok((await responses[0].text()).length < 200);
  assert.equal(catalogLoads, 1); assert.equal(couponLoads, oversized === 'catalog' ? 0 : 1);
  large = false;
  assert.equal((await GET()).status, 503); assert.equal(catalogLoads, 1);
  t.mock.timers.tick(1000);
  assert.equal((await GET()).status, 200);
  assert.equal(catalogLoads, oversized === 'catalog' ? 2 : 1); assert.equal(couponLoads, oversized === 'coupons' ? 2 : 1);
});

test('combined eligibility agrees between route list/channel/variant pages and rejects invalid inputs before both backend services', async () => {
  let reads = 0, coupons = 0;
  const products = [product('mixed', { versions: [channel(1, 'mixed', { input_price_per_1m: 5, providers: { ...provider, region: 'global', supported_regions: null } }),
    channel(2, 'mixed', { input_price_per_1m: 1, providers: { ...provider, type: 'reseller' } })] })];
  const GET = route(async () => { reads++; return products; }, async () => { coupons++; return {}; });
  for (const invalid of ['mode=channels', 'q=a&q=b', 'channel=unknown', 'offset=-1', 'limit=1', 'mode=variants&slug=mixed&channelId=0']) {
    assert.equal((await GET(invalid)).status, 400);
  }
  assert.equal(reads, 0); assert.equal(coupons, 0);
  const params = 'channel=official&region=china';
  assert.equal((await (await GET(params)).json()).page.total, 0);
  assert.equal((await (await GET(`${params}&mode=channels&slug=mixed`)).json()).page.total, 0);
  assert.equal((await GET(`${params}&mode=variants&slug=mixed&channelId=1`)).status, 404);
  const body = await (await GET('channel=official')).json();
  assert.deepEqual(body.page, JSON.parse(JSON.stringify(catalogPage(products, query('channel=official'), new Date()))));
  assert.equal(body.page.rows[0].quote.id, 1);
});

test('coupon in-flight work is shared and both expiry clocks are resolved after delayed backend reads', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  const cutoff = new Date(now.getTime() + 1000).toISOString();
  let couponLoads = 0, release!: (value: Record<string, import('./coupon-format').CouponOffer[]>) => void;
  const gate = new Promise<Record<string, import('./coupon-format').CouponOffer[]>>(resolve => { release = resolve; });
  const GET = route(async () => [product('fixture', { versions: [channel(1, 'fixture', { input_price_per_1m: 0.1,
    promo_ends_at: cutoff, regular_input_price_per_1m: 9 })] })], async () => { couponLoads++; return gate; });
  const pending = Array.from({ length: 16 }, () => GET());
  await new Promise(resolve => setImmediate(resolve)); assert.equal(couponLoads, 1);
  t.mock.timers.tick(1000);
  release({ 'fixture-cn': [{ id: 1, code: 'PUBLIC', providerId: 1, providerSlug: 'fixture-cn', description: '',
    discountType: 'percentage', discountValue: 10, expiresAt: cutoff, offerUrl: null, scope: 'api' }] });
  const bodies = await Promise.all((await Promise.all(pending)).map(response => response.json()));
  assert.ok(bodies.every(body => body.page.rows[0].quote.input_price_per_1m === 9 && body.couponByProvider['fixture-cn'].length === 0));
});

for (const slowSlot of ['catalog', 'coupons']) test(`real route ${slowSlot} deadline returns safe 503, retains one backend operation and cleans up late settlement`, async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  let catalogLoads = 0, couponLoads = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const GET = route(async () => { catalogLoads++; if (slowSlot === 'catalog') await gate; return [product('fixture')]; },
    async () => { couponLoads++; if (slowSlot === 'coupons') await gate; return {}; });
  const pending = Promise.all(Array.from({ length: 16 }, () => GET()));
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(30_000);
  const expired = await pending; assert.ok(expired.every(response => response.status === 503));
  assert.ok((await expired[0].text()).length < 200);
  assert.ok((await Promise.all(Array.from({ length: 16 }, () => GET()))).every(response => response.status === 503));
  assert.equal(slowSlot === 'catalog' ? catalogLoads : couponLoads, 1);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await GET()).status, 503);
  t.mock.timers.tick(1000);
  assert.equal((await GET()).status, 200);
  assert.equal(slowSlot === 'catalog' ? catalogLoads : couponLoads, 2);
});
