#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-15 Intel morning aiplans gap (Qwen3.5 legacy shutdown).
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 *
 * ChatGPT Advanced/Standard voice retirement and Decider v1.3 AA scores are code-only.
 */
import {
  catalog20261115IntelSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261115Intel, seedStepCounts,
} from './data/catalog-2026-11-15-intel';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261115IntelSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261115Intel(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of SEED_TABLES) console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    const skipped = steps.filter(step => step.action === 'skip');
    if (skipped.length) {
      console.log(`Skipped ${skipped.length}:`);
      for (const step of skipped) console.log(`  ${step.target}: ${step.reason}`);
    }
    console.log(apply
      ? `Applied: ${steps.filter(step => step.action !== 'skip').length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.filter(step => step.action !== 'skip').length} changes. Negative IDs are new rows.`);
    console.log('Expected production dry-run assumes the four Qwen3.5 rows exist without a shutdown_date and qwen3.5-397b-a17b has one Qwen official channel:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
