#!/usr/bin/env tsx
/** Manual only. Default writes inside a serializable transaction then ROLLBACK. */
import {
  catalog20261111TokenPlanH3ImageSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261111TokenPlanH3Image, seedStepCounts,
} from './data/catalog-2026-11-11-token-plan-h3-image';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261111TokenPlanH3ImageSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261111TokenPlanH3Image(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of SEED_TABLES) console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    console.log(apply ? `Applied ${steps.length} changes.` : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes.`);
    console.log('Expected production dry-run assumes qwen, minimax-china and minimax-global already exist, the three models, eight Token Plan rows and their mappings/usage prices are absent, and Coding Plan Pro is left intact:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
    console.log('Qwen standard monthly prices retained; eligible new-user promotion in notes. qwen4-max-preview subscription_only, no PAYG rows; night discount 待定 / pending. H3 standard token rates; ≥16,600,000-pixel conditional discount in notes/constraints only. No currency conversion.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
