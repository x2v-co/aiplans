import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CF_DEPRECATIONS, workersAiModelInsert } from './catalog-2026-11-06-workers-ai-deprecations';
import {
  CF_SHUTDOWN_DATE, CF_SHUTDOWN_DATE_PREVIOUS, planWorkersAiDeprecationDate, workersAiDateSeedOptions,
  WORKERS_AI_CORRECTION_SLUGS, type WorkersAiDateRow,
} from './catalog-2026-11-07-workers-ai-deprecation-date';

const OFFICIAL = ['kimi-k2.6', 'kimi-k2.7-code', 'glm-5.2', 'glm-5.3-flash', 'deepseek-v4-pro', 'deepseek-v4-flash'];

function appliedRow(index: number): WorkersAiDateRow {
  const item = CF_DEPRECATIONS[index];
  const inserted = workersAiModelInsert(item);
  return {
    id: index + 1,
    slug: inserted.slug,
    shutdown_date: CF_SHUTDOWN_DATE_PREVIOUS,
    description: inserted.values.description.replaceAll(CF_SHUTDOWN_DATE, CF_SHUTDOWN_DATE_PREVIOUS),
    providerSlugs: ['cloudflare'],
  };
}

const applied = () => CF_DEPRECATIONS.map((_, index) => appliedRow(index));

test('correction list is the 24 cloudflare-* catalog rows and no official lookalike', () => {
  assert.equal(WORKERS_AI_CORRECTION_SLUGS.length, 24);
  assert.equal(new Set(WORKERS_AI_CORRECTION_SLUGS).size, 24);
  assert.ok(WORKERS_AI_CORRECTION_SLUGS.every(slug => slug.startsWith('cloudflare-')));
  for (const slug of OFFICIAL) assert.ok(!WORKERS_AI_CORRECTION_SLUGS.includes(slug));
  assert.equal(CF_SHUTDOWN_DATE_PREVIOUS, '2026-11-15');
  assert.equal(CF_SHUTDOWN_DATE, '2026-11-20');
});

test('24 rows stamped November 15 become November 20, with no inserts', () => {
  const plan = planWorkersAiDeprecationDate(applied());
  assert.equal(plan.updates.length, 24);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.skipped, []);
  assert.deepEqual(plan.untouched, []);
  assert.deepEqual(plan.updates.map(row => row.slug), WORKERS_AI_CORRECTION_SLUGS);
  for (const update of plan.updates) {
    assert.equal(update.from.shutdown_date, '2026-11-15');
    assert.equal(update.to.shutdown_date, '2026-11-20');
    assert.match(update.from.description ?? '', /2026-11-15/);
    assert.match(update.to.description ?? '', /2026-11-20/);
    assert.doesNotMatch(update.to.description ?? '', /2026-11-15/);
    assert.ok(update.slug.startsWith('cloudflare-'));
  }
  const again = planWorkersAiDeprecationDate(plan.updates.map(update => ({
    id: update.id, slug: update.slug, shutdown_date: update.to.shutdown_date,
    description: update.to.description, providerSlugs: ['cloudflare'],
  })));
  assert.equal(again.updates.length, 0);
  assert.equal(again.inserts.length, 0);
});

test('official kimi, glm, and deepseek slugs are not updated, even on the old day', () => {
  const lookalikes: WorkersAiDateRow[] = [
    { id: 100, slug: 'kimi-k2.6', shutdown_date: '2026-11-15', description: 'Moonshot official', providerSlugs: ['moonshot-china'] },
    { id: 101, slug: 'kimi-k2.7-code', shutdown_date: '2026-11-15', description: 'Moonshot official', providerSlugs: ['moonshot-global'] },
    { id: 102, slug: 'glm-5.2', shutdown_date: '2026-11-15', description: 'Zhipu official', providerSlugs: ['zhipu-china', 'cloudflare'] },
    { id: 103, slug: 'glm-5.3-flash', shutdown_date: '2026-11-15', description: 'Zhipu official', providerSlugs: ['zhipu-global'] },
    { id: 104, slug: 'deepseek-v4-pro', shutdown_date: '2026-11-15', description: 'DeepSeek official', providerSlugs: ['deepseek'] },
    { id: 105, slug: 'deepseek-v4-flash', shutdown_date: '2026-11-15', description: 'DeepSeek official', providerSlugs: ['deepseek'] },
  ];
  const shared = appliedRow(8);
  shared.providerSlugs = ['zhipu-china', 'cloudflare'];
  const foreign = appliedRow(0);
  foreign.providerSlugs = ['moonshot-china'];
  const plan = planWorkersAiDeprecationDate([...lookalikes, shared, foreign]);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.untouched.map(row => row.slug), lookalikes.map(row => row.slug));
  assert.ok(plan.skipped.every(row => row.status === 'missing' || row.status === 'not-exclusive-cloudflare'));
  assert.equal(plan.skipped.filter(row => row.status === 'not-exclusive-cloudflare').map(row => row.slug).sort().join(), [shared.slug, foreign.slug].sort().join());
  assert.equal(plan.skipped.filter(row => row.status === 'missing').length, 22);
});

test('a different shutdown day and a duplicate slug abort before a write', () => {
  const row = appliedRow(21);
  assert.throws(() => planWorkersAiDeprecationDate([{ ...row, shutdown_date: '2026-12-01' }]), /Conflicting shutdown date/);
  assert.throws(() => planWorkersAiDeprecationDate([row, { ...row, id: 99 }]), /Ambiguous model slug/);
});

test('November 15 wording in the description is rewritten when the date column is already correct', () => {
  const row = appliedRow(21);
  row.shutdown_date = '2026-11-20';
  row.description = 'Removed from the Workers AI catalog on November 15, 2026. 2026年11月15日下线。';
  const plan = planWorkersAiDeprecationDate([row]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates[0].to.shutdown_date, '2026-11-20');
  assert.match(plan.updates[0].to.description ?? '', /November 20, 2026/);
  assert.match(plan.updates[0].to.description ?? '', /2026年11月20日/);
  assert.doesNotMatch(plan.updates[0].to.description ?? '', /November 15|2026年11月15日|2026-11-15/);
});

test('date seed is dry-run by default and is not on the deploy path', () => {
  assert.deepEqual(workersAiDateSeedOptions([]), { apply: false });
  assert.equal(workersAiDateSeedOptions(['--apply']).apply, true);
  assert.equal(workersAiDateSeedOptions(['--dry-run']).apply, false);
  assert.throws(() => workersAiDateSeedOptions(['--apply', '--dry-run']), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-07-workers-ai-deprecation-date'], 'tsx scripts/seed-catalog-2026-11-07-workers-ai-deprecation-date.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-07-workers-ai-deprecation-date:apply'], 'tsx scripts/seed-catalog-2026-11-07-workers-ai-deprecation-date.ts --apply');
  const seed = readFileSync(new URL('../seed-catalog-2026-11-07-workers-ai-deprecation-date.ts', import.meta.url), 'utf8');
  assert.match(seed, /slug LIKE 'cloudflare-%'/);
  assert.doesNotMatch(seed, /INSERT INTO models/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /workers-ai-deprecation-date/);
  }
});
