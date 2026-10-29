import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHANNELS, CHINA_PLANS, CONTEXT_FIXES, FLASH_IMAGE, KIMI_K2_SLUGS, KIMI_REPLACEMENT, KIMI_SOURCE,
  KIMI_K3_CONTEXT_FIX, KIMI_K3_CONTEXT_SOURCES,
  catalog20261029SeedOptions, planChannels, planChinaAccess, planContext, planFlashImage, planKimi,
  type ChannelRow, type LockedRow, type ModelRow, type PlanRow,
} from './catalog-2026-10-29';
import { VARIABLE_ROUTER_SENTINEL } from '../utils/manual-unavailable';

let nextId = 1;
const model = (slug: string, extra: Partial<ModelRow> = {}): ModelRow => ({ id: nextId++, slug, context_window: null,
  shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null, ...extra });

test('context fixes replace only NULL or the stale 128K default, and are idempotent', () => {
  const rows = CONTEXT_FIXES.map(item => model(item.slug, { context_window: 128_000 }));
  rows[0] = { ...rows[0], context_window: 262_144 };
  const steps = planContext(rows);
  assert.equal(steps[0].action, 'skip');
  assert.match(steps[0].reason!, /262144/);
  const updates = steps.filter(step => step.action === 'update');
  assert.equal(updates.length, CONTEXT_FIXES.length - 1);
  assert.deepEqual(updates.find(step => step.target === 'gpt-5')?.changes, { context_window: { from: 128_000, to: 400_000 } });
  assert.deepEqual(updates.find(step => step.target === 'openai-gpt-6-sol')?.changes, { context_window: { from: 128_000, to: 1_050_000 } });
  const seeded = rows.map(row => ({ ...row, context_window: CONTEXT_FIXES.find(item => item.slug === row.slug)!.contextWindow }));
  assert.deepEqual(planContext(seeded), []);
  assert.equal(planContext([]).every(step => step.action === 'skip'), true);
  assert.throws(() => planContext([model('gpt-5'), model('gpt-5')]), /Duplicate/);
});

test('Kimi K3 context is 1048576, never the max_completion_tokens default; variants stay untouched', () => {
  assert.deepEqual(KIMI_K3_CONTEXT_FIX, { slug: 'kimi-k3', contextWindow: 1_048_576 });
  assert.deepEqual(KIMI_K3_CONTEXT_SOURCES, [
    'https://platform.kimi.ai/docs/guide/kimi-k3-quickstart',
    'https://github.com/MoonshotAI/Kimi-K3#readme',
  ]);
  const variants = ['kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'moonshotai-kimi-k3-1-pro',
    'kimi-k3-fast', 'kimi-k3-batch', 'kimi-k3-us', 'moonshotai-kimi-k3'];
  const others = variants.map(slug => model(slug, { context_window: 128_000 }));
  const before = structuredClone(others);
  for (const context_window of [null, 128_000]) {
    const row = model('kimi-k3', { context_window });
    const updates = planContext([row, ...others]).filter(step => step.action === 'update');
    assert.deepEqual(updates, [{ table: 'models', target: 'kimi-k3', id: row.id, action: 'update',
      changes: { context_window: { from: context_window, to: 1_048_576 } } }]);
    assert.deepEqual(planContext([{ ...row, context_window: 1_048_576 }], [KIMI_K3_CONTEXT_FIX]), []);
  }
  assert.deepEqual(others, before);
  const unexpected = planContext([model('kimi-k3', { context_window: 262_144 })], [KIMI_K3_CONTEXT_FIX]);
  assert.equal(unexpected[0].action, 'skip');
  assert.match(unexpected[0].reason!, /262144/);
  assert.equal(planContext([], [KIMI_K3_CONTEXT_FIX])[0].action, 'skip');
  assert.throws(() => planContext([model('kimi-k3'), model('kimi-k3')], [KIMI_K3_CONTEXT_FIX]), /Duplicate/);
});

test('Kimi K2 gets source + migration target but never a made-up date', () => {
  const rows = KIMI_K2_SLUGS.map(slug => model(slug));
  rows[1] = { ...rows[1], replacement_model: 'kimi-k3' };
  const steps = planKimi(rows);
  assert.equal(steps.length, KIMI_K2_SLUGS.length);
  for (const step of steps) {
    assert.equal(step.changes?.deprecation_source_url?.to, KIMI_SOURCE);
    assert.ok(!('shutdown_date' in step.changes!) && !('deprecated_at' in step.changes!));
  }
  assert.equal(steps[0].changes?.replacement_model?.to, KIMI_REPLACEMENT);
  assert.equal(steps[1].changes?.replacement_model, undefined);
  const seeded = rows.map(row => ({ ...row, deprecation_source_url: KIMI_SOURCE, replacement_model: row.replacement_model ?? KIMI_REPLACEMENT }));
  assert.deepEqual(planKimi(seeded), []);
});

test('access_from_china is set false only on the listed provider/plan pairs', () => {
  const plans: PlanRow[] = CHINA_PLANS.map((plan, i) => ({ id: 100 + i, slug: plan.slug, provider: plan.provider, access_from_china: true }));
  plans.push({ id: 999, slug: 'claude-team', provider: 'someone-else', access_from_china: true });
  const steps = planChinaAccess(plans);
  assert.equal(steps.length, CHINA_PLANS.length);
  assert.ok(steps.every(step => step.changes?.access_from_china?.to === false && step.id !== 999));
  assert.deepEqual(planChinaAccess(plans.map(plan => ({ ...plan, access_from_china: false }))), []);
});

test('gemini-2.5-flash-image moves to 2027-03-15 and only sweep-locked rows come back', () => {
  const row = model(FLASH_IMAGE.slug, { shutdown_date: '2026-10-02', deprecated_at: '2026-10-02',
    replacement_model: 'gemini-3.1-flash-image or gemini-3.1-flash-lite-image', deprecation_source_url: 'https://ai.google.dev/gemini-api/docs/pricing' });
  const locked: LockedRow[] = [
    { table: 'api_channel_prices', id: 1, is_available: false, availability_locked: true, notes: null },
    { table: 'api_channel_prices', id: 2, is_available: false, availability_locked: true, notes: VARIABLE_ROUTER_SENTINEL },
    { table: 'api_channel_price_variants', id: 3, is_available: false, availability_locked: true, notes: null },
    { table: 'api_channel_prices', id: 4, is_available: false, availability_locked: false, notes: null },
  ];
  const steps = planFlashImage([row], locked);
  assert.deepEqual(steps[0].changes, {
    shutdown_date: { from: '2026-10-02', to: '2027-03-15' },
    replacement_model: { from: 'gemini-3.1-flash-image or gemini-3.1-flash-lite-image', to: 'gemini-3.1-flash-lite-image' },
    deprecation_source_url: { from: 'https://ai.google.dev/gemini-api/docs/pricing', to: 'https://ai.google.dev/gemini-api/docs/deprecations' },
    deprecated_at: { from: '2026-10-02', to: null },
  });
  assert.deepEqual(steps.slice(1).map(step => [step.table, step.id]), [['api_channel_prices', 1], ['api_channel_price_variants', 3]]);
  const fixed = { ...row, ...FLASH_IMAGE };
  assert.deepEqual(planFlashImage([fixed], locked.map(item => ({ ...item, is_available: true, availability_locked: false }))), []);
});

test('first-party channels insert once, reprice drift, then no-op', () => {
  const models = CHANNELS.map((item, i) => ({ id: 10 + i, slug: item.slug }));
  const providers = [{ id: 44, slug: 'zhipu-global' }, { id: 42, slug: 'minimax-global' }];
  const insert = planChannels([], models, providers);
  assert.deepEqual(insert.map(step => step.action), ['insert', 'insert']);
  const rows: ChannelRow[] = CHANNELS.map((item, i) => ({ id: 50 + i, slug: item.slug, provider: item.provider,
    input_price_per_1m: String(item.input), output_price_per_1m: item.output, cached_input_price_per_1m: item.cached, currency: 'USD', is_available: true }));
  assert.deepEqual(planChannels(rows, models, providers), []);
  rows[0] = { ...rows[0], output_price_per_1m: 2 };
  assert.deepEqual(planChannels(rows, models, providers)[0].changes, { output_price_per_1m: { from: 2, to: 1.25 } });
  assert.equal(planChannels([], [], providers)[0].action, 'skip');
  assert.deepEqual(CHANNELS.map(item => [item.slug, item.input, item.cached, item.output]), [
    ['z-ai-glm-5-3-flashx', 0.37, 0.075, 1.25], ['minimax-minimax-m3-1-flash', 0.15, 0.015, 0.6]]);
});

test('seed is dry-run by default and is not on the deploy path', () => {
  assert.deepEqual(catalog20261029SeedOptions([]), { apply: false });
  assert.equal(catalog20261029SeedOptions(['--apply']).apply, true);
  assert.throws(() => catalog20261029SeedOptions(['--apply', '--dry-run']), /Usage/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:catalog-2026-10-29|seed-catalog-2026-10-29/);
  }
});
