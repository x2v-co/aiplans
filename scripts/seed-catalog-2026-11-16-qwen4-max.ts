#!/usr/bin/env tsx
/** Manual only. Default rehearsal executes writes then ROLLBACK; --apply commits.
 * Never registered in deployment or old catalog seeds. Do not run against production
 * as part of implementation/verification. Plan mappings are explicitly deferred.
 */
import {
  catalog20261116Qwen4MaxSeedOptions, PRODUCTION_SHAPED_DRY_RUN,
  seedCatalog20261116Qwen4Max, seedStepCounts,
} from './data/catalog-2026-11-16-qwen4-max';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261116Qwen4MaxSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261116Qwen4Max(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    console.log(JSON.stringify(seedStepCounts(steps), null, 2));
    console.log(apply ? 'Applied.' : 'Rehearsal: writes executed then ROLLBACK; nothing committed.');
    console.log('Offline expected shape only: final model/aliases and final channels/variants absent; qwen, openrouter, vercel-ai-gateway exist. Plan mappings deferred.');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
