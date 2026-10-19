import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { OPENAI_SHUTDOWNS, planOpenAIShutdowns, shutdownSeedMode, type ShutdownModelRow } from './openai-shutdowns';

const rowsFor = (slugs: string[]): ShutdownModelRow[] => slugs.map((slug, i) => ({ id: i + 1, slug,
  shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null }));

test('all audit batches match exact production slugs without conflating snapshot dates', () => {
  const batches: Record<string, string[]> = {
    '2026-07-23': ['gpt-5-codex','gpt-5.1-codex','gpt-5.1-codex-max','gpt-5.2-codex','gpt-5.1-codex-mini'],
    '2026-10-23': ['o1','openai-o1-pro','o3-mini','openai-o4-mini','o4-mini-high','openai-gpt-4-turbo','gpt-4.1-nano','openai-gpt-4-1-nano-batch','gpt-4o-2024-05-13','openai-gpt-4o-batch'],
    '2026-12-11': ['openai-o3','openai-o3-pro'],
    '2026-12-01': ['gpt-image-1.5','gpt-image-1.5-mini','gpt-image-1-mini'],
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

test('exact slug matching reports absent models and does not invent o4-mini-high dates', () => {
  const rows = rowsFor(['gpt-4o','openai-gpt-4o','openai-o4-mini-high','openai-o4-mini-batch']);
  const plan = planOpenAIShutdowns(rows);
  assert.deepEqual(plan.updates.map(update => update.slug), ['gpt-4o']);
  assert.equal(plan.matches.find(match => match.apiId === 'gpt-4o-2024-05-13')?.slug, null);
  assert.ok(!OPENAI_SHUTDOWNS.some(item => item.ids.includes('openai-o4-mini-high')));
  assert.ok(!OPENAI_SHUTDOWNS.some(item => item.ids.includes('openai-o4-mini-batch')));
  assert.equal(plan.updates.find(update => update.slug === 'gpt-5.1-codex-mini'), undefined);
  for (const alias of ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro']) {
    assert.ok(!OPENAI_SHUTDOWNS.some(item => item.ids.includes(alias)), alias);
  }
  const imageMini = planOpenAIShutdowns(rowsFor(['gpt-image-1-mini'])).updates[0];
  assert.equal(imageMini?.to.shutdown_date, '2026-12-01');
  assert.equal(imageMini?.to.replacement_model, 'gpt-image-2.5-sunburst or gpt-image-2.5-flare');
  assert.throws(() => planOpenAIShutdowns([...rows, {...rows[0], id: 99}]), /Ambiguous/);
});

test('production aliases verified on 2026-10-19 get their own rows', () => {
  const plan = planOpenAIShutdowns(rowsFor(['openai-gpt-3-5-turbo','openai-gpt-3-5-turbo-batch','openai-gpt-4','gpt-5.1-codex-mini']));
  assert.equal(plan.updates.find(update => update.slug === 'openai-gpt-4')?.to.shutdown_date, '2026-10-23');
  assert.equal(plan.updates.find(update => update.slug === 'openai-gpt-4')?.to.replacement_model, 'gpt-5.6-sol');
  assert.equal(plan.updates.find(update => update.slug === 'openai-gpt-3-5-turbo-batch')?.to.replacement_model, 'gpt-5.6-terra');
  assert.equal(plan.updates.find(update => update.slug === 'gpt-5.1-codex-mini')?.to.shutdown_date, '2026-07-23');
  assert.equal(plan.updates.find(update => update.slug === 'gpt-5.1-codex-mini')?.to.replacement_model, 'gpt-5.6-terra');
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

test('channel disable SQL only covers slugs this script manages', () => {
  const src = readFileSync(new URL('../seed-openai-shutdowns.ts', import.meta.url), 'utf8');
  const apply = src.slice(src.indexOf("for (const table of ['api_channel_prices'"));
  assert.ok(apply.length > 0);
  assert.match(apply, /slug IN \$\{tx\(slugs\)\}/);
  assert.match(apply, /shutdown_date <= \(now\(\) AT TIME ZONE 'UTC'\)::date/);
  assert.doesNotMatch(apply, /WHERE shutdown_date <= \(now\(\) AT TIME ZONE 'UTC'\)::date\)/);
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

test('dated snapshots resolve deterministically and never write the family row', () => {
  const row = (id: number, slug: string) => ({ id, slug, shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null });
  const plan = planOpenAIShutdowns([row(1, 'gpt-4o'), row(2, 'gpt-4.1')]);
  const status = (id: string) => plan.matches.find(m => m.apiId === id)?.status;
  assert.equal(status('gpt-4o-2024-08-06'), 'covered-by-family');
  assert.equal(status('gpt-4.1-2025-04-14'), 'covered-by-family');
  assert.equal(status('gpt-4o-2024-05-13'), 'snapshot-not-cataloged');
  assert.equal(status('gpt-4o-mini-2024-07-18'), 'snapshot-not-cataloged');
  assert.equal(plan.matches.some(m => m.status === 'ambiguous'), false);
  assert.equal(plan.updates.find(u => u.slug === 'gpt-4o')?.to.shutdown_date, '2027-01-14');
});
