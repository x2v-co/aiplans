import assert from 'node:assert/strict';
import test from 'node:test';
import { OPENAI_DEPRECATION_SOURCE, OPENAI_SHUTDOWNS, planOpenAIShutdowns, shutdownSeedMode, type ShutdownModelRow } from './openai-shutdowns';
import { normalizeSlug } from '../utils/model-normalizer';

function rowsFor(slugs: string[]): ShutdownModelRow[] {
  return slugs.map((slug, index) => ({ id: index + 1, slug, shutdown_date: null, replacement_model: null, deprecation_source_url: null }));
}

test('records every requested snapshot and alias with its shutdown and replacement', () => {
  const ids = OPENAI_SHUTDOWNS.flatMap(item => item.ids);
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, ids.length);
  const plan = planOpenAIShutdowns(rowsFor([...ids]));
  assert.equal(plan.updates.length, 28);
  assert.ok(plan.matches.every(match => match.status === 'exact'));
  const dates = new Map(plan.updates.map(item => [item.slug, item.to.shutdown_date]));
  for (const id of ['gpt-4o-2024-08-06', 'gpt-4o-2024-11-20', 'gpt-4o-mini-2024-07-18', 'gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14']) {
    assert.equal(dates.get(id), '2027-01-14');
    assert.equal(plan.updates.find(item => item.slug === id)?.to.replacement_model, 'gpt-6-luna');
  }
  const replacements: Record<string, string> = {
    'gpt-3.5-turbo': 'gpt-5.6-terra', 'gpt-4': 'gpt-5.6-sol',
    'gpt-4-1106-preview': 'gpt-5.6-sol', 'gpt-4-turbo': 'gpt-5.6-sol',
    'gpt-4.1-nano': 'gpt-5.6-luna', 'gpt-4o-2024-05-13': 'gpt-5.6-sol',
    'gpt-image-1': 'gpt-image-2.5-sunburst or gpt-image-2.5-flare',
    o1: 'gpt-5.6-sol', 'o1-pro': 'gpt-5.6-sol (reasoning.mode: pro)',
    'o3-mini': 'gpt-5.6-sol', 'o4-mini': 'gpt-5.6-terra',
  };
  for (const [slug, replacement] of Object.entries(replacements)) {
    const update = plan.updates.find(item => item.slug === slug)!;
    assert.equal(update.to.shutdown_date, '2026-10-23');
    assert.equal(update.to.replacement_model, replacement);
    assert.equal(update.to.deprecation_source_url, OPENAI_DEPRECATION_SOURCE);
  }
  assert.ok(OPENAI_SHUTDOWNS.every(item => item.announcedOn === (item.shutdownDate === '2027-01-14' ? '2026-10-14' : '2026-04-22')));
});

test('does not shut down undated aliases for snapshot-only removals', () => {
  const plan = planOpenAIShutdowns(rowsFor(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']));
  assert.deepEqual(plan.updates, []);
  assert.equal(plan.matches.filter(match => match.status === 'ambiguous').length, 6);
  assert.ok(plan.matches.every(match => match.slug === null));
  // These existing normalizer collisions are why shutdown seeding bypasses it.
  assert.equal(normalizeSlug('gpt-4o-2024-08-06'), 'gpt-4o');
  assert.equal(normalizeSlug('gpt-4.1-2025-04-14'), 'gpt-4');
  assert.equal(normalizeSlug('gpt-4.1-nano-2025-04-14'), 'gpt-4.1-nano-2025-04-14');
});

test('marks explicitly removed aliases once, resolves snapshots safely, and is idempotent', () => {
  const rows = rowsFor(['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4.1-nano', 'o1', 'o1-pro', 'o3-mini', 'o4-mini']);
  const plan = planOpenAIShutdowns(rows);
  assert.equal(plan.updates.length, 8);
  assert.equal(plan.matches.find(item => item.apiId === 'gpt-4.1-nano-2025-04-14')?.slug, 'gpt-4.1-nano');
  assert.equal(plan.matches.find(item => item.apiId === 'gpt-4-1106-preview')?.slug, null);
  assert.equal(plan.matches.find(item => item.apiId === 'gpt-4.1-2025-04-14')?.slug, null);
  assert.ok(plan.updates.every(item => item.to.shutdown_date === '2026-10-23'));
  const seeded = rows.map(row => ({ ...row, ...plan.updates.find(item => item.id === row.id)?.to }));
  assert.deepEqual(planOpenAIShutdowns(seeded).updates, []);
});

test('prefers exact snapshots, reports absent rows, and refuses ambiguous row identities', () => {
  const rows = rowsFor(['o1', 'o1-2024-12-17', 'gpt-4o-2024-08-06']);
  const plan = planOpenAIShutdowns(rows);
  assert.equal(plan.matches.find(item => item.apiId === 'o1-2024-12-17')?.slug, 'o1-2024-12-17');
  assert.equal(plan.matches.find(item => item.apiId === 'gpt-image-1')?.status, 'not-present');
  assert.equal(plan.updates.find(item => item.slug === 'gpt-4o-2024-08-06')?.to.shutdown_date, '2027-01-14');
  assert.throws(() => planOpenAIShutdowns([...rows, { ...rows[0], id: 99 }]), /Ambiguous/);
  assert.deepEqual(planOpenAIShutdowns([]).updates, []);
});

test('writes require an explicit, unambiguous apply flag', () => {
  assert.equal(shutdownSeedMode([]), 'dry-run');
  assert.equal(shutdownSeedMode(['--dry-run']), 'dry-run');
  assert.equal(shutdownSeedMode(['--apply']), 'apply');
  assert.throws(() => shutdownSeedMode(['--apply', '--dry-run']), /Usage/);
  assert.throws(() => shutdownSeedMode(['--aply']), /Usage/);
});
