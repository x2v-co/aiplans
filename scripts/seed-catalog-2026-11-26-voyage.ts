#!/usr/bin/env tsx
/** Manual only; never registered in deploy/production/seed-catalog.sh.
 * Default is an OFFLINE fakeSeedTx rehearsal (no env/database required).
 * --db rehearses real writes then ROLLBACK against an explicitly supplied DATABASE_URL.
 * Only --apply (the :apply npm script) commits. No .env files are loaded.
 */
import {
  PRODUCTION_SHAPED_DRY_RUN, seedStepCounts, seedVoyage1126, voyageSeedOptions,
} from './data/catalog-2026-11-26-voyage';
import { fakeSeedTx } from './data/fake-seed-tx';
import { runRehearsable } from './db/rehearsal';

const { apply, db } = voyageSeedOptions(process.argv.slice(2));
async function main() {
  if (db) {
    if (!process.env.DATABASE_URL) throw new Error('--db/--apply requires an explicit DATABASE_URL; no .env files are loaded.');
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL, { max: 1 });
    try {
      const steps = await runRehearsable(sql, apply, tx => seedVoyage1126(tx as unknown as typeof sql, true));
      console.log(JSON.stringify(steps, null, 2));
      console.log(JSON.stringify(seedStepCounts(steps), null, 2));
      console.log(apply ? 'Applied.' : 'DB rehearsal: writes executed then ROLLBACK; nothing committed.');
    } finally { await sql.end(); }
  } else {
    const fixture = fakeSeedTx();
    const offlineSql = {
      async begin(_isolation: string, work: (tx: typeof fixture.tx) => Promise<unknown>) {
        const before = structuredClone(fixture.data);
        try { return await work(fixture.tx); }
        catch (error) { Object.assign(fixture.data, before); throw error; }
      },
    };
    const steps = await runRehearsable(offlineSql, false, tx => seedVoyage1126(tx, true));
    console.log('OFFLINE fakeSeedTx rehearsal: simulated writes rolled back; no database connection or constraint validation. NOT a production dry-run.');
    console.log(JSON.stringify(seedStepCounts(steps), null, 2));
  }
  console.log('Production-shaped expectation only: six models and their usage prices absent; voyage absent (provider inserts 0 if present). Not measured against production.');
  console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
