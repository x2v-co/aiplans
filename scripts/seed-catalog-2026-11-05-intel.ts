#!/usr/bin/env tsx
/** Optional manual Intel 11-05 seed; never part of deployment. Default read-only preview; --apply needs CTO/SRE approval. */
import { catalog20261105SeedOptions, seedCatalog20261105 } from './data/catalog-2026-11-05-intel';

const { apply } = catalog20261105SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261105(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      for (const table of ['providers', 'plans', 'models', 'usage_prices']) {
        const own = steps.filter(s => s.table === table);
        console.log(`${table}: ${own.filter(s => s.action === 'insert').length} insert, ${own.filter(s => s.action === 'update').length} update`);
      }
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
