#!/usr/bin/env tsx
/** Optional SRE seed, never part of deploy/rollout. Default read-only dry-run.
 * Requires 0009_model_license; --apply writes atomically.
 */
import { step5SeedOptions, seedStep5License } from './data/step5-license';

const { apply } = step5SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedStep5License(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
