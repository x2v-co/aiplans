import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditedPricingFacts, auditedPrice } from '../../src/components/audited-catalog';
import { HAILUO, KIMI_CHANNELS, WORLD_SLUG, catalog20261102SeedOptions, kimiCacheWriteVariants, seedCatalog20261102 } from './catalog-2026-11-02';
import { assertCacheWriteHeadlines } from '../utils/variant-headlines';
import { fakeSeedTx } from './fake-seed-tx';
import * as seedData from './catalog-2026-11-02';

const providers = [
  { id: 59, slug: 'openrouter', type: 'aggregator' },
  { id: 43, slug: 'moonshot-global', type: 'producer' },
  { id: 48, slug: 'minimax-china', type: 'producer' },
];
const models = [
  { id: 1, slug: 'gpt-oss-120b' }, { id: 2, slug: 'hailuo-video', pricing_unit: 'credits / generation' },
  { id: 3, slug: WORLD_SLUG, pricing_unit: 'per_token' },
  ...KIMI_CHANNELS.map((spec, i) => ({ id: 10 + i, slug: spec.slugs[0], name: spec.id, provider_ids: [42], description: 'Keep existing metadata' })),
];
const channels = [
  { id: 100, model_id: 1, provider_id: 59, input_price_per_1m: 0.015, output_price_per_1m: 0.057 },
  { id: 101, model_id: 1, provider_id: 55, input_price_per_1m: 0.15, output_price_per_1m: 0.6 },
];
const endpoint = { id: 201, model_id: 1, provider_id: 59, variant_key: 'upstream-cheap', is_headline: false, input_price_per_1m: 0.016, output_price_per_1m: 0.059 };
const initial = {
  providers, models, api_channel_prices: channels,
  api_channel_price_variants: [{ id: 200, model_id: 1, provider_id: 59, variant_key: 'openrouter-auto', input_price_per_1m: 0.015 }, endpoint],
  usage_prices: [
    { id: 300, model_id: 2, provider_id: 48, plan_id: 400, price_kind: 'credit', unit: 'credit', price: 0.05, is_available: true },
    { id: 301, model_id: 2, provider_id: 48, price_kind: 'video_second', unit: 'second', price: 0.05, is_available: true, constraints_json: { publishedPricingText: 'H3-Max 480P' } },
    { id: 302, model_id: 2, provider_id: 99, price_kind: 'credit', unit: 'credit', price: 0.05, is_available: true },
  ],
  plans: [{ id: 400, provider_id: 48, slug: 'hailuo-video-official-pricing', price_unit: 'credit' }],
};

test('offline CLI defaults to a safe preview without loading the database module', () => {
  for (const args of [[], ['--dry-run']]) {
    const output: string[] = [];
    const source = readFileSync(new URL('../seed-catalog-2026-11-02.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    runInNewContext(outputText, {
      exports: {}, process: { argv: ['node', 'seed', ...args] },
      console: { log: (value: string) => output.push(value), error: () => assert.fail('Unexpected CLI error') },
      require: (id: string) => {
        assert.equal(id, './data/catalog-2026-11-02', 'Offline preview must not import a database client');
        return seedData;
      },
    });
    assert.match(output.join('\n'), /DRY-RUN \(offline; no database connection\)/);
    assert.match(output.join('\n'), /kimi-k3.1-pro/);
  }
  assert.equal(catalog20261102SeedOptions([]).apply, false);
  assert.equal(catalog20261102SeedOptions(['--apply']).apply, true);
  for (const args of [['--dry-run', '--apply'], ['--force']]) assert.throws(() => catalog20261102SeedOptions(args), /Usage/);
});

test('seed previews without writes, then repairs only the intended rows and is idempotent', async () => {
  const f = fakeSeedTx(initial);
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261102(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.ok(preview.length > 15);
  await seedCatalog20261102(f.tx, true);
  const oss = f.data.api_channel_prices.find(r => r.id === 100)!;
  assert.deepEqual([oss.input_price_per_1m, oss.output_price_per_1m, oss.cached_input_price_per_1m], [0.15, 0.6, 0.075]);
  assert.deepEqual(f.data.api_channel_prices.find(r => r.id === 101), channels[1]);
  assert.deepEqual(f.data.api_channel_price_variants.find(r => r.id === 201), endpoint);
  assert.equal(f.data.api_channel_price_variants.find(r => r.id === 200)?.output_price_per_1m, 0.6);
  for (const [i, spec] of KIMI_CHANNELS.entries()) {
    const model = f.data.models.find(r => r.id === 10 + i)!;
    assert.deepEqual(model, models[3 + i]);
    const channel = f.data.api_channel_prices.find(r => r.provider_id === 43 && r.model_id === model.id)!;
    assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], [spec.input, spec.output, spec.cache]);
    assert.equal(channel.currency, 'USD');
    assert.equal(channel.price_unit, 'per_1m_tokens');
  }
  const cacheWrites = f.data.api_channel_price_variants.filter(r => r.provider_id === 43);
  assert.deepEqual(cacheWrites.map(r => [r.variant_key, r.cache_create_price_per_1m, r.is_headline, r.constraints_json]), [
    ['cache-write-5m', 2, true, { cache_ttl_seconds: 300 }], ['cache-write-1h', 4, false, { cache_ttl_seconds: 3600 }],
  ]);
  assertCacheWriteHeadlines(cacheWrites, f.data.api_channel_prices);
  for (const id of [300, 301]) {
    assert.equal(f.data.usage_prices.find(r => r.id === id)?.price, null);
    assert.equal(f.data.usage_prices.find(r => r.id === id)?.is_available, false);
  }
  assert.deepEqual(f.data.usage_prices.find(r => r.id === 302), initial.usage_prices[2]);
  const current = f.data.usage_prices.filter(r => r.provider_id === 48 && r.is_available);
  assert.deepEqual(current.map(r => [r.price_kind, r.unit, r.price]), HAILUO.usageRates!.map(r => [r.priceKind, r.unit, r.price]));
  assert.ok(current.every(r => r.plan_id === 400));
  assert.equal(f.data.models.find(r => r.id === 3)?.pricing_unit, 'per_1m_tokens');
  assert.equal(f.data.plans[0].price_unit, 'per_second');
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261102(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('seed reuses an existing alias; creates a model only when all exact aliases are absent', async () => {
  const f = fakeSeedTx({ ...initial, models: models.filter(r => r.id !== 15).map(r => r.id === 10 ? { ...r, slug: 'kimi-k3.1-pro' } : r) });
  await seedCatalog20261102(f.tx, true);
  assert.equal(f.data.models.length, models.length);
  assert.equal(f.data.models.find(r => r.id === 10)?.slug, 'kimi-k3.1-pro');
  assert.equal(f.data.models.filter(r => r.slug === 'kimi-k2.6').length, 1);
  assert.ok(f.data.api_channel_prices.some(r => r.model_id === f.data.models.find(m => m.slug === 'kimi-k2.6')!.id && r.provider_id === 43));
  assertCacheWriteHeadlines(f.data.api_channel_price_variants, f.data.api_channel_prices);
  assert.deepEqual(await seedCatalog20261102(f.tx, true), []);
});

test('original seed repairs previously generated non-headline cache rows and rejects a conflicting headline before writes', async () => {
  const oldVariants = kimiCacheWriteVariants(43, 10).map((v, i) => ({ ...v, id: 210 + i, is_headline: false }));
  const state = { ...initial, api_channel_price_variants: [...initial.api_channel_price_variants, ...oldVariants] };
  const f = fakeSeedTx(state);
  await seedCatalog20261102(f.tx, true);
  assertCacheWriteHeadlines(f.data.api_channel_price_variants, f.data.api_channel_prices);
  assert.deepEqual(await seedCatalog20261102(f.tx, true), []);

  const conflicting = fakeSeedTx({ ...state, api_channel_price_variants: [...state.api_channel_price_variants,
    { ...oldVariants[0], id: 220, variant_key: 'standard', is_headline: true },
  ] });
  await assert.rejects(seedCatalog20261102(conflicting.tx, true), /exactly one active headline/);
  assert.equal(conflicting.writes(), 0);
});

test('missing/ambiguous identities abort before mutation', async () => {
  for (const state of [
    { ...initial, providers: providers.slice(1) },
    { ...initial, providers: [...providers, { ...providers[1], id: 99 }] },
    { ...initial, models: [...models, { id: 20, slug: 'kimi-k3.1-pro' }] },
    { ...initial, api_channel_prices: [...channels, { ...channels[0], id: 102 }] },
    { ...initial, api_channel_price_variants: [...initial.api_channel_price_variants, { ...initial.api_channel_price_variants[0], id: 202 }] },
    { ...initial, usage_prices: [...initial.usage_prices, ...[310, 311].map(id => ({ id, model_id: 2, provider_id: 48, plan_id: 400, price_kind: 'minimax_h3_2k', unit: 'second', price: 1 }))] },
  ]) {
    const f = fakeSeedTx(state);
    await assert.rejects(seedCatalog20261102(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('Hailuo catalog and rendered facts preserve the $0.025 lower bound and all H3 tiers', () => {
  assert.equal(HAILUO.pricePerUnit, 0.025);
  assert.equal(HAILUO.pricePerUnitHigh, 0.13);
  assert.deepEqual(HAILUO.usageRates!.slice(0, 6).map(r => r.price), [0.13, 0.08, 0.06, 0.04, 0.04, 0.025]);
  assert.doesNotMatch(`${HAILUO.pricing} ${HAILUO.notes}`, /H3-Max|credit/i);
  assert.equal(auditedPrice(HAILUO, 'en'), '$0.025–$0.13 / second');
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(AuditedPricingFacts, { item: HAILUO, locale }));
    for (const price of ['0.025', '0.13', '0.08', '0.06', '0.04']) assert.ok(html.includes(`$${price}`));
    assert.doesNotMatch(html, /H3-Max|credit|undefined/i);
  }
});
