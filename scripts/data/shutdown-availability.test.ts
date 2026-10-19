import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  planShutdownAvailability,
  runShutdownAvailability,
  shutdownAvailabilityMode,
  type ShutdownChannelRow,
  type ShutdownModel,
  type ShutdownStore,
  type ShutdownTable,
} from './shutdown-availability';

// Sonnet 4.5 (claude-sonnet-4-5-20250929) retires 2026-11-30; channels 15103, 15391, 15478.
const models: ShutdownModel[] = [
  { id: 1, slug: 'claude-sonnet-4.5', shutdown_date: '2026-11-30' },
  { id: 2, slug: 'grok-code-fast-1', shutdown_date: new Date('2026-10-01T00:00:00Z') },
  { id: 3, slug: 'live-model', shutdown_date: null },
  { id: 4, slug: 'future-model', shutdown_date: '2027-01-14' },
];

function memoryStore(today: string, rows: Record<ShutdownTable, ShutdownChannelRow[]>) {
  const writes: Array<{ table: ShutdownTable; ids: number[] }> = [];
  const store: ShutdownStore = {
    async today() { return today; },
    async models() { return models; },
    async rows(table, ids) { return rows[table].filter(row => ids.includes(row.model_id!)); },
    async disable(table, ids) {
      writes.push({ table, ids });
      let changed = 0;
      for (const row of rows[table]) {
        if (!ids.includes(row.id)) continue;
        if (row.is_available !== false || row.availability_locked !== true) changed++;
        row.is_available = false;
        row.availability_locked = true;
      }
      return changed;
    },
  };
  return { store, writes, rows };
}

function sonnetRows() {
  return {
    api_channel_prices: [
      { id: 15103, model_id: 1, provider_id: 10, is_available: true },
      { id: 15391, model_id: 1, provider_id: 11, is_available: true },
      { id: 15478, model_id: 1, provider_id: 12, is_available: null },
      { id: 13653, model_id: 2, provider_id: 13, is_available: true },
      { id: 20000, model_id: 2, provider_id: 14, is_available: false, availability_locked: false },
      { id: 30000, model_id: 3, provider_id: 10, is_available: true },
      { id: 40000, model_id: 4, provider_id: 10, is_available: true },
    ],
    api_channel_price_variants: [
      { id: 501, model_id: 1, provider_id: 10, is_available: true },
      { id: 502, model_id: 3, provider_id: 10, is_available: true },
    ],
  } as Record<ShutdownTable, ShutdownChannelRow[]>;
}

test('Sonnet 4.5 channels stay on through 2026-11-29 UTC and switch off from 2026-11-30 UTC', () => {
  const before = planShutdownAvailability(models, sonnetRows(), '2026-11-29');
  assert.deepEqual(before.filter(t => t.slug === 'claude-sonnet-4.5'), []);
  const on = planShutdownAvailability(models, sonnetRows(), '2026-11-30');
  assert.deepEqual(
    on.filter(t => t.slug === 'claude-sonnet-4.5').map(t => `${t.table}#${t.id}:${t.action}`),
    ['api_channel_price_variants#501:disable', 'api_channel_prices#15103:disable', 'api_channel_prices#15391:disable', 'api_channel_prices#15478:disable'],
  );
  // DB Date values are handled; models without a date or with a future date are untouched.
  assert.ok(on.some(t => t.id === 13653 && t.action === 'disable' && t.shutdown_date === '2026-10-01'));
  assert.ok(on.some(t => t.id === 20000 && t.action === 'lock'), 'already-off rows only gain the lock');
  assert.ok(!on.some(t => [30000, 40000, 502].includes(t.id)));
  assert.throws(() => planShutdownAvailability(models, sonnetRows(), '2026/11/30'), /Bad UTC day/);
});

test('apply is one way and idempotent; dry-run and check never write', async () => {
  const dry = memoryStore('2026-12-01', sonnetRows());
  const preview = await runShutdownAvailability(dry.store, 'dry-run');
  assert.equal(preview.written, 0);
  assert.equal(dry.writes.length, 0);
  assert.equal(preview.targets.filter(t => t.action === 'disable').length, 5);

  const check = memoryStore('2026-12-01', sonnetRows());
  assert.equal((await runShutdownAvailability(check.store, 'check')).written, 0);
  assert.equal(check.writes.length, 0);

  const live = memoryStore('2026-12-01', sonnetRows());
  const applied = await runShutdownAvailability(live.store, 'apply');
  assert.equal(applied.written, 6);
  for (const id of [15103, 15391, 15478, 13653, 20000]) {
    const row = live.rows.api_channel_prices.find(r => r.id === id)!;
    assert.equal(row.is_available, false, String(id));
    assert.equal(row.availability_locked, true, String(id));
  }
  assert.equal(live.rows.api_channel_prices.find(r => r.id === 30000)!.is_available, true);
  assert.equal(live.rows.api_channel_prices.find(r => r.id === 40000)!.is_available, true);
  assert.equal(live.rows.api_channel_price_variants.find(r => r.id === 502)!.is_available, true);
  const again = await runShutdownAvailability(live.store, 'apply');
  assert.deepEqual(again.targets, []);
  assert.equal(again.written, 0);
});

test('mode flags default to a dry-run and reject mixes', () => {
  assert.equal(shutdownAvailabilityMode([]), 'dry-run');
  assert.equal(shutdownAvailabilityMode(['--apply']), 'apply');
  assert.equal(shutdownAvailabilityMode(['--check']), 'check');
  assert.throws(() => shutdownAvailabilityMode(['--apply', '--check']), /Usage/);
  assert.throws(() => shutdownAvailabilityMode(['--sync']), /Usage/);
});

test('SQL never writes is_available = true; the sweep runs daily and in the manual catalog seed, not in app release', () => {
  const sweep = readFileSync(new URL('./shutdown-availability.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(sweep, /is_available\s*=\s*true/);
  assert.match(sweep, /SET is_available = false, availability_locked = true/);
  assert.match(sweep, /\(now\(\) AT TIME ZONE 'UTC'\)::date/);
  // #224: app release writes no catalog data, so the sweep is not in rollout.sh.
  const code = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8').split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(code('../../deploy/production/rollout.sh'), /shutdown-availability/);
  assert.doesNotMatch(code('../../.github/workflows/deploy-production.yml'), /shutdown-availability/);

  // Manual catalog seed: dry-run goes into diff.txt; apply runs after the backup, before the audits.
  const seed = code('../../deploy/production/seed-catalog.sh');
  const dry = seed.indexOf('npm run seed:shutdown-availability\n');
  const backup = seed.indexOf('pg_dump --username');
  const apply = seed.indexOf('npm run seed:shutdown-availability -- --apply');
  const audit = seed.indexOf('npm run audit:verticals:db');
  const check = seed.indexOf('npm run audit:shutdown-availability');
  assert.ok(dry > 0 && dry < backup && backup < apply && apply < audit && audit < check, `${dry} ${backup} ${apply} ${audit} ${check}`);
  assert.match(seed, /--table=api_channel_prices --table=api_channel_price_variants/);

  // Daily scraper: runs after the API scrape step and never fails the job on its own.
  const daily = code('../../deploy/production/run-scrapers.sh');
  const scrape = daily.indexOf('npm run scrape\n');
  const sweepDaily = daily.indexOf('npm run seed:shutdown-availability -- --apply');
  const setE = daily.indexOf('set -e', sweepDaily);
  assert.ok(scrape > 0 && sweepDaily > scrape && setE > sweepDaily);
  assert.ok(daily.lastIndexOf('set +e', sweepDaily) > daily.lastIndexOf('set -e', sweepDaily));
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:shutdown-availability'], 'tsx scripts/seed-shutdown-availability.ts');
  assert.equal(pkg.scripts['audit:shutdown-availability'], 'tsx scripts/seed-shutdown-availability.ts --check');
});

test('migration adds the lock column and is registered with the deploy migrate step', () => {
  const migration = readFileSync(new URL('../../drizzle/0014_channel_availability_lock.sql', import.meta.url), 'utf8');
  for (const table of ['api_channel_prices', 'api_channel_price_variants']) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS availability_locked boolean NOT NULL DEFAULT false`));
  }
  assert.doesNotMatch(migration, /UPDATE|DELETE/i);
  const runner = readFileSync(new URL('../migrate-data-accuracy.ts', import.meta.url), 'utf8');
  assert.match(runner, /037_channel_availability_lock[\s\S]{0,120}0014_channel_availability_lock\.sql/);
  const queries = readFileSync(new URL('../db/queries.ts', import.meta.url), 'utf8');
  assert.match(queries, /isAvailabilityLocked\(existing\)\) row\.is_available = false/);
});
