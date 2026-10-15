#!/usr/bin/env tsx
/** Optional SRE seed, never part of deploy/rollout. Requires channel-terms migration 0008.
 * Default read-only dry-run; --apply writes atomically.
 */
import { nemotronSeedOptions, seedNemotronLightning } from './data/nemotron-lightning-2026-10-15';

const { apply } = nemotronSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedNemotronLightning(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('Verified free on Vercel AI Gateway only; provider may retain prompts for model improvement. Cache rate, future pricing and retention duration are unverified.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
