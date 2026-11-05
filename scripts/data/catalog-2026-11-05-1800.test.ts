import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecisionModelCatalog } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { MORPH_REFLEX, MORPH_REFLEX_SPEC } from '../../src/lib/decision-models-2026-11-05';
import { isVerifiedFreeOutput } from '../utils/audit-price-policy';
import {
  ERNIE_SLUG, ERNIE_SOURCES, KIMI_WEIGHTS_SOURCE, VERIFIED_AT,
  catalog202611051800SeedOptions, ernieModelRow, seedCatalog202611051800,
} from './catalog-2026-11-05-1800';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

const providers = [
  { id: 8, slug: 'openrouter', type: 'aggregator', notes: 'keep gateway' },
  { id: 40, slug: 'moonshot-global', type: 'official' },
];
const kimi = { id: 3719, slug: 'moonshotai-kimi-k3-1-pro', open_source: false, description: 'Keep Kimi description.', license: 'custom', provider_ids: [40] };
const kimiChannel = { id: 600, model_id: 3719, provider_id: 40, input_price_per_1m: '2', output_price_per_1m: '10', is_available: true, notes: 'keep channel' };
const initial = () => ({ providers, models: [kimi], api_channel_prices: [kimiChannel],
  api_channel_price_variants: [{ id: 601, model_id: 3719, provider_id: 40, variant_key: 'standard', is_headline: true, notes: 'keep headline' }],
  usage_prices: [{ id: 602, model_id: 3719, price: 9, notes: 'keep usage' }],
});
const mutations = (steps: Awaited<ReturnType<typeof seedCatalog202611051800>>) => steps.filter(s => s.action !== 'skip');

test('1800 CLI defaults to dry-run and rejects mixed/unknown flags', () => {
  assert.equal(catalog202611051800SeedOptions([]).apply, false);
  assert.equal(catalog202611051800SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog202611051800SeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog202611051800SeedOptions(args), /Usage/);
  }
});

test('Morph is a sourced input-only decision catalog entry with no open weights', () => {
  const item = catalogForKind('decision-model').find(i => i.slug === 'morph-reflex')!;
  assert.equal(item, MORPH_REFLEX);
  assert.deepEqual([item.provider, item.providerSlug, MORPH_REFLEX_SPEC.endpoint, MORPH_REFLEX_SPEC.channel], ['Morph', 'morph', 'morph/reflex', 'openrouter']);
  assert.deepEqual([item.inputPricePer1M, MORPH_REFLEX_SPEC.cache, item.outputPricePer1M, item.pricePer1MTasks], [0.042, 0.008, 0, null]);
  assert.equal(item.contextWindow, 65_536);
  assert.deepEqual(item.inputModalities, ['text', 'image']);
  assert.deepEqual(item.access, ['api']);
  assert.equal(MORPH_REFLEX_SPEC.openWeights, false);
  assert.equal(item.releasedAt, '2026-11-03');
  assert.equal(item.lastVerified, '2026-11-05');
  assert.equal(item.sourceUrls?.[0].url, 'https://openrouter.ai/morph/reflex');
  assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-05-1800:apply');
  assert.match(item.notes!, /27B.*choice \/ score.*no text generation/);
  assert.match(item.notes!, /[Ww]eights not published/);
  assert.match(item.pricing, /\$0\.008\/M cache read/);
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items: [item], locale }));
    assert.ok(html.includes(`/${locale}/decision-models/morph-reflex`));
    assert.ok(html.includes('0.042'));
    assert.ok(html.includes('0.008'));
  }
});

test('Morph free-output audit exemption is restricted to this model and OpenRouter', () => {
  assert.equal(isVerifiedFreeOutput('morph-reflex', 'openrouter', 0.042), true);
  for (const input of [0, -1, null]) assert.equal(isVerifiedFreeOutput('morph-reflex', 'openrouter', input), false);
  assert.equal(isVerifiedFreeOutput('morph-reflex', 'morph', 0.042), false);
  assert.equal(isVerifiedFreeOutput('other', 'openrouter', 0.042), false);
});

test('ERNIE records the base checkpoint, max inference context and all license restrictions without prices', () => {
  const row = ernieModelRow(9);
  assert.deepEqual([row.slug, row.open_source, row.parameters, row['active parameters']], [ERNIE_SLUG, true, '280B', '14B']);
  assert.equal(row.context_window, 1_048_576);
  assert.equal(row.released_at.toISOString(), '2026-11-05T00:00:00.000Z');
  assert.equal(row.license, 'ERNIE 5.5 Flash Base Model License v1.0');
  for (const pattern of [/33\.5T/, /no post-training/, /FP8 and BF16/, /131,072 \(128K\)/, /fine-tune\/inference context 1,048,576/, /max inference context/, /EU, UK and South Korea/, />US\$50M.*written commercial license/, /Powered by ERNIE/, /Verified 2026-11-05/]) {
    assert.match(row.description, pattern);
  }
  for (const source of ERNIE_SOURCES) assert.ok(row.description.includes(source));
  assert.equal(row.offical_link, ERNIE_SOURCES[0]);
  assert.ok(!Object.keys(row).some(k => /price/.test(k)));
});

test('preview makes no writes; apply touches only scoped rows, preserves unrelated data and replays to zero changes', async () => {
  const f = fakeSeedTx(initial());
  const before = structuredClone(f.data);
  const preview = await seedCatalog202611051800(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  const applied = await seedCatalog202611051800(f.tx, true);
  assert.deepEqual(applied, preview);
  assert.deepEqual(Object.fromEntries(['providers', 'models', 'api_channel_prices'].map(table => [table, applied.filter(s => s.table === table).length])),
    { providers: 2, models: 3, api_channel_prices: 1 });
  assert.deepEqual(f.data.providers.filter(p => [8, 40].includes(p.id)), providers);
  const morphProvider = f.data.providers.find(p => p.slug === 'morph')!;
  const baidu = f.data.providers.find(p => p.slug === 'baidu')!;
  const reflex = f.data.models.find(m => m.slug === 'morph-reflex')!;
  const ernie = f.data.models.find(m => m.slug === ERNIE_SLUG)!;
  assert.equal(reflex.model_category, 'decision');
  assert.equal(reflex.open_source, false);
  assert.equal(reflex.parameters, '27B');
  assert.deepEqual(reflex.provider_ids, [morphProvider.id]);
  assert.deepEqual(ernie.provider_ids, [baidu.id]);
  assert.ok([reflex, ernie].every(m => String(m.description).includes('2026-11-05') && String(m.offical_link).startsWith('https://')));
  assert.ok([morphProvider, baidu].every(p => String(p.notes).includes('Source: https://')));
  const price = f.data.api_channel_prices.find(c => c.model_id === reflex.id)!;
  assert.deepEqual([price.provider_id, price.input_price_per_1m, price.cached_input_price_per_1m, price.output_price_per_1m], [8, 0.042, 0.008, 0]);
  assert.deepEqual(price.last_verified, VERIFIED_AT);
  assert.ok(String(price.notes).includes(MORPH_REFLEX_SPEC.source));
  assert.equal(f.data.api_channel_prices.some(c => c.model_id === ernie.id), false);
  assert.deepEqual(f.data.api_channel_prices.find(c => c.id === 600), kimiChannel);
  assert.deepEqual(f.data.api_channel_price_variants, before.api_channel_price_variants);
  assert.deepEqual(f.data.usage_prices, before.usage_prices);
  const updatedKimi = f.data.models.find(m => m.id === kimi.id)!;
  assert.equal(updatedKimi.open_source, true);
  assert.equal(updatedKimi.license, 'custom');
  assert.ok(String(updatedKimi.description).startsWith(kimi.description));
  assert.ok(String(updatedKimi.description).includes(KIMI_WEIGHTS_SOURCE));
  const writes = f.writes();
  const replay = await seedCatalog202611051800(f.tx, true);
  assert.deepEqual(mutations(replay), []);
  assert.equal(replay[0].action, 'skip');
  assert.match(replay[0].reason!, /already true; unchanged/);
  assert.equal(f.writes(), writes);
});

test('either Kimi alias is accepted; only false/null/absent open_source changes, already true is untouched', async () => {
  for (const slug of ['moonshotai-kimi-k3-1-pro', 'kimi-k3.1-pro']) {
    for (const open_source of [false, null, undefined, true]) {
      const f = fakeSeedTx({ ...initial(), models: [{ ...kimi, slug, open_source }] });
      const preview = await seedCatalog202611051800(f.tx);
      const step = preview.find(s => s.target === 'kimi-k3.1-pro/open-weights')!;
      assert.equal(step.action, open_source === true ? 'skip' : 'update');
      assert.equal(f.writes(), 0);
      await seedCatalog202611051800(f.tx, true);
      if (open_source === true) assert.deepEqual(f.data.models.find(m => m.id === kimi.id), { ...kimi, slug, open_source });
    }
  }
});

test('existing owners/associations survive, fresh scraper metadata and locked availability are retained', async () => {
  const fresh = { id: 601, model_id: 71, provider_id: 8, input_price_per_1m: '0.042', output_price_per_1m: '0', cached_input_price_per_1m: '0.008',
    last_verified: '2026-11-05T03:17:00+08:00', notes: 'scraper notes', is_available: false, availability_locked: true, regular_input_price_per_1m: 9 };
  const f = fakeSeedTx({ ...initial(), providers: [...providers, { id: 70, slug: 'morph', type: 'producer', notes: 'curated' }, { id: 72, slug: 'baidu', type: 'official' }],
    models: [kimi, { id: 71, slug: 'morph-reflex', provider_ids: [99, 70], max_output_tokens: 90 }, { id: 73, slug: ERNIE_SLUG, provider_ids: [99], max_output_tokens: 80 }],
    api_channel_prices: [kimiChannel, fresh, { id: 602, model_id: 71, provider_id: 99, notes: 'other channel' }],
  });
  await seedCatalog202611051800(f.tx, true);
  assert.deepEqual(f.data.providers.find(p => p.id === 70), { id: 70, slug: 'morph', type: 'producer', notes: 'curated' });
  assert.deepEqual(f.data.models.find(m => m.id === 71)!.provider_ids, [99, 70]);
  assert.deepEqual(f.data.models.find(m => m.id === 73)!.provider_ids, [99, 72]);
  assert.equal(f.data.models.find(m => m.id === 71)!.max_output_tokens, 90);
  const price = f.data.api_channel_prices.find(c => c.id === 601)!;
  assert.equal(price.last_verified, fresh.last_verified);
  assert.equal(price.notes, fresh.notes);
  assert.equal(price.is_available, false);
  assert.equal(price.regular_input_price_per_1m, 9);
  assert.deepEqual(f.data.api_channel_prices.find(c => c.id === 602), { id: 602, model_id: 71, provider_id: 99, notes: 'other channel' });
  assert.deepEqual(mutations(await seedCatalog202611051800(f.tx, true)), []);
});

test('stale Morph channel gets verified price/cache, date and source', async () => {
  const f = fakeSeedTx({ ...initial(), models: [kimi, { id: 71, slug: 'morph-reflex' }], api_channel_prices: [kimiChannel,
    { id: 601, model_id: 71, provider_id: 8, input_price_per_1m: 5, cached_input_price_per_1m: null, last_verified: '2026-11-04', notes: 'old' }],
  });
  await seedCatalog202611051800(f.tx, true);
  const price = f.data.api_channel_prices.find(c => c.id === 601)!;
  assert.deepEqual(price.last_verified, VERIFIED_AT);
  assert.equal(price.cached_input_price_per_1m, 0.008);
  assert.ok(String(price.notes).includes(MORPH_REFLEX_SPEC.source));
});

test('ambiguous identities, wrong owner types and noncanonical new models abort before any writes', async () => {
  const invalid: { providers?: FakeRow[]; models?: FakeRow[] }[] = [
    { models: [] },
    { models: [kimi, { ...kimi, id: 99, slug: 'kimi-k3.1-pro' }] },
    { models: [kimi, { id: 71, slug: 'reflex' }] },
    { models: [kimi, { id: 71, slug: 'morph/reflex' }] },
    { models: [kimi, { id: 71, slug: 'baidu-ernie-5-5-flash-base' }] },
    { models: [kimi, { id: 71, slug: ERNIE_SLUG }, { id: 72, slug: ERNIE_SLUG }] },
    { providers: providers.filter(p => p.slug !== 'moonshot-global') },
    { providers: providers.filter(p => p.slug !== 'openrouter') },
    { providers: [...providers, { id: 9, slug: 'openrouter', type: 'aggregator' }] },
    { providers: providers.map(p => p.slug === 'openrouter' ? { ...p, type: 'producer' } : p) },
    { providers: providers.map(p => p.slug === 'moonshot-global' ? { ...p, type: 'aggregator' } : p) },
    { providers: [...providers, { id: 9, slug: 'morph', type: 'aggregator' }] },
    { providers: [...providers, { id: 9, slug: 'baidu', type: 'aggregator' }] },
  ];
  for (const overrides of invalid) {
    const f = fakeSeedTx({ ...initial(), ...overrides });
    await assert.rejects(seedCatalog202611051800(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('Kimi channel guards match headline seed; duplicate Morph channels also abort before writes', async () => {
  const cases = [[], [kimiChannel, { ...kimiChannel, id: 9 }], [{ ...kimiChannel, input_price_per_1m: '3' }],
    [{ ...kimiChannel, output_price_per_1m: '11' }], [{ ...kimiChannel, is_available: false }],
    [kimiChannel, { id: 9, model_id: 71, provider_id: 8 }, { id: 10, model_id: 71, provider_id: 8 }],
  ];
  for (const channels of cases) {
    const f = fakeSeedTx({ ...initial(), models: [kimi, { id: 71, slug: 'morph-reflex' }], api_channel_prices: channels });
    await assert.rejects(seedCatalog202611051800(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});
