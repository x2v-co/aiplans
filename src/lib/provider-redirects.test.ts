import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readdirSync } from 'node:fs';
import productionPlans from './__fixtures__/plan-slugs-2026-10-29.json';
import {
  cachePlanRedirectCatalog,
  planRedirectRequest,
  resolvePlanRedirect,
  type PlanRedirectRow,
} from './provider-redirects';

// Next normally installs this during server bootstrap. The standalone Node test
// runner must install the real implementation before loading Next's helpers.
let unstable_getResponseFromNextConfig: typeof import('next/experimental/testing/server').unstable_getResponseFromNextConfig;
let nextConfig: typeof import('../../next.config').default;
let NextRequest: typeof import('next/server').NextRequest;
let createProxy: typeof import('../proxy').createProxy;
let fixtureProxy: ReturnType<typeof createProxy>;
before(async () => {
  Object.assign(globalThis, { AsyncLocalStorage });
  ({ NextRequest } = await import('next/server'));
  ({ createProxy } = await import('../proxy'));
  ({ unstable_getResponseFromNextConfig } = await import('next/experimental/testing/server'));
  ({ default: nextConfig } = await import('../../next.config'));
  fixtureProxy = createProxy(async () => catalog);
});

const origin = 'https://aiplans.dev';
const providerSlugs = new Set(productionPlans.map(([, provider]) => provider));
const catalog: PlanRedirectRow[] = [
  ...Array.from(providerSlugs, slug => ({ kind: 'provider' as const, slug, provider_slug: slug })),
  ...productionPlans.map(([slug, provider_slug]) => ({ kind: 'plan' as const, slug, provider_slug })),
  { kind: 'plan', slug: 'ambiguous', provider_slug: 'github' },
  { kind: 'plan', slug: 'ambiguous', provider_slug: 'openai' },
  { kind: 'plan', slug: 'duplicate', provider_slug: 'github' },
  { kind: 'plan', slug: 'duplicate', provider_slug: 'github' },
  { kind: 'plan', slug: 'orphan', provider_slug: null },
];

// Exercise the real ordering: config redirects run before proxy.
async function responseFor(path: string) {
  const response = await unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig });
  return response.headers.has('location') ? response : fixtureProxy(new NextRequest(`${origin}${path}`));
}

test('provider slugs, plan slugs, collisions, ambiguous and unknown slugs resolve correctly', () => {
  for (const locale of ['en', 'zh']) {
    for (const [slug, target] of [
      ['github', 'github'],
      ['copilot-free', 'github#copilot-free'],
      ['opencode-go', 'opencode-go'],
      ['cursor', 'xai'],
      ['ambiguous', 'ambiguous'],
      ['duplicate', 'duplicate'],
      ['orphan', 'orphan'],
      ['unknown', 'unknown'],
    ]) {
      assert.equal(resolvePlanRedirect({ locale, slug }, catalog), `/${locale}/providers/${target}`);
    }
  }
});

test('locale-less plan URLs resolve to English', () => {
  const request = planRedirectRequest('/plans/copilot-free');
  assert.deepEqual(request, { locale: 'en', slug: 'copilot-free' });
  assert.equal(resolvePlanRedirect(request!, catalog), '/en/providers/github#copilot-free');
});

test('decodes slug parameters and safely encodes targets and fragments', () => {
  const request = planRedirectRequest('/zh/plans/plan%3Apro');
  assert.deepEqual(request, { locale: 'zh', slug: 'plan:pro' });
  assert.equal(resolvePlanRedirect(request!, [
    { kind: 'plan', slug: 'plan:pro', provider_slug: 'provider:one' },
  ]), '/zh/providers/provider%3Aone#plan%3Apro');
  assert.equal(resolvePlanRedirect(planRedirectRequest('/plans/lone%')!, []), '/en/providers/lone%25');
});

test('config only handles Cursor; catalog-dependent URLs reach proxy', async () => {
  for (const path of ['/en/plans/github', '/zh/plans/copilot-free', '/plans/copilot-free']) {
    const response = await unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig });
    assert.equal(response.headers.get('location'), null, path);
  }
  for (const prefix of ['/en', '/zh', '']) {
    const response = await responseFor(`${prefix}/plans/cursor`);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), `${origin}${prefix || '/en'}/providers/xai`);
  }
});

test('returns a single 301 with locale, query and plan fragment intact', async () => {
  for (const prefix of ['/en', '/zh', '']) {
    for (const [slug, target] of [
      ['github', 'github'], ['copilot-free', 'github#copilot-free'],
      ['opencode-go', 'opencode-go'], ['ambiguous', 'ambiguous'], ['unknown', 'unknown'],
    ]) {
      const response = await responseFor(`${prefix}/plans/${slug}?period=yearly&utm=gsc`);
      const expected = new URL(`${origin}${prefix || '/en'}/providers/${target}`);
      expected.search = '?period=yearly&utm=gsc';
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), expected.toString());
      const destination = await responseFor(expected.pathname + expected.search);
      assert.equal(destination.headers.get('location'), null, 'target must not redirect again');
    }
  }
});

test('all 204 production plans resolve directly in both locales and without a locale', async () => {
  assert.equal(productionPlans.length, 204);
  assert.deepEqual(productionPlans.filter(([slug]) => providerSlugs.has(slug)).map(([slug]) => slug), ['opencode-go']);
  for (const [planSlug, providerSlug] of productionPlans) {
    for (const prefix of ['/en', '/zh', '']) {
      const path = `${prefix}/plans/${planSlug}`;
      const target = `${prefix || '/en'}/providers/${providerSlug}${providerSlugs.has(planSlug) ? '' : `#${planSlug}`}`;
      assert.equal(resolvePlanRedirect(planRedirectRequest(path)!, catalog), target, path);
      const response = await responseFor(path);
      assert.equal(response.status, 301, path);
      assert.equal(response.headers.get('location'), `${origin}${target}`, path);
    }
  }
});

test('preserves static children, metadata, plan index and nested routes without querying DB', async () => {
  let loads = 0;
  const proxy = createProxy(async () => { loads++; return catalog; }, ['featured', 'special.offers']);
  for (const prefix of ['/en', '/zh', '']) {
    for (const segment of ['', '/featured', '/featured.png', '/special.offers', '/github/plus',
      '/opengraph-image', '/opengraph-image.png', '/opengraph-image/123',
      '/twitter-image', '/twitter-image.jpg', '/icon', '/icon.svg', '/apple-icon']) {
      const path = `${prefix}/plans${segment}`;
      assert.equal(planRedirectRequest(path, ['featured', 'special.offers']), null, path);
      const response = await proxy(new NextRequest(`${origin}${path}`));
      // Locale-less extensionless pages retain their existing locale redirect.
      const localeHop = prefix === '' && !path.includes('.');
      assert.equal(response.status, localeHop ? 307 : 200, path);
      assert.equal(response.headers.get('location'), localeHop ? `${origin}/en${path}` : null, path);
    }
  }
  for (const path of ['/fr/plans/github', '/en/compare/plans/github', '/en/providers/github']) {
    assert.equal(planRedirectRequest(path), null, path);
    await proxy(new NextRequest(`${origin}${path}`));
  }
  assert.equal(loads, 0);
  assert.equal(planRedirectRequest('/en/plans/featured-ai', ['featured'])?.slug, 'featured-ai');
});

test('config passes discovered static plan segments to the standalone proxy', () => {
  const segments = readdirSync('src/app/[locale]/plans', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !/^[\[(@]/.test(entry.name))
    .map(entry => entry.name);
  assert.deepEqual(JSON.parse(nextConfig.env!.PLAN_REDIRECT_STATIC_SEGMENTS!), segments);
});

test('catalog cache coalesces concurrent reads and refreshes after five minutes', async () => {
  let time = 0;
  let loads = 0;
  const lookup = cachePlanRedirectCatalog(async () => { loads++; return catalog; }, { now: () => time });
  await Promise.all([lookup(), lookup(), lookup()]);
  assert.equal(loads, 1);
  time = 299_999;
  assert.equal(await lookup(), catalog);
  assert.equal(loads, 1);
  time = 300_000;
  await Promise.all([lookup(), lookup()]);
  assert.equal(loads, 2);
});

test('failed catalog reads warn once, fall back to the provider slug and are retried', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  let loads = 0;
  const lookup = cachePlanRedirectCatalog(async () => {
    if (++loads === 1) throw new Error('DB unavailable');
    return catalog;
  });
  const proxy = createProxy(lookup);
  const fallback = await proxy(new NextRequest(`${origin}/zh/plans/copilot-free?utm=gsc`));
  assert.equal(fallback.status, 301);
  assert.equal(fallback.headers.get('location'), `${origin}/zh/providers/copilot-free?utm=gsc`);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[1]), /DB unavailable/);
  const response = await proxy(new NextRequest(`${origin}/plans/copilot-free`));
  assert.equal(response.headers.get('location'), `${origin}/en/providers/github#copilot-free`);
  assert.equal(loads, 2);
  assert.equal(warn.mock.callCount(), 1);
});

test('a synchronous catalog loader throw also falls back with one warning', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const proxy = createProxy(() => { throw new Error('DB unavailable'); });
  const response = await proxy(new NextRequest(`${origin}/plans/copilot-free?utm=gsc`));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), `${origin}/en/providers/copilot-free?utm=gsc`);
  assert.equal(warn.mock.callCount(), 1);
});

for (const cached of [false, true]) {
  test(`a ${cached ? 'cached' : 'direct'} catalog load times out after two seconds without caching the failure`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const warn = t.mock.method(console, 'warn', () => {});
    let loads = 0;
    let finishSlowLoad!: (rows: PlanRedirectRow[]) => void;
    const load = () => {
      loads++;
      return loads === 1 ? new Promise<PlanRedirectRow[]>(resolve => { finishSlowLoad = resolve; })
        : Promise.resolve(catalog);
    };
    const proxy = createProxy(cached ? cachePlanRedirectCatalog(load) : load);
    let settled = false;
    const pending = proxy(new NextRequest(`${origin}/plans/copilot-free?utm=gsc`)).then(response => {
      settled = true;
      return response;
    });
    t.mock.timers.tick(1999);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(warn.mock.callCount(), 0);
    t.mock.timers.tick(1);
    const fallback = await pending;
    assert.equal(fallback.status, 301);
    assert.equal(fallback.headers.get('location'), `${origin}/en/providers/copilot-free?utm=gsc`);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[1]), /timed out/);

    // Retry while the original DB call is still hung.
    const response = await proxy(new NextRequest(`${origin}/plans/copilot-free`));
    assert.equal(response.headers.get('location'), `${origin}/en/providers/github#copilot-free`);
    assert.equal(loads, 2);

    // A late result from the timed-out call must not overwrite the recovered cache.
    finishSlowLoad([]);
    await Promise.resolve();
    const afterLateResult = await proxy(new NextRequest(`${origin}/plans/copilot-free`));
    assert.equal(afterLateResult.headers.get('location'), `${origin}/en/providers/github#copilot-free`);
    assert.equal(warn.mock.callCount(), 1);
  });
}
