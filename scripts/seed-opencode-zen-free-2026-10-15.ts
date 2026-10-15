#!/usr/bin/env tsx
/** Optional SRE seed, never part of deploy/rollout. Requires introductory-price columns (drizzle 0002).
 * Default read-only dry-run; --apply writes atomically.
 */
import { zenSeedOptions, seedOpenCodeZenFree } from './data/opencode-zen-free-2026-10-15';

const { apply } = zenSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedOpenCodeZenFree(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log("Verified free on OpenCode Zen for a limited time (no end date, no context limit published). Paid list price kept in regular_* columns.");
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
