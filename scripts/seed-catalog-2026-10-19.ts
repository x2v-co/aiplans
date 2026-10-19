#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or rollout. Default read-only dry-run. */
import { catalogSeedOptions, seedCatalog20261019 } from './data/catalog-2026-10-19';

const { apply } = catalogSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261019(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Updates anthropic claude-team and claude-team-premium seat prices, grok-code-fast-1 shutdown fields, and removes the stale Codex Mini verification sentence. Does not change token prices.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
