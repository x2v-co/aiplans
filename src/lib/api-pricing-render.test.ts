import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import ApiPricingView from '@/app/[locale]/api-pricing/api-pricing-view';
import { ChannelTermsBadges } from '@/components/channel-terms-badges';
import { TranslationsProvider } from './translations';
import { catalogPage } from './api-pricing-catalog';
import { parseCatalogRequest } from './api-pricing-query';
import { effectivePrice } from './effective-price';
import type { ChannelPrice, GroupedProduct } from './grouped-products';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

const now = new Date('2026-11-25T10:00:00Z');
const provider = { id: 1, name: 'Fixture provider', slug: 'fixture-provider', type: 'official', region: 'global', access_from_china: null, pricing_url: 'https://example.test/prices' };
const products = Array.from({ length: 101 }, (_, i): GroupedProduct => {
  const slug = `fixture-${String(i).padStart(3, '0')}`;
  return { id: i + 1, name: slug, slug, baseName: slug, context_window: 1000, benchmark_arena_elo: 1,
    provider_ids: [1], benchmarks: [], released_at: null, created_at: null, hasChinaVersion: false, hasGlobalVersion: true, versionCounts: 1,
    versions: [{ id: i + 1, model_id: i + 1, provider_id: 1, model_slug: slug, providers: provider, currency: 'USD', price_unit: 'per_1m_tokens',
      input_price_per_1m: 0.000001, output_price_per_1m: 0.2, cached_input_price_per_1m: 0,
      price_variants: [{ id: 1, variant_key: 'sentinel', variant_name: 'UNLOADED_VARIANT_SENTINEL', input_price_per_1m: 0.1,
        output_price_per_1m: 0.2, currency: 'USD', price_unit: 'per_1m_tokens', is_headline: true }] } as ChannelPrice] };
});
const query = parseCatalogRequest(new URLSearchParams()).query;
const props = { locale: 'en', initialQuery: query, initialPage: catalogPage(products, query, now), couponByProvider: {}, requestedAt: now.toISOString() };
const withMessages = (locale: string, children: ReactNode) => {
  const messages = locale === 'zh' ? zh : en;
  const translations = { messages, children };
  const intl = { locale, timeZone: 'UTC', messages, children: createElement(TranslationsProvider, translations) };
  return createElement(NextIntlClientProvider, intl);
};

for (const locale of ['en', 'zh']) for (const delta of [-1, 0, 1]) {
  test(`${locale} delayed coupon read: table, visible FAQ and FAQ JSON-LD agree at cutoff ${delta}ms`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now });
    const cutoff = now.getTime() + 1000;
    // Match getGroupedProducts: normalize BEFORE the other backend read settles.
    // Never renormalize this fixture at the delayed response clock.
    const loaded = [{ ...products[0], versions: [effectivePrice({ ...products[0].versions[0],
      input_price_per_1m: 0.1, output_price_per_1m: 0.2, cached_input_price_per_1m: 0.01,
      promo_ends_at: new Date(cutoff).toISOString(), regular_input_price_per_1m: 9,
      regular_output_price_per_1m: 18, regular_cached_input_price_per_1m: 0.9,
    }, now)] }];
    const freeze = (value: object) => {
      Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); });
      Object.freeze(value);
    };
    freeze(loaded);
    const before = JSON.stringify(loaded);
    let release!: () => void, started!: () => void;
    let couponStarted: Promise<void>;
    let catalogReads = 0, couponReads = 0;
    const url = new URL('../app/[locale]/api-pricing/catalog-page.tsx', import.meta.url), require = createRequire(url);
    // Only existing backend boundaries are doubled; all price, projection, SEO
    // helpers and the actual page/main/view run from source with real React SSR.
    const boundaries: Record<string, unknown> = {
      '@/lib/pricing-seo-data': { getApiPricingSeoData: async () => { catalogReads++; return { products: loaded, updatedAt: now }; } },
      '@/lib/coupons': { getActiveCouponMap: async (type: string) => {
        assert.equal(type, 'api'); couponReads++; started();
        await new Promise<void>(resolve => { release = resolve; }); return {};
      } },
    };
    const mod: Record<string, unknown> = {};
    const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URLSearchParams })((id: string) => Object.hasOwn(boundaries, id) ? boundaries[id] : require(id), mod);
    const Page = mod.default as (props: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string>> }) => Promise<ReactElement>;
    const delayedPage = async (searchParams: Record<string, string>) => {
      t.mock.timers.setTime(now.getTime());
      couponStarted = new Promise<void>(resolve => { started = resolve; });
      let settled = false;
      const pending = Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) }).then(tree => { settled = true; return tree; });
      await couponStarted;
      assert.equal(settled, false);
      assert.equal(loaded[0].versions[0].input_price_per_1m, 0.1);
      t.mock.timers.setTime(cutoff + delta);
      release();
      return pending;
    };
    const tree = await delayedPage({});
    // Render the page's real main and structured-data nodes. Navigation needs a
    // Next router context and is outside this price regression; no component stub.
    const markup = (tree: ReactElement) => renderToStaticMarkup(withMessages(locale,
      elements(tree, el => el.type === 'main' || el.type === 'script')));
    const html = markup(tree);
    const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    const faqSection = html.match(/<section[^>]*aria-label="(?:Frequently asked questions|常见问题)"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    const faq = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1])).find(item => item['@type'] === 'FAQPage');
    const floor = faq.mainEntity.find((item: { name: string }) => /lowest input|输入 token 价格最低/.test(item.name)).acceptedAnswer.text as string;
    const expected = delta < 0 ? 0.1 : 9;
    const promoTree = await delayedPage({ promo: '1' });
    const promoPage = elements(promoTree, el => el.type === ApiPricingView)[0].props.initialPage as typeof props.initialPage;
    const promoHtml = markup(promoTree);
    const observed = { tableInput: table.match(/USD ([\d.]+)</)?.[1], visibleFloor: faqSection.includes(`$${expected}`),
      jsonLdFloor: floor.includes(`$${expected}`), promoTotal: promoPage.total };
    t.diagnostic(JSON.stringify({ locale, delta, responseClock: new Date().toISOString(), observed, faqJsonLdAnswer: floor }));
    assert.equal(JSON.stringify(loaded), before, 'shared backend data must stay unchanged');
    assert.equal(catalogReads, 2); assert.equal(couponReads, 2);
    assert.deepEqual(observed, { tableInput: String(expected), visibleFloor: true, jsonLdFloor: true, promoTotal: delta < 0 ? 1 : 0 });
    assert.match(table, new RegExp(`USD ${delta < 0 ? '0\\.2' : '18'}<`));
    assert.match(table, new RegExp(`USD ${delta < 0 ? '0\\.01' : '0\\.9'}<`));
    if (delta >= 0) {
      assert.doesNotMatch(faqSection, /\$0\.1\b/); assert.doesNotMatch(floor, /\$0\.1\b/);
      assert.doesNotMatch(promoHtml, /\$0\.1\b|USD 0\.1</);
    } else {
      assert.match(promoHtml, /\$0\.1\b/); assert.match(promoHtml, /USD 0\.1</);
    }
  });
}

test('real bilingual view SSR renders 50 useful rows, precise input/cache/native units, form and link fallbacks without downloading a catalog', () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw new Error('Network forbidden in SSR test'); };
  try {
    for (const locale of ['en', 'zh']) {
      const html = renderToStaticMarkup(withMessages(locale, createElement(ApiPricingView, { ...props, locale })));
      assert.equal((html.match(/<tbody><tr>|<\/tr><tr>/g) ?? []).length, 50);
      assert.match(html, /USD 0\.000001/); assert.match(html, /Cache read|缓存读取/);
      assert.match(html, /USD 0<\/span>/); assert.match(html, /1M tokens|百万tokens/);
      assert.match(html, /method="get"/); assert.match(html, /sort=selected/); assert.match(html, /offset=50/);
      assert.match(html, /example\.test\/prices/);
      assert.equal((html.match(/scope="col"/g) ?? []).length, 4);
      assert.equal((html.match(/id="api-pricing-channels-help"/g) ?? []).length, 1);
      assert.equal((html.match(/aria-describedby="api-pricing-channels-help"/g) ?? []).length, 50);
      const help = locale === 'zh' ? '逐条显示满足当前筛选条件的渠道及原模型标识、地区、批量与缓存价格。模型详情包含其他渠道。'
        : 'Channels match the current filters and identify their model, region, batch and cache pricing. Model details include other channels.';
      assert.equal(html.split(help).length - 1, 1, 'disclosure guidance remains visible once for every row');
      assert.doesNotMatch(html, /UNLOADED_VARIANT_SENTINEL|fixture-050|fixture-100|api\/products\/grouped/);
      assert.equal(fetches, 0);
    }
  } finally { globalThis.fetch = originalFetch; }
});

for (const locale of ['en', 'zh']) test(`${locale} catalog terms preserve shared badge evidence, translations and escaped notes`, () => {
  const semantic = (html: string) => ({
    text: html.replace(/<[^>]*>/g, ''),
    titles: [...html.matchAll(/title="([^"]*)"/g)].map(match => match[1]),
  });
  for (const training of [true, false, null]) for (const unit of ['usd', 'requests', 'tokens', 'credits', 'unknown', null]) {
    const terms = { data_for_discount: training, data_for_discount_note: '  Evidence <verified> & "quoted"  ', quota_unit: unit };
    const row = props.initialPage.rows[0];
    const html = renderToStaticMarkup(withMessages(locale, createElement(ApiPricingView, {
      ...props, locale, initialPage: { ...props.initialPage, rows: [{ ...row, quote: { ...row.quote!, ...terms } }] },
    })));
    const compact = html.match(/<div class="ap-terms">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const shared = renderToStaticMarkup(withMessages(locale, createElement(ChannelTermsBadges, { terms })));
    assert.deepEqual(semantic(compact), semantic(shared), `${String(training)}/${String(unit)}`);
    assert.doesNotMatch(compact, /<verified>/, 'evidence notes must stay escaped in titles');
  }
});

test('server catalog projection, JSON-LD and filtered no-JS page agree; coupons and private full catalog stay outside the view props', async () => {
  const url = new URL('../app/[locale]/api-pricing/catalog-page.tsx', import.meta.url);
  const require = createRequire(url);
  const mocks: Record<string, unknown> = {
    '@/lib/pricing-seo-data': { getApiPricingSeoData: async () => ({ products, updatedAt: now }) },
    '@/lib/coupons': { getActiveCouponMap: async () => ({ unrelated: [] }) },
    '@/components/SiteHeader': { __esModule: true, default: () => createElement('header', null, 'Fixture navigation') },
  };
  const mod: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URLSearchParams })((id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod);
  const Page = mod.default as (props: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string>> }) => Promise<ReactElement>;
  const find = (node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] => {
    if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
    if (!isValidElement<Record<string, unknown>>(node)) return [];
    return [...(predicate(node) ? [node] : []), ...find(node.props.children as ReactNode, predicate)];
  };
  for (const locale of ['en', 'zh']) {
    const tree = await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ sort: 'selected', offset: '50' }) });
    const view = find(tree, element => element.type === ApiPricingView)[0];
    assert.equal((view.props.initialPage as typeof props.initialPage).rows.length, 50);
    assert.equal((view.props.initialPage as typeof props.initialPage).rows[0].slug, 'fixture-050');
    assert.deepEqual(Object.keys(view.props.couponByProvider as object), []);
    assert.doesNotMatch(JSON.stringify(view.props), /price_variants|UNLOADED_VARIANT_SENTINEL|fixture-000/);
    const scripts = find(tree, element => element.type === 'script').map(el => JSON.parse((el.props.dangerouslySetInnerHTML as { __html: string }).__html));
    const list = scripts.find(script => script['@type'] === 'ItemList');
    assert.equal(list.numberOfItems, 50); assert.equal(list.itemListElement.length, 50);
    assert.equal(list.itemListElement[0].url, `https://aiplans.dev/${locale}/models/fixture-050`);
    const html = renderToStaticMarkup(withMessages(locale, tree));
    assert.match(html, /fixture-050/); assert.match(html, /fixture-099/);
    assert.doesNotMatch(html, /UNLOADED_VARIANT_SENTINEL|fixture-100/);
    const faq = scripts.find(script => script['@type'] === 'FAQPage');
    assert.ok(faq.mainEntity.every((item: { name: string }) => html.includes(item.name.replace(/&/g, '&amp;'))));
  }
});

test('client pagination initiates requests only on interaction, cancels older requests, and retains current results on HTTP errors', async () => {
  const sourceUrl = new URL('../app/[locale]/api-pricing/api-pricing-view.tsx', import.meta.url);
  const require = createRequire(sourceUrl);
  const react = require('react');
  const slots: unknown[] = [];
  let cursor = 0, calls = 0;
  const pending: { resolve: (value: unknown) => void; signal: AbortSignal }[] = [];
  const useState = (initial: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value: unknown) => { slots[index] = value; }];
  };
  const useRef = (value: unknown) => { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; };
  const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URLSearchParams, AbortController,
    fetch: (_url: string, options: { signal: AbortSignal }) => { calls++; return new Promise(resolve => pending.push({ resolve, signal: options.signal })); } })((id: string) => {
    if (id === 'react') return { ...react, useState, useRef, useEffect: () => {} };
    return require(id);
  }, exports);
  const View = exports.default as typeof ApiPricingView;
  function render() { cursor = 0; return View(props); }
  const findAnchor = (node: unknown): ReactElement<{ onClick: (event: unknown) => void }> | undefined => {
    if (Array.isArray(node)) return node.map(findAnchor).find(Boolean);
    if (!isValidElement<{ href?: string; onClick: (event: unknown) => void; children: unknown }>(node)) return;
    if (node.type === 'a' && node.props.href?.includes('offset=50')) return node;
    return findAnchor(node.props.children);
  };
  let tree = render(); assert.equal(calls, 0);
  const click = () => findAnchor(tree)!.props.onClick({ button: 0, preventDefault() {} });
  click(); click(); assert.equal(calls, 2); assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ ok: true, json: async () => ({ page: { ...props.initialPage, total: 22 }, couponByProvider: {}, requestedAt: now.toISOString() }) });
  await new Promise(resolve => setImmediate(resolve));
  pending[0].resolve({ ok: true, json: async () => ({ page: { ...props.initialPage, total: 999 }, couponByProvider: {}, requestedAt: now.toISOString() }) });
  await new Promise(resolve => setImmediate(resolve));
  tree = render(); assert.match(JSON.stringify(tree), /22 model groups/); assert.doesNotMatch(JSON.stringify(tree), /999 model groups/);
  click(); pending[2].resolve({ ok: false }); await new Promise(resolve => setImmediate(resolve));
  tree = render(); assert.match(JSON.stringify(tree), /22 model groups/);
  // Render the error child too; this harness verifies handlers/state, not browser hydration.
  const error = elements(tree, el => typeof el.type === 'function' && el.type.name === 'ErrorMessage')[0];
  assert.ok(error);
  assert.match(renderToStaticMarkup(createElement(error.type, error.props)), /role="alert"/);
});

// Each mounted function owns real handler state, refs and effect cleanup. This is
// an in-memory lifecycle harness, not React DOM hydration or browser acceptance.
type HandlerElement = ReactElement<Record<string, unknown>>;
function elements(node: unknown, predicate: (element: HandlerElement) => boolean): HandlerElement[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [...(predicate(node) ? [node] : []), ...elements(node.props.children, predicate)];
}
const label = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(label).join('');
  return isValidElement<{ children: unknown }>(node) ? label(node.props.children) : '';
};
const child = (node: unknown, name: string) => elements(node, el => typeof el.type === 'function' && el.type.name === name)[0];
const button = (node: unknown, name: string) => elements(node, el => el.type === 'button' && label(el) === name)[0];
const invoke = (element: HandlerElement, name = 'onClick', event?: unknown) => {
  assert.ok(element, `Missing element for ${name}`);
  return (element.props[name] as (event?: unknown) => unknown)(event);
};
function handlerHarness() {
  interface Instance {
    slots: unknown[];
    cursor: number;
    mounted: boolean;
    writesAfterUnmount: number;
    cleanups: (() => void)[];
    tree: ReactElement;
    render: () => ReactElement;
    unmount: () => void;
  }
  let active: Instance;
  const sourceUrl = new URL('../app/[locale]/api-pricing/api-pricing-view.tsx', import.meta.url);
  const require = createRequire(sourceUrl);
  const react = require('react');
  const calls: { url: string; signal: AbortSignal; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const useState = (initial: unknown) => {
    const owner = active, index = owner.cursor++;
    if (!(index in owner.slots)) owner.slots[index] = initial;
    return [owner.slots[index], (value: unknown) => { if (!owner.mounted) owner.writesAfterUnmount++; owner.slots[index] = value; }];
  };
  const useRef = (initial: unknown) => {
    const owner = active, index = owner.cursor++;
    if (!(index in owner.slots)) owner.slots[index] = { current: initial };
    return owner.slots[index];
  };
  const useEffect = (effect: () => () => void) => {
    const index = active.cursor++;
    if (!(index in active.slots)) { active.slots[index] = true; active.cleanups.push(effect()); }
  };
  class FormFields {
    constructor(private form: { entries: [string, string][] }) {}
    [Symbol.iterator]() { return this.form.entries[Symbol.iterator](); }
  }
  const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URLSearchParams, AbortController, FormData: FormFields,
    fetch: (url: string, options: { signal: AbortSignal }) => new Promise((resolve, reject) => calls.push({ url, signal: options.signal, resolve, reject })),
  })((id: string) => id === 'react' ? { ...react, useState, useRef, useEffect } : require(id), exports);
  function mount(element: ReactElement) {
    const instance: Instance = {
      slots: [], cursor: 0, mounted: true, writesAfterUnmount: 0, cleanups: [], tree: createElement('div'),
      render() { active = instance; instance.cursor = 0; instance.tree = (element.type as (props: unknown) => ReactElement)(element.props); return instance.tree; },
      unmount() { instance.mounted = false; instance.cleanups.forEach(cleanup => cleanup()); },
    };
    instance.render(); return instance;
  }
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const succeed = async (index: number, page: unknown) => {
    calls[index].resolve({ ok: true, json: async () => ({ page, couponByProvider: {}, requestedAt: now.toISOString() }) }); await flush();
  };
  return { mount, calls, succeed, flush, View: exports.default as typeof ApiPricingView };
}

for (const mode of ['channels', 'variants']) test(`${mode} next-page failure retains good results and retries the exact failed mode/identity/query/offset`, async () => {
  const h = handlerHarness();
  const initialQuery = { ...query, locale: 'zh' as const, q: 'fixture', region: 'global' as const, channel: 'official' as const };
  const view = h.mount(createElement(h.View, { ...props, locale: 'zh', initialQuery }));
  const channels = h.mount(child(view.tree, 'Channels'));
  assert.equal(h.calls.length, 0);
  invoke(elements(channels.tree, el => el.type === 'details')[0], 'onToggle', { currentTarget: { open: true } });
  const cp = props.initialPage.rows[0].quote!;
  await h.succeed(0, { slug: 'fixture-000', name: 'fixture-000', rows: [cp], total: 19, offset: 0, nextOffset: 8, requestedAt: now.toISOString() });
  channels.render();
  const instance = mode === 'channels' ? channels : h.mount(child(channels.tree, 'Variants'));
  let first = 0;
  if (mode === 'variants') {
    invoke(elements(instance.tree, el => el.type === 'button')[0]); first = h.calls.length - 1;
    await h.succeed(first, { slug: 'fixture-000', channelId: cp.id, rows: [{ id: 10, variant_name: 'good-variant', currency: 'USD', price_unit: 'per_1m_tokens', input_price_per_1m: 1 }], total: 30, offset: 0, nextOffset: 12 });
    instance.render();
  }
  invoke(button(instance.tree, '下一页'));
  const failed = h.calls.length - 1;
  assert.equal(new URL(h.calls[failed].url, 'http://local').searchParams.get('offset'), mode === 'channels' ? '8' : '12');
  h.calls[failed].resolve({ ok: false }); await h.flush(); instance.render();
  assert.ok(child(instance.tree, 'ErrorMessage'));
  assert.match(JSON.stringify(instance.tree), mode === 'channels' ? /fixture-000/ : /good-variant/);
  invoke(button(instance.tree, '重试'));
  const retried = h.calls.length - 1;
  assert.equal(h.calls[retried].url, h.calls[failed].url);
  const params = new URL(h.calls[retried].url, 'http://local').searchParams;
  assert.equal(params.get('mode'), mode); assert.equal(params.get('slug'), 'fixture-000');
  assert.equal(params.get('locale'), 'zh'); assert.equal(params.get('q'), 'fixture');
  assert.equal(params.get('region'), 'global'); assert.equal(params.get('channel'), 'official');
  if (mode === 'variants') assert.equal(params.get('channelId'), String(cp.id));
  assert.deepEqual([first, failed, retried].map(i => new URL(h.calls[i].url, 'http://local').searchParams.get('offset')), ['0', mode === 'channels' ? '8' : '12', mode === 'channels' ? '8' : '12']);
  await h.succeed(retried, { slug: 'fixture-000', rows: [], total: 19, offset: Number(params.get('offset')), nextOffset: null, requestedAt: now.toISOString() });
  instance.render(); assert.equal(child(instance.tree, 'ErrorMessage'), undefined);
});

test('list search and pagination retries retain failed query until success, then update no-JS pagination links', async () => {
  const h = handlerHarness(), view = h.mount(createElement(h.View, props));
  const form = elements(view.tree, el => el.type === 'form')[0];
  invoke(form, 'onSubmit', { preventDefault() {}, currentTarget: { entries: [['q', 'new search'], ['sort', 'price'], ['order', 'asc'], ['channel', 'official'], ['region', 'global']] } });
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ ok: false }); await h.flush(); view.render();
  assert.match(JSON.stringify(view.tree), /101 model groups/);
  invoke(button(view.tree, 'Retry')); assert.equal(h.calls[1].url, h.calls[0].url);
  await h.succeed(1, { ...props.initialPage, total: 77 }); view.render();
  const next = () => elements(view.tree, el => el.type === 'a' && label(el) === 'Next')[0];
  const params = new URL(String(next().props.href), 'http://local').searchParams;
  assert.equal(params.get('q'), 'new search'); assert.equal(params.get('channel'), 'official'); assert.equal(params.get('sort'), 'price');
  invoke(next(), 'onClick', { button: 0, preventDefault() {} });
  h.calls[2].reject(Error('offline')); await h.flush(); view.render();
  assert.match(JSON.stringify(view.tree), /77 model groups/);
  invoke(button(view.tree, 'Retry')); assert.equal(h.calls[3].url, h.calls[2].url);
  assert.equal(new URL(h.calls[3].url, 'http://local').searchParams.get('offset'), '50');
  await h.succeed(3, { ...props.initialPage, offset: 50, total: 77, nextOffset: null }); view.render();
  assert.equal(child(view.tree, 'ErrorMessage'), undefined);
});

test('independent channel/variant loaders cancel stale requests and cleanup prevents state writes after unmount', async () => {
  const h = handlerHarness(), view = h.mount(createElement(h.View, props));
  const channelElements = elements(view.tree, el => typeof el.type === 'function' && el.type.name === 'Channels');
  const a = h.mount(channelElements[0]), b = h.mount(channelElements[1]);
  const open = (instance: typeof a) => invoke(elements(instance.tree, el => el.type === 'details')[0], 'onToggle', { currentTarget: { open: true } });
  open(a); open(b); assert.equal(h.calls[0].signal.aborted, false); assert.equal(h.calls[1].signal.aborted, false);
  a.unmount(); assert.equal(h.calls[0].signal.aborted, true); assert.equal(h.calls[1].signal.aborted, false);
  await h.succeed(0, { rows: [], total: 999 }); assert.equal(a.writesAfterUnmount, 0);
  const cp = props.initialPage.rows[1].quote!;
  await h.succeed(1, { slug: 'fixture-001', name: 'fixture-001', rows: [cp, { ...cp, id: 1002 }], total: 19, offset: 0, nextOffset: 8, requestedAt: now.toISOString() }); b.render();
  const variants = elements(b.tree, el => typeof el.type === 'function' && el.type.name === 'Variants');
  const v1 = h.mount(variants[0]), v2 = h.mount(variants[1]);
  invoke(elements(v1.tree, el => el.type === 'button')[0]); invoke(elements(v2.tree, el => el.type === 'button')[0]);
  assert.equal(h.calls[2].signal.aborted, false); assert.equal(h.calls[3].signal.aborted, false);
  v1.unmount(); assert.equal(h.calls[2].signal.aborted, true); assert.equal(h.calls[3].signal.aborted, false);
  h.calls[2].reject(Error('after unmount')); await h.flush(); assert.equal(v1.writesAfterUnmount, 0);
  await h.succeed(3, { slug: 'fixture-001', channelId: 1002, rows: [], total: 0, offset: 0, nextOffset: null }); v2.render();
  assert.equal(child(v2.tree, 'ErrorMessage'), undefined);
  // Supersede two channel navigations without settling the first request.
  invoke(button(b.tree, 'Next')); invoke(button(b.tree, 'Next'));
  assert.equal(h.calls[4].signal.aborted, true); assert.equal(h.calls[5].signal.aborted, false);
  await h.succeed(5, { slug: 'fixture-001', name: 'latest', rows: [], total: 22, offset: 8, nextOffset: null, requestedAt: now.toISOString() });
  await h.succeed(4, { slug: 'fixture-001', name: 'stale', rows: [], total: 999, offset: 8, nextOffset: null, requestedAt: now.toISOString() }); b.render();
  assert.match(label(b.tree), /22/); assert.doesNotMatch(label(b.tree), /999/);
  b.unmount(); v2.unmount(); view.unmount(); assert.equal(b.writesAfterUnmount, 0);
});

test('bilingual SSR applies conjunctive channel evidence to quotes and preserves filters in no-JS links; sibling-only promotions remain unquoted', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  const cutoff = new Date(now.getTime() + 10_000).toISOString();
  const cp = products[0].versions[0];
  let catalog: GroupedProduct[] = Array.from({ length: 52 }, (_, i) => {
    const slug = `filtered-${i}`;
    return { ...products[0], slug, name: slug, providers: { ...provider, logo: '', region: 'china' }, versions: [
      { ...cp, id: i * 2 + 1, model_slug: slug, input_price_per_1m: 5, promo_ends_at: cutoff, regular_input_price_per_1m: 10 },
      { ...cp, id: i * 2 + 2, model_slug: slug, input_price_per_1m: 1, providers: { ...provider, type: 'reseller', region: 'china' } },
    ] };
  });
  const url = new URL('../app/[locale]/api-pricing/catalog-page.tsx', import.meta.url), require = createRequire(url);
  const mocks: Record<string, unknown> = {
    '@/lib/pricing-seo-data': { getApiPricingSeoData: async () => ({ products: catalog, updatedAt: now }) },
    '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
    '@/components/SiteHeader': { __esModule: true, default: () => createElement('header') },
  };
  const mod: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(`(function(require, exports) { ${compiled}\n})`, { Date, URLSearchParams })((id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod);
  const Page = mod.default as (props: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string>> }) => Promise<ReactElement>;
  for (const locale of ['en', 'zh']) {
    const filter = { channel: 'official', region: 'global', promo: '1', sort: 'price', order: 'asc' };
    const tree = await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(filter) });
    const view = elements(tree, el => el.type === ApiPricingView)[0];
    const page = view.props.initialPage as typeof props.initialPage;
    assert.equal(page.total, 52); assert.ok(page.rows.every(row => row.quote?.input_price_per_1m === 5 && row.quote.providers.type === 'official' && row.channelCount === 1));
    const html = renderToStaticMarkup(withMessages(locale, tree));
    assert.match(html, /USD 5</); assert.doesNotMatch(html, /USD 1</);
    const href = html.match(/href="([^"]+offset=50[^"]*)"/)?.[1].replace(/&amp;/g, '&');
    assert.ok(href);
    const params = new URL(href, 'http://local').searchParams;
    for (const [key, value] of Object.entries(filter)) assert.equal(params.get(key), value);
    const excluded = await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ channel: 'official', region: 'china' }) });
    assert.equal((elements(excluded, el => el.type === ApiPricingView)[0].props.initialPage as typeof props.initialPage).total, 0);
  }
  catalog = [{ ...products[0], slug: 'family', name: 'family', versions: [
    { ...cp, model_slug: 'family' },
    { ...cp, id: 999, model_slug: 'family-mini-batch', variant: ['mini', 'batch'], input_price_per_1m: 0.1,
      promo_ends_at: cutoff, regular_input_price_per_1m: 3 },
  ] }];
  const siblingTree = await Page({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ promo: '1' }) });
  const siblingPage = elements(siblingTree, el => el.type === ApiPricingView)[0].props.initialPage as typeof props.initialPage;
  assert.equal(siblingPage.total, 1); assert.equal(siblingPage.rows[0].quote, null); assert.equal(siblingPage.rows[0].channelCount, 1);
  const html = renderToStaticMarkup(withMessages('en', siblingTree));
  assert.match(html, /No matching canonical quote/); assert.doesNotMatch(html, /USD 0\.1/);
});
