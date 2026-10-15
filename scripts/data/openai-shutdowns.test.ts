import assert from 'node:assert/strict';
import test from 'node:test';
import { OPENAI_SHUTDOWNS, planOpenAIShutdowns, shutdownSeedMode, type ShutdownModelRow } from './openai-shutdowns';

const rowsFor = (slugs: string[]): ShutdownModelRow[] => slugs.map((slug, i) => ({ id: i + 1, slug,
  shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null }));

test('all audit batches match exact production slugs without conflating snapshot dates', () => {
  const batches: Record<string, string[]> = {
    '2026-07-23': ['gpt-5-codex','gpt-5.1-codex','gpt-5.1-codex-max','gpt-5.2-codex'],
    '2026-10-23': ['o1','openai-o1-pro','o3-mini','openai-o4-mini','o4-mini-high','openai-gpt-4-turbo','gpt-4.1-nano','openai-gpt-4-1-nano-batch','gpt-4o-2024-05-13','openai-gpt-4o-batch'],
    '2026-12-11': ['openai-o3','openai-o3-pro'],
    '2026-12-01': ['gpt-image-1.5','gpt-image-1.5-mini'],
    '2027-01-14': ['gpt-4o','gpt-4o-mini','gpt-4.1','gpt-4.1-mini'],
    '2027-04-01': ['gpt-5.1','gpt-5.3-codex','gpt-5.4-nano'],
    '2027-01-06': ['tts-1','tts-1-hd'],
  };
  for (const [date, slugs] of Object.entries(batches)) {
    const plan = planOpenAIShutdowns(rowsFor(slugs));
    assert.equal(plan.updates.length, slugs.length);
    assert.ok(plan.updates.every(update => update.to.shutdown_date === date));
  }
  const plan = planOpenAIShutdowns(rowsFor(['gpt-4o','gpt-4o-2024-05-13']));
  assert.deepEqual(plan.updates.map(update => update.to.shutdown_date).sort(), ['2026-10-23','2027-01-14']);
});

test('exact slug matching reports absent models; no normalization, alias fallback, or invented Mini date', () => {
  const rows = rowsFor(['gpt-5.1-codex-mini','gpt-4o','openai-gpt-4o']);
  const plan = planOpenAIShutdowns(rows);
  assert.deepEqual(plan.updates.map(update => update.slug), ['gpt-4o']);
  assert.equal(plan.matches.find(match => match.apiId === 'gpt-4o-2024-05-13')?.slug, null);
  assert.ok(!OPENAI_SHUTDOWNS.some(item => item.ids.includes('gpt-5.1-codex-mini')));
  assert.throws(() => planOpenAIShutdowns([...rows, {...rows[0], id: 99}]), /Ambiguous/);
});

test('idempotent and preserves unknown announcements/replacements instead of making them up', () => {
  const ids = OPENAI_SHUTDOWNS.flatMap(item => [...item.ids]);
  assert.equal(ids.length, new Set(ids).size);
  const rows = rowsFor(ids);
  const plan = planOpenAIShutdowns(rows);
  assert.equal(plan.updates.length, ids.length);
  const seeded = rows.map(row => ({...row, ...plan.updates.find(update => update.id === row.id)?.to}));
  assert.deepEqual(planOpenAIShutdowns(seeded).updates, []);
  assert.equal(plan.updates.find(update => update.slug === 'gpt-5.1')?.to.deprecated_at, null);
  assert.equal(plan.updates.find(update => update.slug === 'gpt-5.1')?.to.replacement_model, null);
});

test('writes require an explicit, unambiguous apply flag', () => {
  assert.equal(shutdownSeedMode([]), 'dry-run');
  assert.equal(shutdownSeedMode(['--dry-run']), 'dry-run');
  assert.equal(shutdownSeedMode(['--apply']), 'apply');
  assert.throws(() => shutdownSeedMode(['--apply','--dry-run']), /Usage/);
  assert.throws(() => shutdownSeedMode(['--aply']), /Usage/);
});

test('conflicting notices fail even if one of the dates already matches the DB', () => {
  const rows = rowsFor(['gpt-5.1']);
  rows[0].shutdown_date = '2027-04-01';
  assert.throws(() => planOpenAIShutdowns(rows, [
    { ids:['gpt-5.1'], shutdownDate:'2026-07-23' },
    { ids:['gpt-5.1'], shutdownDate:'2027-04-01' },
  ]), /Conflicting shutdown dates/);
});
