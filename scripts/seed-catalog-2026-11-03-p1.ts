#!/usr/bin/env tsx
/** Optional manual seed (Intel 2026-11-03 P1-1 Veo, P1-2 decision models). Default read-only dry-run; not part of deploy/rollout. */
import { catalog20261103P1SeedOptions, seedCatalog20261103P1 } from './data/catalog-2026-11-03-p1';

const { apply } = catalog20261103P1SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261103P1(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      for (const table of ['providers', 'models', 'usage_prices', 'api_channel_prices']) {
        const own = steps.filter(s => s.table === table);
        console.log(`${table}: ${own.filter(s => s.action === 'insert').length} insert, ${own.filter(s => s.action === 'update').length} update`);
      }
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('Rows with last_verified >= 2026-11-03 (scraper refreshed) keep their last_verified and notes.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
