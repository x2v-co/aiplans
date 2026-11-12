import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXISTING_PRODUCTION_SLUGS, LISTINGS, NEW_PRODUCTION_SLUGS, PRODUCTION_SHAPED_DRY_RUN,
  PROVIDER_NOTES, PROVIDER_SLUG, catalog20261112CysuoSeedOptions, headlineSupplier,
  seedCatalog20261112Cysuo, seedStepCounts, variantKey,
} from './catalog-2026-11-12-cysuo';
import { fakeSeedTx } from './fake-seed-tx';

const baidu = { id: 5, slug: 'baidu', name: '百度 (ERNIE)', type: 'official', notes: 'keep-baidu' };
const baiduGlobal = { id: 6, slug: 'baidu-global', name: 'Baidu Qianfan International', type: 'official', notes: 'keep-global' };
const existingModels = EXISTING_PRODUCTION_SLUGS.map((slug, index) => ({
  id: 20 + index, slug, name: slug, type: 'llm', provider_ids: [5],
}));

const productionShaped = () => fakeSeedTx({
  providers: [baidu, baiduGlobal],
  models: existingModels,
});

test('11-12 cysuo CLI defaults to dry-run and rejects mixed or unknown flags', () => {
  assert.equal(catalog20261112CysuoSeedOptions([]).apply, false);
  assert.equal(catalog20261112CysuoSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261112CysuoSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog20261112CysuoSeedOptions(args), /Usage/);
  }
});

test('verified listings cover 12 text models and 42 supplier prices', () => {
  assert.equal(LISTINGS.length, 12);
  assert.equal(LISTINGS.reduce((sum, row) => sum + row.suppliers.length, 0), 42);
  assert.deepEqual(EXISTING_PRODUCTION_SLUGS, [
    'deepseek-v4.1-flash', 'deepseek-v4-flash', 'deepseek-v4-pro',
    'glm-5.1', 'glm-5.2', 'glm-5.3', 'glm-5.3-flash', 'kimi-k3', 'ernie-5.1',
  ]);
  assert.deepEqual(NEW_PRODUCTION_SLUGS, [
    'deepseek-v4.1-flash-1017', 'deepseek-v4-flash-0731', 'deepseek-v4-pro-0813',
  ]);
  const glm = LISTINGS.find(row => row.slug === 'glm-5.3')!;
  assert.equal(glm.suppliers.length, 10);
  assert.equal(glm.listedSupplierCount, 12);
});

test('headline is the lowest output, then lowest input, matching 最低可用价', () => {
  const flash = LISTINGS.find(row => row.slug === 'deepseek-v4.1-flash')!;
  const headline = headlineSupplier(flash.suppliers);
  assert.equal(headline.providerId, '1021');
  assert.deepEqual([headline.input, headline.output, headline.cache], [0.74, 2.96, 0.0148]);
  const glmFlash = LISTINGS.find(row => row.slug === 'glm-5.3-flash')!;
  assert.deepEqual(
    [headlineSupplier(glmFlash.suppliers).input, headlineSupplier(glmFlash.suppliers).output],
    [0.4, 1.4],
  );
});

test('production-shaped dry-run inserts cysuo, three dated models, 12 channels and 42 variants', async () => {
  const f = productionShaped();
  const baiduNotes = f.data.providers.map(row => [row.slug, row.notes]);
  const steps = await seedCatalog20261112Cysuo(f.tx, true);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  const provider = f.data.providers.find(row => row.slug === PROVIDER_SLUG)!;
  assert.equal(provider.type, 'aggregator');
  assert.equal(provider.currency, 'CNY');
  assert.equal(provider.region, 'china');
  assert.equal(provider.access_from_china, true);
  assert.equal(provider.supported_regions, null);
  assert.match(String(provider.notes), /海外可用性未核实/);
  assert.match(String(provider.notes), /北京百度网讯科技有限公司/);
  assert.equal(PROVIDER_NOTES, provider.notes);
  assert.deepEqual(
    f.data.providers.filter(row => row.slug !== PROVIDER_SLUG).map(row => [row.slug, row.notes]),
    baiduNotes,
  );

  for (const slug of NEW_PRODUCTION_SLUGS) {
    const model = f.data.models.find(row => row.slug === slug)!;
    assert.equal(model.type, 'llm');
    assert.equal(model.model_category, 'text');
    assert.deepEqual(model.provider_ids, [provider.id]);
  }
  for (const slug of EXISTING_PRODUCTION_SLUGS) {
    const model = f.data.models.find(row => row.slug === slug)!;
    assert.deepEqual(model.provider_ids, [5, provider.id]);
    assert.equal(model.name, slug, 'existing model metadata is not rewritten');
  }

  assert.equal(f.data.api_channel_prices.length, 12);
  const flash = f.data.models.find(row => row.slug === 'deepseek-v4.1-flash')!;
  const channel = f.data.api_channel_prices.find(row => row.model_id === flash.id && row.provider_id === provider.id)!;
  assert.equal(channel.currency, 'CNY');
  assert.equal(channel.input_price_per_1m, 0.74);
  assert.equal(channel.output_price_per_1m, 2.96);
  assert.equal(channel.cached_input_price_per_1m, 0.0148);
  const variants = f.data.api_channel_price_variants.filter(row => row.model_id === flash.id);
  assert.equal(variants.length, 5);
  assert.equal(variants.filter(row => row.is_headline).length, 1);
  const head = variants.find(row => row.variant_key === variantKey('1021'))!;
  assert.equal(head.is_headline, true);
  assert.equal(head.variant_kind, 'upstream_provider');
  assert.equal(head.variant_name, '博川科技');

  const ernie = f.data.models.find(row => row.slug === 'ernie-5.1')!;
  const ernieChannel = f.data.api_channel_prices.find(row => row.model_id === ernie.id)!;
  assert.equal(ernieChannel.input_price_per_1m, 4);
  assert.equal(ernieChannel.output_price_per_1m, 18);
  assert.equal(ernieChannel.cached_input_price_per_1m, null);

  const again = await seedCatalog20261112Cysuo(f.tx, true);
  assert.deepEqual(again.filter(step => step.action !== 'skip'), []);
});

test('wrong cysuo provider type fails; fresher channel prices are left alone', async () => {
  const wrong = fakeSeedTx({
    providers: [{ id: 9, slug: PROVIDER_SLUG, type: 'official' }, baidu],
    models: existingModels,
  });
  await assert.rejects(() => seedCatalog20261112Cysuo(wrong.tx, true), /has type official/);
  assert.equal(wrong.writes(), 0);

  const f = productionShaped();
  const first = await seedCatalog20261112Cysuo(f.tx, true);
  assert.ok(first.some(step => step.action === 'insert'));
  const provider = f.data.providers.find(row => row.slug === PROVIDER_SLUG)!;
  const flash = f.data.models.find(row => row.slug === 'deepseek-v4.1-flash')!;
  const channel = f.data.api_channel_prices.find(row => row.model_id === flash.id && row.provider_id === provider.id)!;
  channel.input_price_per_1m = 9.99;
  channel.last_verified = new Date('2026-11-13T00:00:00Z');
  const steps = await seedCatalog20261112Cysuo(f.tx, true);
  assert.ok(!steps.some(step => step.target === 'cysuo/deepseek-v4.1-flash' && step.action !== 'skip'));
  assert.equal(
    f.data.api_channel_prices.find(row => row.id === channel.id)?.input_price_per_1m,
    9.99,
  );
});
