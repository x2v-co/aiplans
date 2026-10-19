#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or rollout. Default read-only dry-run. */
import { catalogP1SeedOptions, seedCatalogP1 } from './data/catalog-p1-2026-10-19';

const { apply } = catalogP1SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalogP1(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} steps.`);
      console.log('Updates Sonnet 4.5 shutdown fields, Z.ai international channel prices, and Qwen China ≤128K headlines plus context-band variants for catalog slugs that already exist. Missing slugs are skipped. Not part of deploy.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
