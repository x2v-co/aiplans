import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  INKLING_CHANNEL_NOTES, INKLING_CONTEXT, INKLING_FACTS, INKLING_MODELS_JSON, INKLING_NEWS, INKLING_PRICE_PAGE,
  INKLING_SERVERLESS_JSON, INKLING_SLUG, INKLING_TRAIN, LING_CHANNEL_NOTES, LING_CONTEXT, LING_FACTS, LING_MODEL_PAGE,
  LING_PRICE_PAGE, LING_SLUG, PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT, catalog20261106LingInklingSeedOptions,
  seedCatalog20261106LingInkling, seedStepCounts,
} from './catalog-2026-11-06-ling-inkling';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { isVerifiedFreePrice } from '../utils/audit-price-policy';

const inclusionai = {
  id: 4, slug: 'inclusionai', name: 'inclusionai', type: 'producer', website: 'https://existing.example',
  supported_regions: ['CN'], regions_source_url: 'https://kept.example/regions', regions_verified_at: '2026-11-05T00:00:00.000Z',
};
const thinkingmachines = { id: 8, slug: 'thinkingmachines', name: 'thinkingmachines', type: 'official', pricing_url: null, supported_regions: null };
const neighbors = (): FakeRow[] => [
  { id: 11, slug: 'inclusionai-ling-3-1-flash', provider_ids: [4], name: 'Ling 3.1 Flash' },
  { id: 12, slug: 'thinkingmachines-inkling', provider_ids: [8], name: 'Inkling' },
  { id: 13, slug: 'thinkingmachines-inkling-small', provider_ids: [8], name: 'Inkling Small' },
];

function shaped() {
  return fakeSeedTx({ providers: [inclusionai, thinkingmachines], models: neighbors() });
}

test('CLI defaults to dry-run, :apply is separate, and rehearsal is the write path', () => {
  assert.equal(catalog20261106LingInklingSeedOptions([]).apply, false);
  assert.equal(catalog20261106LingInklingSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261106LingInklingSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261106LingInklingSeedOptions(args), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-06-ling-inkling'], 'tsx scripts/seed-catalog-2026-11-06-ling-inkling.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-06-ling-inkling:apply'], 'tsx scripts/seed-catalog-2026-11-06-ling-inkling.ts --apply');
  const cli = readFileSync(new URL('../seed-catalog-2026-11-06-ling-inkling.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable/);
  assert.doesNotMatch(cli, /READ ONLY/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /ling-inkling/);
  }
});

test('published prices and explicit NULLs match the cited pages', () => {
  assert.equal(LING_CONTEXT, 1_000_000);
  assert.equal(INKLING_CONTEXT, 262_144);
  assert.deepEqual(INKLING_TRAIN.map(rate => [rate.priceKind, rate.price, rate.context, rate.contextTokens]), [
    ['train 64K', 1.5, '64K', null],
    ['train 256K', 3, '256K', 262_144],
  ]);
  assert.match(LING_CHANNEL_NOTES, /input 0, output 0/);
  assert.match(LING_CHANNEL_NOTES, /promo_ends_at NULL/);
  assert.match(LING_CHANNEL_NOTES, /2026-11-19 was not inferred/);
  assert.match(LING_CHANNEL_NOTES, /cached_input_price_per_1m NULL/);
  assert.match(LING_CHANNEL_NOTES, /Currency CNY/);
  assert.match(LING_CHANNEL_NOTES, new RegExp(LING_PRICE_PAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(LING_FACTS, /1000000 versus 1048576/);
  assert.match(LING_FACTS, /weights and licence are not stated/);
  assert.match(INKLING_CHANNEL_NOTES, /\$0\.30/);
  assert.match(INKLING_CHANNEL_NOTES, /\$0\.03/);
  assert.match(INKLING_CHANNEL_NOTES, /\$1\.00/);
  assert.match(INKLING_CHANNEL_NOTES, /\$1\.50/);
  assert.match(INKLING_CHANNEL_NOTES, /\$3\.00/);
  assert.match(INKLING_CHANNEL_NOTES, /per million tokens/);
  assert.match(INKLING_CHANNEL_NOTES, new RegExp(INKLING_MODELS_JSON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(INKLING_CHANNEL_NOTES, new RegExp(INKLING_SERVERLESS_JSON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(INKLING_FACTS, /open_source is false and license is NULL/);
  assert.match(INKLING_FACTS, /65536 is not stored/);
  assert.equal(isVerifiedFreePrice(LING_SLUG, 'inclusionai'), true);
  assert.equal(isVerifiedFreePrice(LING_SLUG, 'openrouter'), false);
  assert.equal(isVerifiedFreePrice('inclusionai-ling-3-1-flash', 'inclusionai'), false);
  assert.equal(isVerifiedFreePrice(INKLING_SLUG, 'thinkingmachines'), false);
});

test('production-shaped dry-run previews 2 models, 2 channels and 2 train rates without writing', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261106LingInkling(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(steps.map(step => `${step.action} ${step.table} ${step.target}`), [
    `insert models ${LING_SLUG}`,
    `insert models ${INKLING_SLUG}`,
    `insert api_channel_prices inclusionai/${LING_SLUG}`,
    `insert api_channel_prices thinkingmachines/${INKLING_SLUG}`,
    `insert usage_prices ${INKLING_SLUG}/train 64K`,
    `insert usage_prices ${INKLING_SLUG}/train 256K`,
  ]);
  const lingChannel = steps.find(step => step.target === `inclusionai/${LING_SLUG}`)!;
  assert.equal(lingChannel.changes.input_price_per_1m.to, 0);
  assert.equal(lingChannel.changes.output_price_per_1m.to, 0);
  assert.equal(lingChannel.changes.cached_input_price_per_1m.to, null);
  assert.equal(lingChannel.changes.promo_ends_at.to, null);
  assert.equal(lingChannel.changes.regular_input_price_per_1m.to, null);
  assert.equal(lingChannel.changes.regular_output_price_per_1m.to, null);
  assert.equal(lingChannel.changes.regular_cached_input_price_per_1m.to, null);
  assert.equal(lingChannel.changes.currency.to, 'CNY');
  assert.equal(lingChannel.changes.model_id.to, -1);
  const inklingChannel = steps.find(step => step.target === `thinkingmachines/${INKLING_SLUG}`)!;
  assert.deepEqual([
    inklingChannel.changes.input_price_per_1m.to,
    inklingChannel.changes.cached_input_price_per_1m.to,
    inklingChannel.changes.output_price_per_1m.to,
    inklingChannel.changes.currency.to,
  ], [0.3, 0.03, 1, 'USD']);
  const lingModel = steps.find(step => step.target === LING_SLUG)!;
  assert.equal(lingModel.changes.open_source.to, null);
  assert.equal(lingModel.changes.license.to, null);
  assert.equal(lingModel.changes.context_window.to, LING_CONTEXT);
  assert.equal(lingModel.changes['active parameters'].to, '25B');
  assert.deepEqual(lingModel.changes.input_modalities.to, ['text', 'image', 'video']);
  const inklingModel = steps.find(step => step.target === INKLING_SLUG)!;
  assert.equal(inklingModel.changes.open_source.to, false);
  assert.equal(inklingModel.changes.license.to, null);
  assert.equal(inklingModel.changes.offical_link.to, INKLING_NEWS);
  assert.equal(inklingModel.changes.context_window.to, INKLING_CONTEXT);
  assert.ok(!('supported_regions' in lingModel.changes));
  assert.ok(!('supported_regions' in inklingModel.changes));
});

test('apply reuses providers, writes both models, and a second apply is a no-op', async () => {
  const f = shaped();
  const steps = await seedCatalog20261106LingInkling(f.tx, true);
  assert.equal(f.data.providers.length, 2);
  const keptInclusion = f.data.providers.find(row => row.slug === 'inclusionai')!;
  assert.equal(keptInclusion.website, 'https://existing.example');
  assert.deepEqual(keptInclusion.supported_regions, ['CN']);
  assert.equal(keptInclusion.regions_source_url, 'https://kept.example/regions');
  assert.equal(f.data.providers.find(row => row.slug === 'thinkingmachines')!.pricing_url, null);
  assert.equal(steps.some(step => step.table === 'providers'), false);
  const ling = f.data.models.find(row => row.slug === LING_SLUG)!;
  const inkling = f.data.models.find(row => row.slug === INKLING_SLUG)!;
  assert.deepEqual(ling.provider_ids, [4]);
  assert.deepEqual(inkling.provider_ids, [8]);
  assert.equal(ling.name, 'Ling-3.2-flash');
  assert.equal(inkling.name, 'Inkling 2 Small');
  assert.equal(ling.parameters, '560B');
  assert.equal(ling['active parameters'], '25B');
  assert.equal(inkling.parameters, '594B');
  assert.equal(inkling['active parameters'], '17B');
  assert.equal(ling.open_source, null);
  assert.equal(inkling.open_source, false);
  assert.equal(ling.license, null);
  assert.equal(inkling.license, null);
  assert.deepEqual(ling.input_modalities, ['text', 'image', 'video']);
  assert.deepEqual(ling.output_modalities, ['text']);
  assert.deepEqual(inkling.input_modalities, ['text', 'image']);
  assert.deepEqual(ling.capabilities, ['reasoning', 'tool-calling', 'vision']);
  assert.deepEqual(inkling.capabilities, ['reasoning', 'vision']);
  assert.equal(ling.offical_link, LING_MODEL_PAGE);
  const lingChannel = f.data.api_channel_prices.find(row => row.model_id === ling.id)!;
  assert.equal(lingChannel.provider_id, 4);
  assert.deepEqual([lingChannel.input_price_per_1m, lingChannel.output_price_per_1m, lingChannel.cached_input_price_per_1m], [0, 0, null]);
  assert.equal(lingChannel.currency, 'CNY');
  assert.equal(lingChannel.promo_ends_at, null);
  assert.equal(lingChannel.regular_input_price_per_1m, null);
  assert.equal(lingChannel.notes, LING_CHANNEL_NOTES);
  assert.equal((lingChannel.last_verified as Date).toISOString(), VERIFIED_AT.toISOString());
  const inklingChannel = f.data.api_channel_prices.find(row => row.model_id === inkling.id)!;
  assert.equal(inklingChannel.provider_id, 8);
  assert.deepEqual([inklingChannel.input_price_per_1m, inklingChannel.cached_input_price_per_1m, inklingChannel.output_price_per_1m], [0.3, 0.03, 1]);
  assert.equal(inklingChannel.currency, 'USD');
  assert.equal(inklingChannel.notes, INKLING_CHANNEL_NOTES);
  const trains = f.data.usage_prices.filter(row => row.model_id === inkling.id);
  assert.deepEqual(trains.map(row => [row.price_kind, row.price, row.currency, row.unit, row.source_url]), [
    ['train 64K', 1.5, 'USD', 'per_1m_tokens', INKLING_MODELS_JSON],
    ['train 256K', 3, 'USD', 'per_1m_tokens', INKLING_MODELS_JSON],
  ]);
  assert.equal((trains[0].constraints_json as { context_tokens: number | null }).context_tokens, null);
  assert.equal((trains[1].constraints_json as { tinker_id: string }).tinker_id, 'thinkingmachines/Inkling-2-Small:peft:262144');
  assert.deepEqual(f.data.models.filter(row => ['inclusionai-ling-3-1-flash', 'thinkingmachines-inkling', 'thinkingmachines-inkling-small'].includes(String(row.slug))).map(row => row.id), [11, 12, 13]);
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261106LingInkling(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('missing providers are inserted without a region, and existing curated fields are kept on the model', async () => {
  const created = fakeSeedTx({ models: neighbors() });
  await seedCatalog20261106LingInkling(created.tx, true);
  assert.deepEqual(created.data.providers.map(row => [row.slug, row.type, row.region, row.access_from_china, row.supported_regions, row.regions_source_url, row.regions_verified_at]), [
    ['inclusionai', 'official', null, null, null, null, null],
    ['thinkingmachines', 'official', null, null, null, null, null],
  ]);
  assert.equal(created.data.models.find(row => row.slug === LING_SLUG)!.provider_ids[0], created.data.providers[0].id);
  assert.match(String(created.data.providers[0].notes), /supported_regions/);
  assert.match(String(created.data.providers[0].pricing_url), /developer\.ant-ling\.com/);
  assert.equal(created.data.providers[1].pricing_url, INKLING_PRICE_PAGE);

  const curated = fakeSeedTx({
    providers: [inclusionai, thinkingmachines],
    models: [...neighbors(), {
      id: 21, slug: LING_SLUG, provider_ids: [4, 99], offical_link: 'https://kept.example', description: 'Arena note.',
      capabilities: ['leaderboard'], open_source: null, license: null,
    }],
  });
  const steps = await seedCatalog20261106LingInkling(curated.tx, true);
  const ling = curated.data.models.find(row => row.slug === LING_SLUG)!;
  assert.equal(ling.offical_link, 'https://kept.example');
  assert.deepEqual(ling.provider_ids, [4, 99]);
  assert.ok(String(ling.description).startsWith('Arena note.'));
  assert.match(String(ling.description), /Catalog 2026-11-06 Ling-3\.2-flash/);
  assert.deepEqual(ling.capabilities, ['leaderboard', 'reasoning', 'tool-calling', 'vision']);
  assert.equal(steps.some(step => step.table === 'providers'), false);
  assert.deepEqual(await seedCatalog20261106LingInkling(curated.tx, true), []);
});

test('a locked-off channel stays unavailable', async () => {
  const f = fakeSeedTx({
    providers: [inclusionai, thinkingmachines],
    models: [...neighbors(), { id: 30, slug: INKLING_SLUG, provider_ids: [8], description: INKLING_FACTS, offical_link: INKLING_NEWS, capabilities: ['reasoning', 'vision'], open_source: false, license: null, license_url: null, parameters: '594B', 'active parameters': '17B', context_window: INKLING_CONTEXT, type: 'llm', model_category: 'text', name: 'Inkling 2 Small', input_modalities: ['text', 'image'], output_modalities: ['text'], input_type: ['text', 'image'], output_type: ['text'], pricing_unit: 'per_1m_tokens', released_at: new Date('2026-11-05T00:00:00Z') }],
    api_channel_prices: [{
      id: 70, model_id: 30, provider_id: 8, is_available: false, availability_locked: true,
      input_price_per_1m: 0.3, output_price_per_1m: 1, cached_input_price_per_1m: 0.03,
      currency: 'USD', price_unit: 'per_1m_tokens', notes: INKLING_CHANNEL_NOTES, last_verified: VERIFIED_AT,
      promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    }],
  });
  await seedCatalog20261106LingInkling(f.tx, true);
  assert.equal(f.data.api_channel_prices.find(row => row.id === 70)!.is_available, false);
});

test('wrong provider type, duplicate rows or a non-canonical slug abort with nothing written', async () => {
  const cases = [
    { providers: [{ ...inclusionai, type: 'aggregator' }, thinkingmachines], models: neighbors() },
    { providers: [inclusionai, { ...thinkingmachines, type: 'reseller' }], models: neighbors() },
    { providers: [inclusionai, thinkingmachines], models: [...neighbors(), { id: 40, slug: LING_SLUG }, { id: 41, slug: LING_SLUG }] },
    { providers: [inclusionai, thinkingmachines], models: [...neighbors(), { id: 42, slug: 'inkling-2-small' }] },
    { providers: [inclusionai, thinkingmachines], models: [...neighbors(), { id: 43, slug: 'ling-3.2-flash' }] },
  ];
  for (const initial of cases) {
    const f = fakeSeedTx(initial);
    await assert.rejects(seedCatalog20261106LingInkling(f.tx, true), /nothing written/i);
    assert.equal(f.writes(), 0);
  }
});
