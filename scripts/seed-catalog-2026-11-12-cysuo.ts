#!/usr/bin/env tsx
/**
 * Manual seed that adds 词元所 (cysuo.com) as a standalone CNY aggregator.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 * Does not apply to production by itself. Does not touch baidu or baidu-global.
 */
import {
  PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES, catalog20261112CysuoSeedOptions,
  seedCatalog20261112Cysuo, seedStepCounts,
} from './data/catalog-2026-11-12-cysuo';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261112CysuoSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261112Cysuo(tx as unknown as typeof sql, true));
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
    console.log('Expected production dry-run assumes cysuo is absent, nine catalog slugs already exist (GLM-5.1 at z-ai-glm-5-1, not glm-5.1), and the three dated cysuo-only slugs do not:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
