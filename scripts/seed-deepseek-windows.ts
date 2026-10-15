#!/usr/bin/env tsx
/** Optional SRE seed. Default SELECT-only dry-run; --apply writes atomically.
 * Uses existing price variants; never part of rollout.
 */
import { deepseekSeedOptions, seedDeepSeekWindows } from './data/deepseek-windows';

const { apply } = deepseekSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedDeepSeekWindows(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
