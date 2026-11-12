import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BAIDU_PROVIDER, BILLING_PAGE, CREATE_API_PAGE, CREATE_API_PATH, CURRENCY,
  LIST_PRICE_CNY_PER_SECOND, LOOKUP_SLUGS, MODEL_FACTS, MODEL_ID, MODEL_LIST_PAGE,
  MODEL_NAME, MODEL_NAME_ZH, MODEL_SLUG, PRICE_KIND, PRICE_UNIT, PRICING_UNIT,
  PRODUCTION_SHAPED_DRY_RUN, PRODUCT_PAGE, catalog20261112ErnieWizshotMeSeedOptions,
  seedCatalog20261112ErnieWizshotMe, seedStepCounts,
} from './catalog-2026-11-12-ernie-wizshot-me';
import { fakeSeedTx } from './fake-seed-tx';

const baidu = { id: 5, slug: 'baidu', name: '百度 (ERNIE)', type: 'official', notes: 'keep-baidu' };
const baiduGlobal = { id: 6, slug: 'baidu-global', name: 'Baidu Qianfan International', type: 'official' };
const productionShaped = () => fakeSeedTx({ providers: [baidu, baiduGlobal], models: [] });

test('CLI defaults to dry-run, :apply is separate, and mixed flags are rejected', () => {
  assert.equal(catalog20261112ErnieWizshotMeSeedOptions([]).apply, false);
  assert.equal(catalog20261112ErnieWizshotMeSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261112ErnieWizshotMeSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog20261112ErnieWizshotMeSeedOptions(args), /Usage/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-12-ernie-wizshot-me'], 'tsx scripts/seed-catalog-2026-11-12-ernie-wizshot-me.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-12-ernie-wizshot-me:apply'], 'tsx scripts/seed-catalog-2026-11-12-ernie-wizshot-me.ts --apply');
  const deploy = readFileSync(new URL('../../deploy/production/seed-catalog.sh', import.meta.url), 'utf8');
  assert.equal(deploy.includes('ernie-wizshot-me'), false);
});

test('official name, 接入点 ID, unit and list price match the cited Qianfan pages', () => {
  assert.equal(MODEL_NAME, 'ERNIE-Wizshot-ME');
  assert.equal(MODEL_NAME_ZH, '文心一镜微表情大模型');
  assert.equal(MODEL_ID, 'ernie-wizshot-me');
  assert.equal(MODEL_SLUG, 'ernie-wizshot-me');
  assert.equal(LIST_PRICE_CNY_PER_SECOND, 0.7);
  assert.equal(CURRENCY, 'CNY');
  assert.equal(PRICING_UNIT, 'per_second');
  assert.equal(PRICE_KIND, 'video_second');
  assert.equal(PRICE_UNIT, 'second');
  assert.equal(BAIDU_PROVIDER, 'baidu');
  assert.equal(BILLING_PAGE, 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya');
  assert.equal(MODEL_LIST_PAGE, 'https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j');
  assert.equal(CREATE_API_PAGE, 'https://cloud.baidu.com/doc/qianfan-api/s/8mwbylac7');
  assert.equal(CREATE_API_PATH, 'https://qianfan.baidubce.com/v2/mm/ernie/ernie-wizshot-me');
  assert.match(MODEL_FACTS, /0\.7 元 \/ 1 秒/);
  assert.match(MODEL_FACTS, /不是蒸汽机 Air 的积分定价/);
  assert.match(MODEL_FACTS, /4s ~ 16s/);
  assert.match(MODEL_FACTS, /4–15s、1080p/);
  assert.ok(LOOKUP_SLUGS.includes('baidu-ernie-wizshot-me'));
  assert.ok(LOOKUP_SLUGS.includes(MODEL_SLUG));
  assert.match(PRODUCT_PAGE, /product\/qianfan/);
});

test('production-shaped dry-run inserts the video model and CNY per-second usage price, without a new provider', async () => {
  const { tx, data, writes } = productionShaped();
  const steps = await seedCatalog20261112ErnieWizshotMe(tx, false);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(writes(), 0, 'dry-run must not write');
  assert.equal(data.providers.filter(row => row.slug === 'baidu').length, 1);
  assert.equal(data.providers.filter(row => row.slug === 'qianfan' || row.slug === 'baidu-global').length, 1);
  assert.equal(data.models.length, 0);
  assert.equal(data.usage_prices.length, 0);
  const applied = await seedCatalog20261112ErnieWizshotMe(tx, true);
  assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(await seedCatalog20261112ErnieWizshotMe(tx, false), [], 'second dry-run after apply is empty');
  assert.equal(data.providers.length, 2);
  const model = data.models[0];
  assert.equal(model.slug, MODEL_SLUG);
  assert.equal(model.name, MODEL_NAME);
  assert.equal(model.type, 'multimodal');
  assert.equal(model.model_category, 'video');
  assert.equal(model.pricing_unit, PRICING_UNIT);
  assert.deepEqual(model.provider_ids, [baidu.id]);
  assert.deepEqual(model.input_modalities, ['text', 'image', 'audio']);
  assert.deepEqual(model.output_modalities, ['video']);
  const usage = data.usage_prices[0];
  assert.equal(usage.model_id, model.id);
  assert.equal(usage.provider_id, baidu.id);
  assert.equal(usage.plan_id, null);
  assert.equal(usage.price_kind, PRICE_KIND);
  assert.equal(usage.unit, PRICE_UNIT);
  assert.equal(usage.price, 0.7);
  assert.equal(usage.currency, 'CNY');
  assert.equal(usage.source_url, BILLING_PAGE);
  assert.equal(data.api_channel_prices.length, 0);
});

test('an existing production alias is attached in place; slug is not rewritten and no second model is inserted', async () => {
  const existing = {
    id: 42, slug: 'baidu-ernie-wizshot-me', name: 'Old name', type: 'multimodal',
    model_category: 'video', provider_ids: [99], description: 'prior', offical_link: 'https://example.com',
  };
  const { tx, data } = fakeSeedTx({ providers: [baidu], models: [existing] });
  const steps = await seedCatalog20261112ErnieWizshotMe(tx, true);
  assert.deepEqual(seedStepCounts(steps), {
    providers: { insert: 0, update: 0 },
    models: { insert: 0, update: 1 },
    usage_prices: { insert: 1, update: 0 },
    api_channel_prices: { insert: 0, update: 0 },
    api_channel_price_variants: { insert: 0, update: 0 },
  });
  assert.equal(data.models.length, 1);
  assert.equal(data.models[0].slug, 'baidu-ernie-wizshot-me');
  assert.equal(data.models[0].name, 'Old name');
  assert.deepEqual(data.models[0].provider_ids, [99, baidu.id]);
  assert.equal(data.models[0].pricing_unit, PRICING_UNIT);
  assert.equal(data.models[0].offical_link, 'https://example.com');
  assert.match(String(data.models[0].description), /prior/);
  assert.equal(data.usage_prices[0].model_id, 42);
  assert.equal(data.usage_prices[0].price, 0.7);
});

test('two matching lookup slugs, a missing baidu row, or the wrong provider type abort with nothing written', async () => {
  const clash = fakeSeedTx({
    providers: [baidu],
    models: [
      { id: 1, slug: 'ernie-wizshot-me', name: 'A', provider_ids: [] },
      { id: 2, slug: 'baidu-ernie-wizshot-me', name: 'B', provider_ids: [] },
    ],
  });
  await assert.rejects(() => seedCatalog20261112ErnieWizshotMe(clash.tx, true), /Ambiguous/);
  assert.equal(clash.writes(), 0);

  const missing = fakeSeedTx({ providers: [baiduGlobal], models: [] });
  await assert.rejects(() => seedCatalog20261112ErnieWizshotMe(missing.tx, true), /missing providers\/baidu/);
  assert.equal(missing.writes(), 0);

  const wrong = fakeSeedTx({ providers: [{ id: 5, slug: 'baidu', type: 'aggregator' }], models: [] });
  await assert.rejects(() => seedCatalog20261112ErnieWizshotMe(wrong.tx, true), /has type aggregator/);
  assert.equal(wrong.writes(), 0);
  assert.equal(wrong.data.models.length, 0);
});

test('a newer verified usage price is kept, and a later dry-run does not overwrite it', async () => {
  const { tx, data } = productionShaped();
  await seedCatalog20261112ErnieWizshotMe(tx, true);
  const usage = data.usage_prices[0];
  usage.price = 0.9;
  usage.last_verified = new Date('2026-11-13T00:00:00Z');
  const steps = await seedCatalog20261112ErnieWizshotMe(tx, true);
  assert.equal(steps.filter(step => step.table === 'usage_prices').length, 0);
  assert.equal(data.usage_prices[0].price, 0.9);
});
