import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { exampleSnapshot275, planRepair275, MINIMAX_PLANS_275, type Row275 } from './plan-minimax-flash-kimi-tiers';
import { KIMI_HIGHSPEED, KIMI_LEGACY_MARKER, MINIMAX_FLASH, VERIFIED_275 } from './minimax-flash-kimi-tiers';
import { resolveSelector, type ModelSelector } from '../../src/lib/plan-selector';
import { isSupersededPlan } from '../../src/lib/plan-lifecycle';
import { options275, localDatabaseUrl275 } from '../fix-minimax-flash-kimi-tiers';

const id = (row: Row275) => Number(row.id);

test('dry-run plan names every row change without mutating the input; applying its projection is idempotent', () => {
  const snapshot = exampleSnapshot275(), before = structuredClone(snapshot);
  const result = planRepair275(snapshot);
  assert.deepEqual(snapshot, before);
  assert.equal(result.steps.length, 52);
  const counts = Object.fromEntries([...new Set(result.steps.map(s => s.table))].map(t => [t, result.steps.filter(s => s.table === t).length]));
  assert.deepEqual(counts, { models: 2, model_slug_redirects: 2, api_channel_prices: 2, plans: 25, model_plan_mapping: 21 });
  for (const step of result.steps) {
    assert.match(step.source_url, /^https:\/\//);
    assert.equal(step.last_verified, VERIFIED_275);
    if (step.action !== 'insert') assert.ok(step.before);
  }
  assert.deepEqual(planRepair275(result.after).steps, []);
});

test('all 12 MiniMax plans resolve Flash after merge and have zero drift on rerun', () => {
  const result = planRepair275(exampleSnapshot275());
  assert.equal(MINIMAX_PLANS_275.length, 12);
  assert.equal(result.drift.filter(d => d.plan.startsWith('minimax')).length, 12);
  const flash = result.after.models.find(m => m.slug === MINIMAX_FLASH)!;
  assert.deepEqual(flash.provider_ids, [1, 2]);
  assert.equal(result.after.models.filter(m => String(m.slug).includes('minimax')).length, 1);
  for (const p of result.after.plans.filter(p => [1, 2].includes(Number(p.provider_id)))) {
    assert.ok(result.after.model_plan_mapping.some(m => m.plan_id === p.id && m.model_id === flash.id), String(p.slug));
  }
  assert.ok(planRepair275(result.after).drift.every(d => !d.missing.length && !d.stale.length));
});

test('April rows retain IDs, prices and plan references; current six tiers have no guessed annual totals or quotas', () => {
  const s = exampleSnapshot275();
  s.usage_prices.push({ id: 70, model_id: 3, plan_id: 22, price_kind: 'tasks', price: 1 });
  const result = planRepair275(s);
  const legacy = result.after.plans.filter(p => String(p.notes).includes(KIMI_LEGACY_MARKER));
  assert.deepEqual(legacy.map(id), [20, 21, 22, 23, 24]);
  assert.deepEqual(legacy.map(p => p.price), [0, 49, 99, 199, null]);
  assert.equal(result.after.usage_prices[0].plan_id, 22);
  assert.equal(result.after.plans.find(p => p.id === 22)?.slug, 'kimi-pro-legacy-2026-04');
  const current = result.after.plans.filter(p => p.plan_line === 'kimi');
  assert.deepEqual(current.map(p => p.name), ['Kimi Free', 'Kimi Go', 'Kimi Plus', 'Kimi Pro', 'Kimi Max', 'Kimi Ultra']);
  assert.deepEqual(current.map(p => p.price_yearly_monthly), [0, 39, 79, 159, 559, 1119]);
  assert.deepEqual(current.map(p => p.price), [0, null, null, null, null, null]);
  assert.ok(current.every(p => p.annual_price === null && p.quotas === null && p.currency === 'CNY'));
  const instructed = planRepair275(s, 'issue-monthly');
  assert.deepEqual(instructed.after.plans.filter(p => p.plan_line === 'kimi').map(p => p.price), [0, 39, 79, 159, 559, 1119]);
  assert.ok(instructed.after.plans.filter(p => p.plan_line === 'kimi').every(p => p.price_yearly_monthly === null && String(p.notes).includes('conflicts')));
  assert.deepEqual(planRepair275(instructed.after, 'issue-monthly').steps, []);
});

test('Highspeed is removed even from manual legacy links and appears only in the three current upper tiers', () => {
  const s = exampleSnapshot275();
  s.model_plan_mapping = [20, 21, 22, 23, 24].map((plan_id, i) => ({ id: 80 + i, model_id: 4, plan_id, source: 'manual' }));
  const result = planRepair275(s);
  assert.equal(result.steps.filter(s => s.table === 'model_plan_mapping' && s.action === 'delete').length, 5);
  const links = result.after.model_plan_mapping.filter(m => m.model_id === 4);
  assert.deepEqual(links.map(m => result.after.plans.find(p => p.id === m.plan_id)!.slug), ['kimi-pro', 'kimi-max', 'kimi-ultra']);
  assert.equal(result.after.models.find(m => m.id === 4)?.slug, KIMI_HIGHSPEED);
});

test('merge migrates every reference, retains manual associations, remaps price history and resolves variant headlines', () => {
  const s = exampleSnapshot275();
  s.api_channel_prices = [{ id: 30, model_id: 1, provider_id: 2 }, { id: 31, model_id: 2, provider_id: 2 }];
  s.price_history = [{ id: 1, channel_price_id: 31, old_input_price: 4 }];
  s.api_channel_price_variants = [
    { id: 1, model_id: 1, provider_id: 2, variant_key: 'standard', is_headline: true, is_available: true },
    { id: 2, model_id: 2, provider_id: 2, variant_key: 'standard' },
    { id: 3, model_id: 2, provider_id: 2, variant_key: 'priority', is_headline: true, is_available: true },
  ];
  s.model_plan_mapping = [{ id: 1, model_id: 1, plan_id: 1, source: 'derived', priority: 0 }, { id: 2, model_id: 2, plan_id: 1, source: 'manual', priority: 5 }];
  s.model_slug_redirects = [{ old_slug: 'flash-historical', model_id: 2 }];
  for (const table of ['model_offical', 'model_benchmark_scores', 'evaluation_run', 'coding_agent_scores', 'external_price_references'] as const) s[table] = [{ id: 1, model_id: 2 }];
  s.usage_prices = [{ id: 1, model_id: 2, provider_id: 2, unit: 'per_1m_tokens', price_kind: 'input_tokens', price: 9 },
    { id: 2, model_id: 2, provider_id: 2, unit: 'per_1m_tokens', price_kind: 'input_tokens', price: 7, constraints_json: { region: 'custom' } }];
  const { after, steps } = planRepair275(s);
  assert.equal(after.price_history[0].channel_price_id, 30);
  assert.equal(after.api_channel_prices.filter(p => p.provider_id === 2).length, 1);
  assert.equal(after.api_channel_prices.find(p => p.provider_id === 2)!.input_price_per_1m, 0.15);
  assert.equal(after.api_channel_price_variants.length, 2);
  assert.equal(after.api_channel_price_variants.find(p => p.variant_key === 'priority')!.is_headline, false);
  assert.equal(after.model_plan_mapping.find(m => m.plan_id === 1)!.source, 'manual');
  assert.equal(after.usage_prices[0].price, 0.15);
  assert.equal(after.usage_prices[1].price, 7);
  for (const table of ['model_offical', 'model_benchmark_scores', 'evaluation_run', 'coding_agent_scores', 'external_price_references', 'usage_prices', 'model_slug_redirects'] as const) assert.ok(after[table].every(r => r.model_id === 1), table);
  assert.ok(steps.some(s => s.table === 'price_history' && s.action === 'update'));
  assert.deepEqual(planRepair275(after).steps, []);
});

test('canonical ID wins when already present, all three rows merge, explicit extras and historical aliases follow it', () => {
  const s = exampleSnapshot275();
  s.models.push({ id: 10, slug: MINIMAX_FLASH, provider_ids: [1] });
  s.plans.push({ id: 50, provider_id: 3, slug: 'bundle', model_selector: { only_extra: true, extra: ['minimax-m3.1', 'minimax-minimax-m3-1-flash'] } });
  s.model_slug_redirects.push({ old_slug: 'older-flash', model_id: 2 });
  const { after } = planRepair275(s);
  assert.equal(after.models.find(m => m.slug === MINIMAX_FLASH)!.id, 10);
  assert.ok(after.model_slug_redirects.every(r => r.model_id === 10));
  assert.deepEqual(after.plans.find(p => p.id === 50)!.model_selector, { only_extra: true, extra: [MINIMAX_FLASH] });
  assert.deepEqual(planRepair275(after).steps, []);
});

test('missing plans/models/providers and unrelated aliases fail during planning without changing the snapshot', () => {
  for (const mutate of [
    (s: ReturnType<typeof exampleSnapshot275>) => { s.plans.shift(); },
    (s: ReturnType<typeof exampleSnapshot275>) => { s.models.pop(); },
    (s: ReturnType<typeof exampleSnapshot275>) => { s.providers.pop(); },
    (s: ReturnType<typeof exampleSnapshot275>) => { s.model_slug_redirects.push({ old_slug: 'minimax-m3.1', model_id: 3 }); },
  ]) {
    const s = exampleSnapshot275(); mutate(s); const before = structuredClone(s);
    assert.throws(() => planRepair275(s)); assert.deepEqual(s, before);
  }
});

test('CLI rejects ambiguous flags and cannot use a remote database', () => {
  assert.equal(options275([]).apply, false);
  for (const args of [['--apply', '--dry-run'], ['--apply', '--snapshot', 'x.json'], ['--db-dry-run', '--apply'], ['--oops']]) assert.throws(() => options275(args));
  for (const value of [undefined, 'postgres://user@example.com/test', 'postgres://user@localhost/test?host=example.com', 'https://localhost/test']) assert.throws(() => localDatabaseUrl275(value));
  assert.equal(localDatabaseUrl275('postgres://localhost/issue_275_test'), 'postgres://localhost/issue_275_test');
});

test('CLI prints its offline plan even when DATABASE_URL points at a remote host', t => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/fix-minimax-flash-kimi-tiers.ts'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://must-not-be-used.invalid/production' } });
  if (run.error && (run.error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Sandbox blocks child process execution; CLI smoke check is also run directly'); return; }
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /OFFLINE EXAMPLE/);
  assert.match(run.stdout, /52 row changes; DRY-RUN \(no writes\)/);
});


test('usage rates deduplicate after correction, while distinct constraints and prices remain separate', () => {
  const s = exampleSnapshot275();
  s.usage_prices = [
    { id: 1, model_id: 1, provider_id: 1, plan_id: null, price_kind: 'input_tokens', unit: 'per_1m_tokens', price: 9, currency: 'CNY', is_available: true },
    { id: 2, model_id: 2, provider_id: 1, plan_id: null, price_kind: 'input_tokens', unit: 'per_1m_tokens', price: 8, currency: 'CNY', is_available: true },
    { id: 3, model_id: 2, provider_id: 1, plan_id: 1, price_kind: 'input_tokens', unit: 'per_1m_tokens', price: 8, currency: 'CNY', is_available: true },
  ];
  const p = planRepair275(s);
  assert.deepEqual(p.after.usage_prices.map(r => [r.id, r.model_id, r.price]), [[1, 1, 1], [3, 1, 8]]);
  assert.deepEqual(planRepair275(p.after).steps, []);
});


test('historical tiers remain in storage without causing empty current-entitlement audits', () => {
  const { after } = planRepair275(exampleSnapshot275());
  const history = after.plans.filter(p => isSupersededPlan({ notes: p.notes as string }));
  assert.equal(history.length, 5);
  const current = after.plans.filter(p => !isSupersededPlan({ notes: p.notes as string }));
  const catalog = after.models.map(m => ({ id: Number(m.id), slug: String(m.slug), providerSlugs: ['minimax-china', 'minimax-global', 'moonshot-china'], elo: null }));
  for (const plan of current) assert.ok(resolveSelector(plan.model_selector as ModelSelector, catalog, ['minimax-china', 'moonshot-china']).models.length, String(plan.slug));
});
