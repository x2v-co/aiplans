import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { catalog20261102bSeedOptions, seedCatalog20261102b } from './catalog-2026-11-02b';
import * as repairData from './catalog-2026-11-02b';
import * as originalData from './catalog-2026-11-02';
import { assertCacheWriteHeadlines } from '../utils/variant-headlines';
import { fakeSeedTx } from './fake-seed-tx';

const channel = { id: 100, model_id: 10, provider_id: 43,
  input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.2,
  currency: 'USD', price_unit: 'per_1m_tokens', is_available: true };
const cacheWrites = originalData.kimiCacheWriteVariants(43, 10).map((v, i) => ({
  ...v, id: 200 + i, is_headline: false, notes: 'Preserve existing notes', updated_at: new Date('2026-11-02T01:00:00Z'),
}));
const unrelated = { ...cacheWrites[0], id: 300, provider_id: 99, is_headline: true };
const initial = {
  providers: [{ id: 43, slug: 'moonshot-global', type: 'producer' }, { id: 99, slug: 'other', type: 'aggregator' }],
  models: [{ id: 10, slug: 'kimi-k3.1-pro' }, { id: 11, slug: 'kimi-k3.1-pro-highspeed' }],
  api_channel_prices: [channel],
  api_channel_price_variants: [...cacheWrites, unrelated, { ...cacheWrites[0], id: 301, model_id: 11 }],
};

test('repair CLI default and explicit dry-run remain offline; flags and npm entries follow seed conventions', () => {
  for (const args of [[], ['--dry-run']]) {
    const output: string[] = [];
    const source = readFileSync(new URL('../seed-catalog-2026-11-02b.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    runInNewContext(outputText, {
      exports: {}, process: { argv: ['node', 'seed', ...args] },
      console: { log: (value: string) => output.push(value), error: () => assert.fail('Unexpected CLI error') },
      require: (id: string) => {
        if (id === './data/catalog-2026-11-02') return originalData;
        assert.equal(id, './data/catalog-2026-11-02b', 'Offline preview must not import a database client');
        return repairData;
      },
    });
    const preview = JSON.parse(output[0]);
    assert.equal(preview.mode, 'DRY-RUN (offline; no database connection)');
    assert.deepEqual(preview.updates, [
      { variant_key: 'cache-write-5m', is_headline: true }, { variant_key: 'cache-write-1h', is_headline: false },
    ]);
  }
  assert.equal(catalog20261102bSeedOptions([]).apply, false);
  assert.equal(catalog20261102bSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply'], ['--apply', '--apply']]) {
    assert.throws(() => catalog20261102bSeedOptions(args), /Usage/);
  }
  const { scripts } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(scripts['seed:catalog-2026-11-02b'], 'tsx scripts/seed-catalog-2026-11-02b.ts');
  assert.equal(scripts['seed:catalog-2026-11-02b:apply'], 'tsx scripts/seed-catalog-2026-11-02b.ts --apply');
});

test('repair previews without writes, updates only the existing headline flags, and is idempotent', async () => {
  const f = fakeSeedTx(initial);
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261102b(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(preview, [{ table: 'api_channel_price_variants', target: 'moonshot-global/kimi-k3.1-pro/cache-write-5m',
    action: 'update', changes: { is_headline: { from: false, to: true } } }]);
  assert.deepEqual(await seedCatalog20261102b(f.tx, true), preview);
  assert.equal(f.writes(), 1);
  const expected = structuredClone(before);
  expected.api_channel_price_variants[0].is_headline = true;
  expected.api_channel_price_variants[0].updated_at = f.data.api_channel_price_variants[0].updated_at;
  assert.deepEqual(f.data, expected, 'Every field except the repaired flag and its timestamp must remain unchanged');
  assertCacheWriteHeadlines(f.data.api_channel_price_variants.filter(v => v.model_id === 10 && v.provider_id === 43), f.data.api_channel_prices);
  assert.deepEqual(await seedCatalog20261102b(f.tx, true), []);
  assert.equal(f.writes(), 1);
});

test('repair recognizes the original model alias and corrects both flags if necessary without changing cache prices', async () => {
  const f = fakeSeedTx({ ...initial, models: [{ id: 10, slug: 'moonshotai-kimi-k3-1-pro' }],
    api_channel_price_variants: cacheWrites.map(v => ({ ...v, is_headline: v.variant_key === 'cache-write-1h', cache_create_price_per_1m: String(v.cache_create_price_per_1m) })),
  });
  const steps = await seedCatalog20261102b(f.tx, true);
  assert.equal(steps.length, 2);
  assert.deepEqual(f.data.api_channel_price_variants.map(v => [v.id, v.is_headline, v.cache_create_price_per_1m]), [
    [200, true, '2'], [201, false, '4'],
  ]);
  assert.deepEqual(await seedCatalog20261102b(f.tx, true), []);
});

test('repair rejects missing/ambiguous identities, unexpected rates and conflicting headlines before any write', async () => {
  const states = [
    { ...initial, providers: [] },
    { ...initial, providers: [...initial.providers, { ...initial.providers[0], id: 44 }] },
    { ...initial, providers: [{ ...initial.providers[0], type: 'aggregator' }] },
    { ...initial, models: [] },
    { ...initial, models: [...initial.models, { id: 12, slug: 'moonshotai-kimi-k3-1-pro' }] },
    { ...initial, api_channel_prices: [] },
    { ...initial, api_channel_prices: [channel, { ...channel, id: 101 }] },
    ...[{ is_available: false }, { currency: 'CNY' }, { price_unit: 'per_token' }, { input_price_per_1m: null }].map(change =>
      ({ ...initial, api_channel_prices: [{ ...channel, ...change }] })),
    { ...initial, api_channel_price_variants: [cacheWrites[0]] },
    { ...initial, api_channel_price_variants: [...cacheWrites, { ...cacheWrites[1], id: 202 }] },
    ...[{ is_available: false }, { cache_create_price_per_1m: 99 }, { input_price_per_1m: 99 },
      { output_price_per_1m: null }, { currency: 'CNY' }, { price_unit: 'per_token' }].map(change =>
      ({ ...initial, api_channel_price_variants: [cacheWrites[0], { ...cacheWrites[1], ...change }] })),
    { ...initial, api_channel_price_variants: [...cacheWrites, { ...cacheWrites[0], id: 202, variant_key: 'standard', is_headline: true }] },
  ];
  for (const state of states) {
    const f = fakeSeedTx(state);
    const before = structuredClone(f.data);
    await assert.rejects(seedCatalog20261102b(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
});
