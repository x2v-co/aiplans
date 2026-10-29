#!/usr/bin/env tsx
/** Optional SRE seed, never part of rollout. Default read-only dry-run.
 * Requires the deployed channel-terms migration; --apply writes atomically.
 */
import { copilotSeedOptions, seedCopilot } from './data/copilot-2026-10-15';

const { apply } = copilotSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCopilot(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('Unverified: HydraFusion multiplier, Max/Standalone training policy, Max preview availability, annual pricing, regional access and payment methods. Missing catalog models are skipped.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
