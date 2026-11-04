#!/usr/bin/env tsx
/** Optional manual Intel seed; never part of deployment. Default read-only preview. */
import { catalog20261104SeedOptions, seedCatalog20261104 } from './data/catalog-2026-11-04';

const { apply } = catalog20261104SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261104(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      for (const table of ['providers', 'plans', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants']) {
        const own = steps.filter(s => s.table === table);
        console.log(`${table}: ${own.filter(s => s.action === 'insert').length} insert, ${own.filter(s => s.action === 'update').length} update`);
      }
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('Rows verified on/after 2026-11-04 SGT retain their verification timestamps and notes.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
