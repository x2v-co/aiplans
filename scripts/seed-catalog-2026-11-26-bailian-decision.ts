#!/usr/bin/env tsx
/** Manual seed only, never deploy/seed-catalog.sh. Default: writes then ROLLBACK. --apply commits. */
import {
  catalog20261126BailianDecisionSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261126BailianDecision, seedStepCounts,
} from './data/catalog-2026-11-26-bailian-decision';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261126BailianDecisionSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261126BailianDecision(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of SEED_TABLES) console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    console.log(apply ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Production-shaped dry-run expectation (not measured production data): official/producer qwen exists; these two models, official channels and regional variants are absent:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
