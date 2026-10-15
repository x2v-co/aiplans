#!/usr/bin/env tsx
/** Optional SRE seed. Default SELECT-only dry-run; --apply writes atomically.
 * Requires the deployed PR1 channel-terms migration. Never part of rollout.
 */
import { goSeedOptions, seedOpenCodeGo } from './data/opencode-go-2026-10-15';

const { apply } = goSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedOpenCodeGo(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
