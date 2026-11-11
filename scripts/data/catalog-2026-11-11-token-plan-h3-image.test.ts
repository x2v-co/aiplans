import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { h3ImageCatalog, H3_IMAGE_CN_CATALOG, H3_IMAGE_PROMO, H3_IMAGE_SEED_SCRIPT, IMAGE_MODEL_CATALOG } from '../../src/lib/image-model-catalog';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import {
  catalog20261111TokenPlanH3ImageSeedOptions, PRODUCTION_SHAPED_DRY_RUN, QWEN_PREVIEW_ALIAS,
  QWEN_PREVIEW_NOTES, QWEN_PREVIEW_SHUTDOWN_AT, QWEN_PREVIEW_SLUG, REQUIRED_PROVIDERS,
  seedCatalog20261111TokenPlanH3Image, seedStepCounts, TOKEN_PLAN_EFFECTIVE_AT,
} from './catalog-2026-11-11-token-plan-h3-image';

const providers = REQUIRED_PROVIDERS.map((slug, i) => ({ id: i + 1, slug, name: slug, type: 'official', region: slug === 'qwen' ? 'both' : 'global' }));
const coding = { id: 90, slug: 'aliyun-bailian-coding-pro', provider_id: 1, product_id: 1, price: 200, plan_kind: 'coding', plan_line: 'bailian-coding' };
const fixture = (extra: Partial<Record<string, FakeRow[]>> = {}) => fakeSeedTx({ providers, plans: [coding], ...extra });

test('manual CLI defaults to rehearsal; separate apply and no deployment registration', () => {
  assert.equal(catalog20261111TokenPlanH3ImageSeedOptions([]).apply, false);
  assert.equal(catalog20261111TokenPlanH3ImageSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261111TokenPlanH3ImageSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--apply', '--dry-run']]) assert.throws(() => catalog20261111TokenPlanH3ImageSeedOptions(args), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const script = 'tsx scripts/seed-catalog-2026-11-11-token-plan-h3-image.ts';
  assert.equal(pkg.scripts[H3_IMAGE_SEED_SCRIPT], script);
  assert.equal(pkg.scripts[`${H3_IMAGE_SEED_SCRIPT}:apply`], `${script} --apply`);
  assert.match(pkg.scripts['test:db'], /catalog-2026-11-11-token-plan-h3-image-postgres.test.ts/);
  const cli = readFileSync(new URL('../seed-catalog-2026-11-11-token-plan-h3-image.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable\(sql, apply, tx => seedCatalog20261111TokenPlanH3Image\(tx as unknown as typeof sql, true\)\)/);
  assert.match(cli, /PRODUCTION_SHAPED_DRY_RUN/);
  for (const file of ['../../deploy/production/seed-catalog.sh', '../../deploy/production/rollout.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /2026-11-11-token-plan-h3-image/);
  }
});

test('production-shaped preview writes nothing; apply and second rehearsal are idempotent', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261111TokenPlanH3Image(f.tx);
  assert.deepEqual(seedStepCounts(preview), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  const applied = await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  assert.deepEqual(seedStepCounts(applied), PRODUCTION_SHAPED_DRY_RUN);
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261111TokenPlanH3Image(f.tx, true), []);
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.data.plans.find(p => p.id === coding.id), coding);
  assert.deepEqual(f.data.providers, providers);
  assert.ok(f.data.model_plan_mapping.every(m => Number(m.model_id) > 0 && Number(m.plan_id) > 0));
});

test('Qwen stores standard monthly prices, separate currencies, Credits quotas and conditional new-user notes', async () => {
  const f = fixture();
  await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  const tiers = ['lite', 'essential', 'standard', 'pro'];
  for (const [suffix, currency, prices, promos, region] of [
    ['', 'CNY', [39, 79, 139, 312], [19.5, 39.5], 'Beijing'],
    ['-intl', 'USD', [6, 10, 18, 43], [3, 5], 'Singapore'],
  ] as const) {
    for (const [i, tier] of tiers.entries()) {
      const p = f.data.plans.find(p => p.slug === `qwen-token-plan-${tier}${suffix}`)!;
      assert.equal(p.price, prices[i]); assert.equal(p.currency, currency); assert.equal(p.region, region);
      assert.equal(p.provider_id, 1); assert.equal(p.product_id, 1);
      assert.equal(p.plan_kind, 'agent'); assert.notEqual(p.plan_line, 'bailian-coding');
      assert.equal(p.price_unit, 'per_month'); assert.equal(p.quota_unit, 'credits');
      assert.equal(p.included_credits, [20_000, 45_000, 80_000, 200_000][i]);
      assert.deepEqual(p.quotas, [{ amount: p.included_credits, unit: 'credit', period: 'month' }]);
      assert.equal(p.last_verified instanceof Date && p.last_verified.toISOString().slice(0, 10), '2026-11-11');
      assert.match(String(p.notes), new RegExp(`concurrent agents ${['1-2', '2-3', '3-4', '6-8'][i]}`));
      assert.match(String(p.notes), /not batch\/backends/);
      if (i < 2) {
        assert.match(String(p.notes), new RegExp(`half price [¥$]${promos[i]}`));
        assert.match(String(p.notes), /2026-11-30 23:59:59 UTC\+8/);
        assert.match(String(p.notes), /never bought Token Plan Personal/);
      } else {
        assert.match(String(p.notes), /No new-user half-price/);
        assert.match(String(p.notes), /Includes Harness benefits/);
      }
      if (tier === 'pro') assert.match(String(p.notes), /new price starts next cycle/);
      assert.equal(p.promo_ends_at, undefined);
      assert.equal(p.concurrent_requests, undefined, 'concurrent agents range is not a request limit');
    }
  }
  assert.equal(TOKEN_PLAN_EFFECTIVE_AT, '2026-11-09T20:00:00+08:00');
});

test('preview is subscription-only with alias and exact retirement evidence, no invented PAYG or night rate', async () => {
  const f = fixture();
  await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  const m = f.data.models.find(m => m.slug === QWEN_PREVIEW_SLUG)!;
  assert.equal(m.pricing_unit, 'subscription_only');
  assert.equal(m.context_window, undefined);
  assert.equal(m.shutdown_date, '2026-11-26');
  assert.equal(QWEN_PREVIEW_SHUTDOWN_AT, '2026-11-26T00:00:00+08:00');
  assert.ok(String(m.description).includes(QWEN_PREVIEW_ALIAS));
  assert.match(QWEN_PREVIEW_NOTES, /夜|Night/);
  assert.match(QWEN_PREVIEW_NOTES, /待定 \/ pending/);
  assert.match(QWEN_PREVIEW_NOTES, /8% of standard/);
  assert.match(QWEN_PREVIEW_NOTES, /4% of standard/);
  assert.deepEqual(m.capabilities, ['reasoning', 'visual understanding', 'text generation']);
  for (const table of ['usage_prices', 'api_channel_prices', 'api_channel_price_variants']) assert.equal(f.data[table].filter(p => p.model_id === m.id).length, 0);
  assert.equal(f.data.model_plan_mapping.filter(p => p.model_id === m.id).length, 8);
  for (const p of f.data.plans.filter(p => p.id !== coding.id)) assert.deepEqual(p.model_selector, { only_extra: true, extra: [QWEN_PREVIEW_SLUG] });
});

test('H3 itemized CNY and USD prices remain standard; conditional entire-request promo is constraints-only', async () => {
  const f = fixture();
  await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  for (const [provider, currency, rates] of [
    [2, 'CNY', [[15, 10, 25, 0.4522], [15, 20, 50, 0.8550]]],
    [3, 'USD', [[2.3, 1.5, 3.8, 0.06879], [2.3, 3, 7.6, 0.13001]]],
  ] as const) {
    for (const [i, slug] of ['minimax-h3-image', 'minimax-h3-image-highspeed'].entries()) {
      const m = f.data.models.find(m => m.slug === slug)!;
      const rows = f.data.usage_prices.filter(p => p.model_id === m.id && p.provider_id === provider);
      assert.deepEqual(rows.map(r => r.price), rates[i]);
      assert.equal(rows.length, 4);
      assert.ok(rows.every(r => r.currency === currency && r.promo_ends_at === undefined));
      for (const row of rows) {
        const constraints = row.constraints_json as { conditional_promo: typeof H3_IMAGE_PROMO; approximate?: boolean; reference_only?: boolean };
        assert.deepEqual(constraints.conditional_promo, { discount_percent: 50, scope: 'entire_request', minimum_final_image_pixels: 16_600_000, ends_at: '2026-11-17T16:00:00.000Z', end_exclusive: true });
        assert.match(String((row.constraints_json as { notes: string }).notes), /final delivered image/);
        if (row.unit === 'image') {
          assert.equal(constraints.approximate, true); assert.equal(constraints.reference_only, true);
        } else assert.equal(row.unit, 'per_1m_tokens');
      }
    }
  }
  const base = f.data.models.find(m => m.slug === 'minimax-h3-image')!;
  assert.equal(base.open_source, true); assert.match(String(base.license), /community-license/);
  assert.match(String(base.description), /EU, UK, South Korea and US/);
  const fast = f.data.models.find(m => m.slug === 'minimax-h3-image-highspeed')!;
  assert.equal(fast.open_source, undefined); assert.equal(fast.license_url, undefined);
  assert.doesNotMatch(String(fast.description), /huggingface\.co/);
  assert.deepEqual(base.provider_ids, [2, 3]);
  assert.equal(f.data.api_channel_prices.length, 0);
});

test('image catalog has unique canonical CN cards, official USD seed data and deferred manual entrypoint', () => {
  assert.equal(H3_IMAGE_CN_CATALOG.length, 2);
  assert.equal(new Set(IMAGE_MODEL_CATALOG.map(i => i.slug)).size, IMAGE_MODEL_CATALOG.length);
  for (const item of H3_IMAGE_CN_CATALOG) {
    assert.equal(item.currency, 'CNY'); assert.equal(item.providerSlug, 'minimax-china');
    assert.equal(item.deferredDbSeedScript, `${H3_IMAGE_SEED_SCRIPT}:apply`);
    assert.equal(item.lastVerified, '2026-11-11');
    assert.equal(item.usageRates!.length, 4);
    assert.ok(item.usageRates!.filter(r => r.unit === 'image').every(r => r.approximate));
    assert.equal(item.contextWindow, undefined); assert.equal(item.resolutionTier, undefined);
  }
  assert.ok(h3ImageCatalog('USD').every(i => i.currency === 'USD' && i.providerSlug === 'minimax-global'));
});

test('fresher plan and usage rows keep all prices, quota, notes, currency and verification', async () => {
  const f = fixture();
  await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  const plan = f.data.plans.find(p => p.slug === 'qwen-token-plan-pro')!;
  const price = f.data.usage_prices[0];
  Object.assign(plan, { price: 999, included_credits: 9999, notes: 'later evidence', last_verified: new Date('2026-11-11T13:00:00Z') });
  Object.assign(price, { price: 999, currency: 'USD', constraints_json: { newer: true }, last_verified: new Date('2026-11-12T00:00:00Z') });
  const before = structuredClone(f.data);
  assert.deepEqual(await seedCatalog20261111TokenPlanH3Image(f.tx, true), []);
  assert.deepEqual(f.data, before);
});

test('updates older rows and keeps availability locks and unrelated usage rows', async () => {
  const f = fixture();
  await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  const plan = f.data.plans.find(p => p.slug === 'qwen-token-plan-pro')!;
  Object.assign(plan, { price: 499, last_verified: new Date('2026-11-01') });
  const price = f.data.usage_prices[0];
  Object.assign(price, { price: 1, is_available: false, availability_locked: true, last_verified: new Date('2026-11-01') });
  f.data.usage_prices.push({ id: 9999, model_id: price.model_id, provider_id: price.provider_id, price_kind: 'unrelated', unit: 'image', price: 123 });
  const steps = await seedCatalog20261111TokenPlanH3Image(f.tx, true);
  assert.equal(steps.filter(s => s.action === 'update').length, 2);
  assert.equal(plan.price, 312); assert.equal(price.price, 15); assert.equal(price.is_available, false);
  assert.equal(f.data.usage_prices.find(p => p.id === 9999)!.price, 123);
});

test('missing/wrong providers, duplicate identities, wrong ownership and late usage ambiguity fail before any write', async () => {
  for (const extra of [
    ...providers.map(p => ({ providers: providers.filter(row => row.id !== p.id) })),
    { providers: [...providers, { ...providers[0], id: 99 }] },
    { providers: [{ ...providers[0], type: 'aggregator' }, ...providers.slice(1)] },
    { models: [{ id: 50, slug: QWEN_PREVIEW_ALIAS }] },
    { models: [{ id: 50, slug: QWEN_PREVIEW_SLUG }, { id: 51, slug: QWEN_PREVIEW_SLUG }] },
    { plans: [{ id: 50, slug: 'qwen-token-plan-lite', provider_id: 2 }] },
  ]) {
    const f = fixture(extra);
    await assert.rejects(seedCatalog20261111TokenPlanH3Image(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
  const f = fixture({ models: [{ id: 60, slug: 'minimax-h3-image-highspeed' }], usage_prices: [
    { id: 61, model_id: 60, provider_id: 3, price_kind: 'image_output_tokens', unit: 'per_1m_tokens' },
    { id: 62, model_id: 60, provider_id: 3, price_kind: 'image_output_tokens', unit: 'per_1m_tokens' },
  ] });
  await assert.rejects(seedCatalog20261111TokenPlanH3Image(f.tx, true), /nothing written/);
  assert.equal(f.writes(), 0);
});
