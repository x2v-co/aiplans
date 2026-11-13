#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-13 18:00 Intel brief (Perplexity Decider v1.3).
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 * Brave x402 and Octen prices live in the static api-pricing table, not this seed.
 * Muse consumer Power/Maximum plans are not seeded.
 */
import {
  catalog20261113DeciderSearchApisSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261113DeciderSearchApis, seedStepCounts,
} from './data/catalog-2026-11-13-decider-search-apis';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261113DeciderSearchApisSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261113DeciderSearchApis(tx as unknown as typeof sql, true));
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
    console.log('Expected production dry-run assumes perplexity, vercel-ai-gateway, and openrouter already exist, and the two models plus six channels are absent:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
