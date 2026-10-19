import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  QWEN_CN_MODELS,
  QWEN_CN_NOTE,
  SONNET_45_SHUTDOWN,
  ZHIPU_GLOBAL_PRICES,
  catalogP1SeedOptions,
  channelRetired,
  planQwenCnPrices,
  planZhipuGlobalPrices,
  qwenHeadline,
  withSonnetNote,
  type QwenCnVariant,
} from './catalog-p1-2026-10-19';

test('Sonnet 4.5 shutdown matches the dated API id and keeps an existing description', () => {
  assert.equal(SONNET_45_SHUTDOWN.shutdown_date, '2026-11-30');
  assert.equal(SONNET_45_SHUTDOWN.deprecated_at, '2026-09-30');
  assert.equal(SONNET_45_SHUTDOWN.replacement_model, 'claude-sonnet-5-5');
  assert.deepEqual([...SONNET_45_SHUTDOWN.slugs], ['claude-sonnet-4.5', 'anthropic-claude-sonnet-4-5']);
  const once = withSonnetNote('existing channel note');
  assert.match(once, /^existing channel note\n\[shutdown\]/);
  assert.match(once, /Bedrock/);
  assert.equal(withSonnetNote(once), once);
});

test('Z.ai prices are the verified list and a missing FlashX slug is not created', () => {
  assert.deepEqual(ZHIPU_GLOBAL_PRICES.find(row => row.slug === 'glm-5.3-flashx'), { slug: 'glm-5.3-flashx', input: 0.37, cached: 0.075, output: 1.25 });
  const plan = planZhipuGlobalPrices(
    [{ id: 1, slug: 'glm-5.3' }, { id: 2, slug: 'glm-5.2' }],
    [{ id: 9, model_id: 1, input_price_per_1m: 1, output_price_per_1m: 3, cached_input_price_per_1m: null, currency: 'USD', notes: null }],
  );
  assert.deepEqual(plan.missing.sort(), ['glm-5.3-flash', 'glm-5.3-flashx']);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].slug, 'glm-5.2');
  assert.equal(plan.updates[0].slug, 'glm-5.3');
  assert.equal(plan.updates[0].changes.input_price_per_1m.to, 1.4);
  assert.throws(() => planZhipuGlobalPrices([{ id: 1, slug: 'glm-5.3' }, { id: 2, slug: 'glm-5.3' }], []), /Duplicate model/);
});

function qwenVariant(partial: Partial<QwenCnVariant> & Pick<QwenCnVariant, 'id' | 'model_id' | 'variant_key'>): QwenCnVariant {
  return {
    variant_name: '≤128K',
    variant_kind: 'context_band',
    input_price_per_1m: 0.8,
    output_price_per_1m: 4.8,
    currency: 'CNY',
    price_unit: 'per_1m_tokens',
    is_headline: true,
    is_available: true,
    constraints_json: { prompt_tokens_lte: 128000 },
    source_url: 'https://help.aliyun.com/zh/model-studio/model-pricing',
    notes: QWEN_CN_NOTE,
    ...partial,
  };
}

test('Qwen China headlines are the ≤128K bands and higher bands stay variants', () => {
  assert.deepEqual(
    QWEN_CN_MODELS.map(model => [model.slug, qwenHeadline(model.slug).input, qwenHeadline(model.slug).output]),
    [['qwen3.5-plus', 0.8, 4.8], ['qwen3.5-flash', 0.2, 2], ['qwen-flash', 0.15, 1.5]],
  );
  const plus = QWEN_CN_MODELS[0].bands;
  assert.deepEqual(plus.map(band => [band.input, band.output]), [[0.8, 4.8], [2, 12], [4, 24]]);
  const flash = QWEN_CN_MODELS[1].bands;
  assert.deepEqual(flash.map(band => [band.input, band.output]), [[0.2, 2], [0.8, 8], [1.2, 12]]);
  const qwenFlash = QWEN_CN_MODELS[2].bands;
  assert.deepEqual(qwenFlash.map(band => [band.input, band.output]), [[0.15, 1.5], [0.6, 6], [1.2, 12]]);
  assert.equal(plus.filter(band => band.headline).length, 1);
});

test('Qwen seed rewrites the stored mid-band headline and does not create a missing slug', () => {
  const plan = planQwenCnPrices(
    [{ id: 1, slug: 'qwen3.5-plus' }, { id: 2, slug: 'qwen3.5-flash' }],
    [
      { id: 10, model_id: 1, input_price_per_1m: 2, output_price_per_1m: 12, currency: 'CNY', price_unit: 'per_1m_tokens', notes: 'old', is_available: true },
      { id: 11, model_id: 2, input_price_per_1m: '1.2', output_price_per_1m: '7.2', currency: 'CNY', price_unit: 'per_1m_tokens', notes: null, is_available: true },
    ],
    [qwenVariant({ id: 70, model_id: 1, variant_key: 'context-128k-256k', variant_name: '128K–256K', input_price_per_1m: 2, output_price_per_1m: 12, is_headline: true, constraints_json: { prompt_tokens_gt: 128000, prompt_tokens_lte: 256000 } })],
  );
  assert.deepEqual(plan.missing, ['qwen-flash']);
  assert.deepEqual(plan.channelUpdates.map(row => [row.slug, row.changes.input_price_per_1m.to, row.changes.output_price_per_1m.to]), [
    ['qwen3.5-plus', 0.8, 4.8],
    ['qwen3.5-flash', 0.2, 2],
  ]);
  assert.equal(plan.channelInserts.length, 0);
  assert.deepEqual(plan.variantInserts.map(row => `${row.slug}#${row.band.key}`), [
    'qwen3.5-plus#context-le-128k',
    'qwen3.5-plus#context-256k-1m',
    'qwen3.5-flash#context-le-128k',
    'qwen3.5-flash#context-128k-256k',
    'qwen3.5-flash#context-256k-1m',
  ]);
  const cleared = plan.variantUpdates.find(row => row.key === 'context-128k-256k');
  assert.equal(cleared?.changes.is_headline.to, false);
  assert.throws(() => planQwenCnPrices(
    [{ id: 1, slug: 'qwen3.5-plus' }],
    [
      { id: 10, model_id: 1, input_price_per_1m: 0.8, output_price_per_1m: 4.8, currency: 'CNY', price_unit: 'per_1m_tokens', notes: QWEN_CN_NOTE, is_available: true },
      { id: 11, model_id: 1, input_price_per_1m: 0.8, output_price_per_1m: 4.8, currency: 'CNY', price_unit: 'per_1m_tokens', notes: QWEN_CN_NOTE, is_available: true },
    ],
    [],
  ), /Duplicate qwen channel/);
});

test('a correct Qwen headline is quiet, and a disabled channel is left alone', () => {
  const plus = QWEN_CN_MODELS[0];
  const ready = plus.bands.map((band, index) => qwenVariant({
    id: index + 1,
    model_id: 1,
    variant_key: band.key,
    variant_name: band.name,
    input_price_per_1m: band.input,
    output_price_per_1m: band.output,
    is_headline: band.headline,
    constraints_json: band.constraints,
  }));
  const quiet = planQwenCnPrices(
    [{ id: 1, slug: 'qwen3.5-plus' }],
    [{ id: 10, model_id: 1, input_price_per_1m: '0.80000001', output_price_per_1m: 4.8, currency: 'CNY', price_unit: 'per_1m_tokens', notes: QWEN_CN_NOTE, is_available: true }],
    ready,
  );
  assert.equal(quiet.channelUpdates.length, 0);
  assert.equal(quiet.variantUpdates.length, 0);
  assert.equal(quiet.variantInserts.length, 0);
  const held = planQwenCnPrices(
    [{ id: 8, slug: 'qwen-flash' }],
    [{ id: 18, model_id: 8, input_price_per_1m: 0.2, output_price_per_1m: 2, currency: 'CNY', price_unit: 'per_1m_tokens', notes: null, is_available: false }],
    [],
  );
  assert.deepEqual(held.disabled, ['qwen-flash']);
  assert.equal(held.channelUpdates.length + held.variantInserts.length, 0);
});

test('a retired qwen-flash channel is not repriced, gets no bands, and is switched off and locked', () => {
  const notes = 'Bailian lists qwen-flash as retired 2026-08-20; use qwen3.5-flash.';
  const plan = planQwenCnPrices(
    [{ id: 8, slug: 'qwen-flash' }, { id: 2, slug: 'qwen3.5-flash' }],
    [
      { id: 14836, model_id: 8, input_price_per_1m: 0.2, output_price_per_1m: 2, currency: 'CNY', price_unit: 'per_1m_tokens', notes, is_available: true },
      { id: 14835, model_id: 2, input_price_per_1m: 0.2, output_price_per_1m: 2, currency: 'CNY', price_unit: 'per_1m_tokens', notes: QWEN_CN_NOTE, is_available: true },
    ],
    [qwenVariant({ id: 91, model_id: 8, variant_key: 'context-le-128k' }), qwenVariant({ id: 92, model_id: 8, variant_key: 'old', is_available: false })],
  );
  assert.deepEqual(plan.retired, [{ id: 14836, slug: 'qwen-flash', channelAvailable: true, variantIds: [91] }]);
  assert.ok(!plan.channelUpdates.some(row => row.slug === 'qwen-flash'));
  assert.ok(!plan.variantInserts.some(row => row.slug === 'qwen-flash'));
  assert.ok(!plan.variantUpdates.some(row => row.slug === 'qwen-flash'));
  // Other Qwen rows still get their prices.
  assert.ok(plan.variantInserts.some(row => row.slug === 'qwen3.5-flash'));
  // Already off and locked: nothing left to do.
  const done = planQwenCnPrices(
    [{ id: 8, slug: 'qwen-flash' }],
    [{ id: 14836, model_id: 8, input_price_per_1m: 0.2, output_price_per_1m: 2, currency: 'CNY', price_unit: 'per_1m_tokens', notes, is_available: false, availability_locked: true }],
    [],
  );
  assert.deepEqual(done.retired, []);
  assert.deepEqual(done.disabled, ['qwen-flash']);
  // Off but unlocked: lock it so the daily scrape cannot turn it back on.
  const unlocked = planQwenCnPrices(
    [{ id: 8, slug: 'qwen-flash' }],
    [{ id: 14836, model_id: 8, input_price_per_1m: 0.2, output_price_per_1m: 2, currency: 'CNY', price_unit: 'per_1m_tokens', notes, is_available: false, availability_locked: false }],
    [],
  );
  assert.deepEqual(unlocked.retired, [{ id: 14836, slug: 'qwen-flash', channelAvailable: false, variantIds: [] }]);
});

test('the scraper soft-retire marker is not a vendor retirement', () => {
  assert.equal(channelRetired('retired 2026-08-20T03:21:00.000Z: absent from successful full-catalog Qwen scrape'), false);
  assert.equal(channelRetired('audit-fix: ok | retired 2026-08-20T03:21:00.000Z: absent from successful full-catalog Qwen scrape'), false);
  assert.equal(channelRetired('Model retired 2026-08-20 by Alibaba'), true);
  assert.equal(channelRetired('2026-08-20 已下线'), true);
  assert.equal(channelRetired(null), false);
  assert.equal(channelRetired(QWEN_CN_NOTE), false);
});

test('seed SQL for the retired path only ever writes is_available = false', () => {
  const source = readFileSync(new URL('./catalog-p1-2026-10-19.ts', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('for (const row of qwenPlan.retired)'), source.indexOf('for (const slug of qwenPlan.disabled)'));
  assert.match(block, /SET is_available = false, availability_locked = true/);
  assert.doesNotMatch(block, /is_available = true|input_price_per_1m/);
});

test('fix:data pins the same ≤128K Qwen headlines', () => {
  const source = readFileSync(new URL('../fix-data-audit.ts', import.meta.url), 'utf8');
  assert.match(source, /modelSlug: 'qwen3\.5-plus'[\s\S]{0,120}input: 0\.8, output: 4\.8/);
  assert.match(source, /modelSlug: 'qwen3\.5-flash'[\s\S]{0,160}input: 0\.2, output: 2,/);
  assert.match(source, /modelSlug: 'qwen-flash'[\s\S]{0,120}input: 0\.15, output: 1\.5/);
  assert.match(source, /modelSlug: 'qwen-flash'[\s\S]{0,220}keepDisabled: true/);
  assert.doesNotMatch(source, /modelSlug: 'qwen3\.5-plus'[\s\S]{0,80}input: 2, output: 12/);
  assert.doesNotMatch(source, /modelSlug: 'qwen3\.5-flash'[\s\S]{0,80}output: 7\.2/);
});

test('P1 seed stays off the deploy path', () => {
  assert.equal(catalogP1SeedOptions([]).apply, false);
  assert.throws(() => catalogP1SeedOptions(['--apply', '--dry-run']), /Usage/);
  for (const file of ['../../deploy/production/rollout.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:catalog-p1-2026-10-19|seed-catalog-p1-2026-10-19/);
  }
});
