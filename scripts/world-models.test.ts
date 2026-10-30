import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as catalog from '../src/lib/ai-vertical-catalog';
import * as aliases from '../src/lib/vertical-model-aliases';
import type { AiCatalogItem } from '../src/lib/ai-vertical-catalog';
import type { getVerticalModelCatalog } from '../src/lib/vertical-models';
import type { getVerticalModelDetail } from '../src/lib/vertical-model-detail';
import { availableUsagePrices } from '../src/lib/model-usage-prices';
import { worldModelMinuteCost, worldModelPrice, worldModelsByCostPerMinute } from '../src/lib/world-model-pricing';
import { WorldModelCatalog, WorldModelFacts, WorldModelTiers } from '../src/components/world-model-catalog';

const worlds = catalog.catalogForKind('world-model');
const retired = ['genie-2', 'nvidia-cosmos', 'jepa-world-models', 'gamengen', 'world-labs'];

test('static world membership is current, sourced and dated', () => {
  assert.equal(worlds.length, 11);
  assert.equal(new Set(worlds.map((item) => item.slug)).size, worlds.length);
  for (const slug of retired) assert.ok(!worlds.some((item) => item.slug === slug));
  for (const item of worlds) {
    assert.equal(item.verifiedAt, '2026-10-15', item.slug);
    assert.ok(item.sourceUrls?.length, item.slug);
    for (const source of item.sourceUrls!) assert.equal(new URL(source.url).protocol, 'https:');
    if (item.priceStatus === 'undisclosed' || item.priceStatus === 'not_applicable') {
      assert.equal(item.pricePerUnit, undefined, item.slug);
      assert.equal(item.costPerMinute, undefined, item.slug);
    }
  }
});

test('minute costs contain only priced realtime per-second world models and sort ascending', () => {
  const oasis = worlds.find((item) => item.slug === 'decart-oasis-3-preview')!;
  const mixed: AiCatalogItem[] = [
    { ...oasis, slug: 'expensive', pricePerUnit: 0.05, costPerMinute: 3 },
    ...worlds,
    { ...oasis, slug: 'cheap', pricePerUnit: 0.01, costPerMinute: 0.6 },
    { ...oasis, slug: 'not-realtime', realtime: false },
    { ...oasis, slug: 'not-disclosed', priceStatus: 'undisclosed' },
    { ...oasis, slug: 'self-host', billingUnit: 'open_source_self_host', priceStatus: 'not_applicable' },
    { ...oasis, slug: 'per-world', billingUnit: 'per_world' },
    { ...oasis, slug: 'bad-price', pricePerUnit: NaN },
    { ...oasis, slug: 'bad-cost', costPerMinute: NaN },
  ];
  const original = mixed.map((item) => item.slug);
  assert.deepEqual(worldModelsByCostPerMinute(mixed).map((item) => item.slug), ['cheap', oasis.slug, 'expensive']);
  assert.deepEqual(mixed.map((item) => item.slug), original);
  assert.deepEqual(worldModelsByCostPerMinute(worlds).map((item) => item.slug), [oasis.slug]);
  assert.equal(oasis.costPerMinute, oasis.pricePerUnit! * 60);
});

test('unknown prices stay blank even if stale numeric values are supplied; Free is an actual tier', () => {
  for (const locale of ['en', 'zh']) {
    for (const priceStatus of ['undisclosed', 'not_applicable', 'subscription_included'] as const) {
      const item = { ...worlds[0], priceStatus, pricePerUnit: 0, costPerMinute: 0 };
      assert.equal(worldModelPrice(item, locale), '—');
      assert.equal(worldModelMinuteCost(item, locale), '—');
    }
    for (const item of worlds.filter((item) => item.priceStatus === 'undisclosed' || item.priceStatus === 'not_applicable')) {
      const html = renderToStaticMarkup(createElement(WorldModelFacts, { item, locale }));
      assert.doesNotMatch(html, /(?:\$|US\$)0(?:\.00)?/);
      assert.match(html, /—/);
    }
    const marble = worlds.find((item) => item.slug === 'world-labs-marble')!;
    const tiers = renderToStaticMarkup(createElement(WorldModelTiers, { item: marble, locale }));
    assert.match(tiers, /Free/);
    assert.match(tiers, /\$0\.00/);
  }
});

test('world table renders localized fields, warnings, research notes and the restricted cost list', () => {
  for (const locale of ['en', 'zh']) {
    // Standalone React rendering has no Next image-host config; use local logo fixtures.
    const items = worlds.map((item) => ({ ...item, providerLogoUrl: '/fixture.svg',
      ...(item.slug === 'world-labs-marble' ? { needsVerification: ['Fixture warning renders'] } : {}) }));
    const html = renderToStaticMarkup(createElement(WorldModelCatalog, { items, locale }));
    for (const item of worlds) assert.ok(html.includes(`/world-models/${item.slug}`));
    assert.match(html, /Fixture warning renders/);
    assert.match(html, /JEPA/);
    assert.match(html, /GameNGen/);
    assert.ok(html.includes(locale === 'zh' ? '研究，非产品' : 'Research, not products'));
    assert.ok(html.includes(locale === 'zh' ? '核验日期' : 'Verified'));
    const costs = html.slice(html.indexOf('<ol'));
    assert.match(costs, /Oasis 3 Preview/);
    assert.doesNotMatch(costs, /Cosmos|Marble|Matrix|Helix|Genie/);
  }
});

// Evaluate the real server modules with explicit dependency stubs. No DB client is loaded,
// and any unexpected import or non-SELECT query fails the test.
function loadServerModule<T>(file: string, stubs: Record<string, unknown>): T {
  const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const testModule = { exports: {} };
  const execute = runInNewContext(`(function(require, module, exports) { ${outputText}\n})`, { console: { warn() {} } });
  execute((id: string) => {
    assert.ok(Object.hasOwn(stubs, id), `Unexpected dependency: ${id}`);
    return stubs[id];
  }, testModule, testModule.exports);
  return testModule.exports as T;
}

function serverFixture({ unavailable = false, benchmarkFailure = false, rows = [] as Record<string, unknown>[] } = {}) {
  let queries = 0;
  const benchmarkIds: number[] = [];
  const summaries = [{ benchmarkSlug: 'fixture', benchmarkName: 'Fixture', taskName: 'World', metricName: 'score', unit: null, value: 42, officialUrl: null }];
  const sql = Object.assign(async (parts: TemplateStringsArray) => {
    queries++;
    assert.match(parts.join('?').trim(), /^SELECT/);
    if (unavailable) throw new Error('DB unavailable');
    return rows;
  }, { array: () => [] });
  const stubs = {
    '@/lib/db': { sql, TEXT_ARRAY: 1009, INT4_ARRAY: 1007 },
    '@/lib/ai-vertical-catalog': catalog,
    '@/lib/vertical-model-aliases': aliases,
    '@/lib/vertical-provider-logos': { getVerticalProviderLogo: () => undefined },
    '@/lib/vertical-benchmarks': {
      getVerticalBenchmarkSummary: async (id: number) => {
        benchmarkIds.push(id);
        if (benchmarkFailure) throw new Error('Benchmark unavailable');
        return summaries;
      },
    },
    '@/lib/vertical-benchmark-summaries': { verticalBenchmarkSummaryFallback: () => [] },
  };
  const models = loadServerModule<{ getVerticalModelCatalog: typeof getVerticalModelCatalog }>('vertical-models', stubs);
  const detail = loadServerModule<{ getVerticalModelDetail: typeof getVerticalModelDetail }>('vertical-model-detail', {
    ...stubs,
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/lib/vertical-models': models,
    '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => [] },
    '@/lib/model-usage-prices': { availableUsagePrices },
  });
  return { ...models, ...detail, benchmarkIds, summaries, queryCount: () => queries };
}

test('DB cannot change world order, membership, identity, specs or prices; slug enrichment is allowed', async () => {
  const matched = {
    id: 100, slug: 'genie-3', name: 'Stale Genie', provider_name: 'Stale provider',
    provider_logo_url: '/fixture.svg', description: 'stale', pricing_unit: 'free',
  };
  const fixture = serverFixture({ rows: [...retired.map((slug, id) => ({ id, slug })), matched] });
  const actual = await fixture.getVerticalModelCatalog('world-model');
  assert.deepEqual(Array.from(actual, (item) => item.slug), worlds.map((item) => item.slug));
  assert.equal(actual[0].name, worlds[0].name);
  assert.equal(actual[0].priceStatus, 'subscription_included');
  assert.equal(actual[0].providerLogoUrl, '/fixture.svg');
  assert.equal(JSON.stringify(actual[0].benchmarkSummaries), JSON.stringify(fixture.summaries));
  assert.deepEqual(fixture.benchmarkIds, [100]);
  for (let i = 0; i < worlds.length; i++) {
    const rest = { ...actual[i] };
    delete rest.providerLogoUrl;
    delete rest.benchmarkSummaries;
    assert.deepEqual(rest, worlds[i]);
  }
});

test('empty DB, unavailable DB and unavailable benchmarks all preserve static worlds', async () => {
  for (const options of [{}, { unavailable: true }, { benchmarkFailure: true, rows: [{ id: 100, slug: 'genie-3' }] }]) {
    const fixture = serverFixture(options);
    const actual = await fixture.getVerticalModelCatalog('world-model');
    assert.equal(JSON.stringify(actual), JSON.stringify(worlds));
  }
});

test('every static world detail works with or without DB rows; retired/unknown slugs are rejected before DB lookup', async () => {
  for (const unavailable of [false, true]) {
    const fixture = serverFixture({ unavailable, rows: retired.map((slug, id) => ({ id, slug })) });
    for (const item of worlds) {
      const detail = await fixture.getVerticalModelDetail('world-model', item.slug!);
      assert.equal(detail.item.slug, item.slug);
      assert.equal(detail.source, 'catalog');
      assert.equal(detail.plans.length, 0);
      assert.equal(detail.usagePrices.length, 0);
    }
    const queries = fixture.queryCount();
    for (const slug of [...retired, 'unknown']) await assert.rejects(fixture.getVerticalModelDetail('world-model', slug), /NOT_FOUND/);
    assert.equal(fixture.queryCount(), queries);
  }
});

test('video/music/decision membership and prices remain audit-owned with stale or unavailable DB', async () => {
  for (const kind of ['video-model', 'music-model', 'decision-model', 'voice-model', 'image-model'] as const) {
    for (const fixture of [serverFixture(), serverFixture({ unavailable: true })]) {
      const actual = await fixture.getVerticalModelCatalog(kind);
      assert.equal(JSON.stringify(actual), JSON.stringify(catalog.catalogForKind(kind)));
      for (const item of actual) {
        const detail = await fixture.getVerticalModelDetail(kind, item.slug!);
        assert.equal(detail.source, 'catalog');
        assert.equal(detail.item.pricePerUnit, item.pricePerUnit);
        assert.deepEqual(Array.from(detail.usagePrices), []);
      }
    }
  }
});

test('DB-only video/music identities remain available with not-public price status', async () => {
  for (const kind of ['video-model', 'music-model'] as const) {
    const fixture = serverFixture({ rows: [{ id: 300, slug: 'db-only', name: 'DB model' }] });
    const rows = await fixture.getVerticalModelCatalog(kind);
    assert.equal(rows.length, catalog.catalogForKind(kind).length + 1);
    const extra = rows.find(row => row.slug === 'db-only')!;
    assert.equal(extra.pricePerUnit, null);
    assert.equal(extra.priceStatus, 'not-public');
    assert.equal((await fixture.getVerticalModelDetail(kind, 'db-only')).item.name, 'DB model');
  }
});


test('voice and image detail identity and facts survive missing columns and stale enrichment', async () => {
  for (const kind of ['voice-model', 'image-model'] as const) {
    const expected = catalog.catalogForKind(kind);
    for (const fixture of [serverFixture({ unavailable: true }), serverFixture({ rows: [
      { id: 7, slug: expected[0].slug, name: 'Stale name', price: 0, deprecated_at: null, shutdown_date: null },
      { id: 8, slug: 'unverified-db-only', name: 'DB-only model' },
    ] })]) {
      const actual = await fixture.getVerticalModelCatalog(kind);
      const facts = actual.map(entry => { const facts = { ...entry }; delete facts.benchmarkSummaries; return facts; });
      assert.equal(JSON.stringify(facts), JSON.stringify(expected));
      for (const entry of expected) {
        const detail = await fixture.getVerticalModelDetail(kind, entry.slug!);
        assert.equal(detail.item.name, entry.name);
        assert.equal(detail.item.shutdownDate, entry.shutdownDate);
        assert.equal(JSON.stringify(detail.item.usageRates), JSON.stringify(entry.usageRates));
      }
      const queries = fixture.queryCount();
      await assert.rejects(fixture.getVerticalModelDetail(kind, 'unverified-db-only'), /NOT_FOUND/);
      assert.equal(fixture.queryCount(), queries);
    }
  }
});
