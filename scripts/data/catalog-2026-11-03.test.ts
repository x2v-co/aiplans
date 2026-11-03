import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GEMINI_25, GEMINI_CHANGELOG, LONGCAT_SLUG, VERIFIED_AT, catalog20261103SeedOptions,
  longcatChannelRow, longcatModelRow, meituanProviderFill, seedCatalog20261103,
} from './catalog-2026-11-03';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

const gemini = (): FakeRow[] => [
  { id: 1, slug: 'gemini-2.5-pro', shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null },
  { id: 2, slug: 'gemini-2.5-flash', shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null },
  { id: 3, slug: 'google-gemini-gemini-2-5-pro-batch', shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null },
  { id: 4, slug: 'gemini-2.5-flash-lite', shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null },
  { id: 5, slug: 'meituan-longcat-2-0', provider_ids: [7] },
];
const meituan = { id: 7, slug: 'meituan', name: 'meituan', type: 'official', website: 'https://longcat.chat', pricing_url: null, api_docs_url: null, currency: 'USD' };

test('options: dry-run by default, --apply explicit, unknown flags rejected', () => {
  assert.equal(catalog20261103SeedOptions([]).apply, false);
  assert.equal(catalog20261103SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261103SeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261103SeedOptions(args), /Usage/);
});

test('dry-run previews every change without writing', async () => {
  const f = fakeSeedTx({ models: gemini(), providers: [meituan] });
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261103(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(steps.map(s => `${s.action} ${s.table} ${s.target}`), [
    'update models gemini-2.5-pro',
    'update models google-gemini-gemini-2-5-pro-batch',
    'update models gemini-2.5-flash',
    'skip models google-gemini-gemini-2-5-flash-batch',
    'update providers meituan',
    `insert models ${LONGCAT_SLUG}`,
    `insert api_channel_prices meituan/${LONGCAT_SLUG}`,
  ]);
  // Curated website is kept; only NULL links are filled.
  assert.deepEqual(Object.keys(steps[4].changes).sort(), ['api_docs_url', 'pricing_url']);
  assert.equal(steps[6].changes.model_id.to, -1);
});

test('apply records Gemini deprecation without a shutdown date and adds LongCat-2.5 in CNY; repeatable', async () => {
  const f = fakeSeedTx({ models: gemini(), providers: [meituan] });
  await seedCatalog20261103(f.tx, true);
  for (const [slug, to] of [['gemini-2.5-pro', 'gemini-3.8-flash'], ['google-gemini-gemini-2-5-pro-batch', 'gemini-3.8-flash'], ['gemini-2.5-flash', 'gemini-3.5-flash-lite']]) {
    const row = f.data.models.find(r => r.slug === slug)!;
    assert.equal(row.deprecated_at, '2026-11-02');
    assert.equal(row.replacement_model, to);
    assert.equal(row.deprecation_source_url, GEMINI_CHANGELOG);
    assert.equal(row.shutdown_date, null);
  }
  const lite = f.data.models.find(r => r.slug === 'gemini-2.5-flash-lite')!;
  assert.equal(lite.deprecated_at, null);
  const model = f.data.models.find(r => r.slug === LONGCAT_SLUG)!;
  assert.deepEqual(model.provider_ids, [7]);
  assert.equal(model.context_window, 1_048_576);
  assert.equal(model.max_output_tokens, 262_144);
  const [channel] = f.data.api_channel_prices;
  assert.equal(channel.model_id, model.id);
  assert.equal(channel.provider_id, 7);
  assert.equal(channel.currency, 'CNY');
  assert.deepEqual([channel.input_price_per_1m, channel.cached_input_price_per_1m, channel.output_price_per_1m], [2, 0.04, 8]);
  assert.equal(channel.promo_ends_at, null);
  assert.equal(channel.regular_input_price_per_1m, null);
  assert.equal((channel.last_verified as Date).toISOString(), VERIFIED_AT.toISOString());
  assert.equal(f.data.providers[0].website, 'https://longcat.chat');
  assert.equal(f.data.models.find(r => r.slug === 'meituan-longcat-2-0')!.id, 5);
  const writes = f.writes();
  assert.deepEqual((await seedCatalog20261103(f.tx, true)).filter(s => s.action !== 'skip'), []);
  assert.equal(f.writes(), writes);
});

test('existing shutdown_date is left alone and reported; deprecation fields still recorded', async () => {
  const models = gemini();
  models[0].shutdown_date = '2027-06-17';
  const f = fakeSeedTx({ models, providers: [meituan] });
  const steps = await seedCatalog20261103(f.tx, true);
  assert.ok(steps.some(s => s.action === 'skip' && s.target === 'gemini-2.5-pro' && /shutdown_date is 2027-06-17/.test(s.reason!)));
  assert.equal(f.data.models[0].shutdown_date, '2027-06-17');
  assert.equal(f.data.models[0].replacement_model, 'gemini-3.8-flash');
});

test('missing meituan provider is inserted as an official CNY provider', async () => {
  const f = fakeSeedTx({ models: gemini() });
  await seedCatalog20261103(f.tx, true);
  const [provider] = f.data.providers;
  assert.equal(provider.slug, 'meituan');
  assert.equal(provider.type, 'official');
  assert.equal(provider.currency, 'CNY');
  assert.equal(f.data.api_channel_prices[0].provider_id, provider.id);
});

test('guards: wrong provider type, duplicate rows or a non-canonical LongCat slug abort with nothing written', async () => {
  for (const initial of [
    { models: gemini(), providers: [{ ...meituan, type: 'aggregator' }] },
    { models: [...gemini(), { id: 9, slug: 'gemini-2.5-pro' }], providers: [meituan] },
    { models: [...gemini(), { id: 9, slug: 'longcat-2.5' }], providers: [meituan] },
  ]) {
    const f = fakeSeedTx(initial);
    await assert.rejects(seedCatalog20261103(f.tx, true), /nothing written/i);
    assert.equal(f.writes(), 0);
  }
});

test('row builders carry the verified facts and sources', () => {
  const channel = longcatChannelRow(7, 8);
  assert.match(channel.notes, /限时/);
  assert.match(channel.notes, /未标截止日/);
  assert.match(channel.notes, /\$0\.3 \/ \$0\.006 \/ \$1\.2/);
  assert.match(channel.notes, /longcat\.chat\/platform\/docs\/zh\/pricing\/longcat-2\.5/);
  const model = longcatModelRow(7);
  assert.equal(model.slug, 'meituan-longcat-2-5');
  assert.match(model.description, /262,144/);
  assert.deepEqual(meituanProviderFill({ website: 'x', pricing_url: 'y', api_docs_url: 'z' }), {});
  assert.equal(GEMINI_25.length, 4);
  assert.ok(!GEMINI_25.some(g => g.slug.includes('lite')));
});
