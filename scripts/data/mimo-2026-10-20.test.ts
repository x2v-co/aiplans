import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeSeedTx } from './fake-seed-tx';
import { MIMO_BATCH, MIMO_REALTIME, mimoSeedOptions, seedMimo20261020 } from './mimo-2026-10-20';

const BEFORE = new Date('2026-10-20T08:00:00Z');
const AFTER = new Date('2026-10-21T03:00:00Z');
const models = [
  { id: 1, slug: 'xiaomi-mimo-v2-5', shutdown_date: null, replacement_model: null, deprecation_source_url: null },
  { id: 2, slug: 'xiaomi-mimo-v2-5-pro', shutdown_date: null, replacement_model: null, deprecation_source_url: null },
  { id: 3, slug: 'xiaomi-mimo-v2-6-pro', shutdown_date: null, replacement_model: null, deprecation_source_url: null },
  { id: 4, slug: 'xiaomi-mimo-v2-6-flash', shutdown_date: null, replacement_model: null, deprecation_source_url: null },
  { id: 5, slug: 'xiaomi-mimo-v2-6-pro-ultraspeed', shutdown_date: null, replacement_model: null, deprecation_source_url: null },
];

test('verified official prices: batch is exactly half of real-time', () => {
  for (const tier of ['pro', 'flash'] as const) for (const cluster of ['china', 'global'] as const) {
    const r = MIMO_REALTIME[tier][cluster]; const b = MIMO_BATCH[tier]![cluster];
    for (const k of ['input', 'output', 'cache'] as const) assert.ok(Math.abs(b[k] * 2 - r[k]) < 1e-9, `${tier}/${cluster}/${k}`);
  }
  assert.deepEqual(MIMO_REALTIME.pro.china, { input: 3, output: 6, cache: 0.025 });
  assert.deepEqual(MIMO_REALTIME.ultraspeed.global, { input: 4.35, output: 8.7, cache: 0.036 });
});

test('dry-run writes nothing; apply sets shutdowns, providers, official CNY/USD rows and is idempotent', async () => {
  const f = fakeSeedTx({ models });
  const preview = await seedMimo20261020(f.tx, false, BEFORE);
  assert.equal(f.writes(), 0);
  assert.ok(preview.length > 0);
  await seedMimo20261020(f.tx, true, BEFORE);
  const v25 = f.data.models.find(m => m.slug === 'xiaomi-mimo-v2-5')!;
  assert.deepEqual([v25.shutdown_date, v25.replacement_model], ['2026-10-21', 'mimo-v2.6-flash']);
  assert.equal(f.data.models.find(m => m.slug === 'xiaomi-mimo-v2-5-pro')!.replacement_model, 'mimo-v2.6-pro');
  assert.equal(f.data.models.find(m => m.slug === 'xiaomi-mimo-v2-6-pro')!.shutdown_date, null);
  assert.deepEqual(f.data.providers.map(p => [p.slug, p.type, p.currency]).sort(), [['xiaomi-mimo-china', 'official', 'CNY'], ['xiaomi-mimo-global', 'official', 'USD']]);
  assert.equal(f.data.api_channel_prices.length, 10);
  const cn = f.data.providers.find(p => p.slug === 'xiaomi-mimo-china')!.id;
  const proCn = f.data.api_channel_prices.find(r => r.model_id === 3 && r.provider_id === cn)!;
  assert.deepEqual([proCn.currency, proCn.input_price_per_1m, proCn.output_price_per_1m, proCn.cached_input_price_per_1m], ['CNY', 3, 6, 0.025]);
  const v25Cn = f.data.api_channel_prices.find(r => r.model_id === 1 && r.provider_id === cn)!;
  assert.deepEqual([v25Cn.input_price_per_1m, v25Cn.output_price_per_1m], [1, 2]);
  assert.match(String(v25Cn.notes), /auto-routed to mimo-v2\.6-flash/);
  const batches = f.data.api_channel_price_variants.filter(v => v.variant_kind === 'batch');
  assert.deepEqual(batches.map(v => v.model_id).sort(), [3, 3, 4, 4]);
  // headline variant mirrors the channel row (audit variants.headline_drift)
  for (const ch of f.data.api_channel_prices) {
    const h = f.data.api_channel_price_variants.filter(v => v.model_id === ch.model_id && v.provider_id === ch.provider_id && v.is_headline);
    assert.equal(h.length, 1);
    assert.deepEqual([h[0].input_price_per_1m, h[0].output_price_per_1m], [ch.input_price_per_1m, ch.output_price_per_1m]);
  }
  assert.deepEqual(await seedMimo20261020(f.tx, true, BEFORE), []);
});

test('after the shutdown day no new official rows are added to v2.5 models; missing models are skipped', async () => {
  const f = fakeSeedTx({ models: models.filter(m => m.id !== 5) });
  const steps = await seedMimo20261020(f.tx, true, AFTER);
  assert.ok(steps.some(s => s.action === 'skip' && s.target === 'xiaomi-mimo-v2-6-pro-ultraspeed'));
  assert.ok(steps.some(s => s.action === 'skip' && s.target === 'xiaomi-mimo-china/xiaomi-mimo-v2-5'));
  assert.equal(f.data.api_channel_prices.filter(r => r.model_id === 1 || r.model_id === 2).length, 0);
  assert.equal(f.data.models.find(m => m.id === 1)!.shutdown_date, '2026-10-21');
});

test('refuses non-official provider slug collision and bad flags', async () => {
  const f = fakeSeedTx({ models, providers: [{ id: 9, slug: 'xiaomi-mimo-china', type: 'reseller' }] });
  await assert.rejects(seedMimo20261020(f.tx, true, BEFORE), /nothing written/);
  assert.equal(f.writes(), 0);
  assert.throws(() => mimoSeedOptions(['--apply', '--dry-run']));
  assert.deepEqual(mimoSeedOptions([]), { apply: false });
});
