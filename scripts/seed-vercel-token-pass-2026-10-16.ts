#!/usr/bin/env tsx
/** Optional SRE seed. Default SELECT-only dry-run; --apply writes atomically.
 * Requires the deployed plans_plan_kind_chk that allows 'gateway_subscription'
 * (replayed by `npm run migrate` on rollout). Never part of rollout.
 */
import { seedVercelTokenPass, tokenPassSeedOptions } from './data/vercel-token-pass-2026-10-16';

const { apply } = tokenPassSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const { steps, missingModels } = await seedVercelTokenPass(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      if (missingModels.length) console.log(`Missing catalog models (not created; --apply will abort): ${missingModels.join(', ')}`);
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
