import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  KIMI_HEADLINE_TARGET, kimiHeadlineCore, kimiHeadlineSeedOptions, seedKimiHeadline20261103,
} from './catalog-2026-11-03-kimi-headline';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

// Production-shaped state after the 11-02 apply and the 11-03 03:19 SGT scraper run.
// Postgres returns int8 ids and some numerics as strings; the seed must cope.
const state = () => ({
  providers: [{ id: 40, slug: 'moonshot-global', type: 'producer' }, { id: 59, slug: 'openrouter', type: 'aggregator' }],
  models: [{ id: 3719, slug: 'moonshotai-kimi-k3-1-pro', name: 'kimi-k3.1-pro' }, { id: 1, slug: 'gpt-oss-120b' }],
  api_channel_prices: [
    { id: 500, model_id: 3719, provider_id: 40, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.2, is_available: true },
    { id: 100, model_id: 1, provider_id: 59, input_price_per_1m: 0.15, output_price_per_1m: 0.6, last_verified: '2026-11-02T19:17:00.000Z', notes: 'scraper' },
  ],
  api_channel_price_variants: [
    { id: 610, model_id: 3719, provider_id: 40, variant_key: 'cache-write-5m', is_headline: false, cache_create_price_per_1m: 2 },
    { id: 611, model_id: 3719, provider_id: 40, variant_key: 'cache-write-1h', is_headline: false, cache_create_price_per_1m: 4 },
    { id: 200, model_id: 1, provider_id: 59, variant_key: 'openrouter-auto', is_headline: true, last_verified: '2026-11-02T19:17:00.000Z', notes: null, raw_json: {} },
  ] as FakeRow[],
});

test('options: dry-run by default, --apply explicit, unknown flags rejected', () => {
  assert.equal(kimiHeadlineSeedOptions([]).apply, false);
  assert.equal(kimiHeadlineSeedOptions(['--dry-run']).apply, false);
  assert.equal(kimiHeadlineSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => kimiHeadlineSeedOptions(args), /Usage/);
});

test('dry-run previews exactly one insert and writes nothing', async () => {
  const f = fakeSeedTx(state());
  const before = structuredClone(f.data);
  const steps = await seedKimiHeadline20261103(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(steps.map(s => `${s.action} ${s.table} ${s.target}`), [`insert api_channel_price_variants ${KIMI_HEADLINE_TARGET}`]);
  assert.equal(steps[0].changes.is_headline.to, true);
  assert.deepEqual([steps[0].changes.input_price_per_1m.to, steps[0].changes.output_price_per_1m.to, steps[0].changes.cached_input_price_per_1m.to], [2, 10, 0.2]);
});

test('apply inserts only the standard headline, touches no other row, and re-runs as 0', async () => {
  const f = fakeSeedTx(state());
  const before = structuredClone(f.data);
  await seedKimiHeadline20261103(f.tx, true);
  assert.equal(f.writes(), 1);
  const added = f.data.api_channel_price_variants.filter(r => !before.api_channel_price_variants.some(b => b.id === r.id));
  assert.equal(added.length, 1);
  assert.deepEqual([added[0].model_id, added[0].provider_id, added[0].variant_key, added[0].is_headline, added[0].currency],
    [3719, 40, 'standard', true, 'USD']);
  assert.deepEqual([added[0].input_price_per_1m, added[0].output_price_per_1m, added[0].cached_input_price_per_1m], [2, 10, 0.2]);
  // Every pre-existing row (OpenRouter channel/auto variant, Kimi channel, cache-write tiers) is byte-identical.
  for (const table of ['providers', 'models', 'api_channel_prices'] as const) assert.deepEqual(f.data[table], before[table]);
  assert.deepEqual(f.data.api_channel_price_variants.filter(r => r.id !== added[0].id), before.api_channel_price_variants);
  const group = f.data.api_channel_price_variants.filter(r => r.model_id === 3719 && r.provider_id === 40);
  assert.equal(group.filter(r => r.is_headline === true).length, 1, 'exactly one headline (audit variants.no_headline / multiple_headline)');

  assert.deepEqual(await seedKimiHeadline20261103(f.tx), [], 'dry-run after apply is 0');
  // Postgres read-back shapes (string numerics) and later scraper refreshes of notes/last_verified stay at 0.
  Object.assign(added[0], { input_price_per_1m: '2', output_price_per_1m: '10', headline_rank: '0', notes: 'scraper refresh', last_verified: '2026-11-04T19:17:00.000Z' });
  assert.deepEqual(await seedKimiHeadline20261103(f.tx, true), []);
  assert.equal(f.writes(), 1);
});

test('an existing non-headline standard row is corrected in place (core fields only)', async () => {
  const s = state();
  s.api_channel_price_variants.push({ id: 612, model_id: 3719, provider_id: 40, variant_key: 'standard', is_headline: false, notes: 'keep me', input_price_per_1m: 2 });
  const f = fakeSeedTx(s);
  const steps = await seedKimiHeadline20261103(f.tx, true);
  assert.equal(steps[0].action, 'update');
  assert.ok(!('notes' in steps[0].changes) && !('last_verified' in steps[0].changes));
  const row = f.data.api_channel_price_variants.find(r => r.id === 612)!;
  assert.equal(row.is_headline, true);
  assert.equal(row.notes, 'keep me');
  assert.equal(f.data.api_channel_price_variants.length, s.api_channel_price_variants.length);
  assert.deepEqual(await seedKimiHeadline20261103(f.tx), []);
  for (const key of Object.keys(steps[0].changes)) assert.ok(key in kimiHeadlineCore(40, 3719), `${key} is a core field`);
});

test('unsafe or ambiguous state aborts before any write', async () => {
  const cases: Array<(s: ReturnType<typeof state>) => void> = [
    s => { s.providers = s.providers.filter(p => p.slug !== 'moonshot-global'); },
    s => { s.providers.push({ id: 41, slug: 'moonshot-global', type: 'producer' }); },
    s => { s.providers[0].type = 'aggregator'; },
    s => { s.models.push({ id: 3720, slug: 'kimi-k3.1-pro', name: 'dup' }); },
    s => { s.models = s.models.filter(m => m.id !== 3719); },
    s => { s.api_channel_prices = s.api_channel_prices.filter(c => c.id !== 500); },
    s => { s.api_channel_prices[0].output_price_per_1m = 12; },
    s => { s.api_channel_prices[0].is_available = false; },
    s => { s.api_channel_price_variants[0].is_headline = true; },
    s => { s.api_channel_price_variants.push({ id: 620, model_id: 3719, provider_id: 40, variant_key: 'standard' }, { id: 621, model_id: 3719, provider_id: 40, variant_key: 'standard' }); },
  ];
  for (const mutate of cases) {
    const s = state(); mutate(s);
    const f = fakeSeedTx(s);
    await assert.rejects(seedKimiHeadline20261103(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('CLI defaults to a READ ONLY transaction and exposes npm scripts', () => {
  const cli = readFileSync(new URL('../seed-catalog-2026-11-03-kimi-headline.ts', import.meta.url), 'utf8');
  assert.match(cli, /if \(!apply\) await tx`SET TRANSACTION READ ONLY`/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-03-kimi-headline'], 'tsx scripts/seed-catalog-2026-11-03-kimi-headline.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-03-kimi-headline:apply'], 'tsx scripts/seed-catalog-2026-11-03-kimi-headline.ts --apply');
});
