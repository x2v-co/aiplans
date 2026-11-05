#!/usr/bin/env tsx
/** Optional manual Intel seed; never part of deploy. Default read-only dry-run (11-03 P1 convention). */
import { catalog202611051800SeedOptions, seedCatalog202611051800 } from './data/catalog-2026-11-05-1800';

const { apply } = catalog202611051800SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog202611051800(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      for (const table of ['providers', 'models', 'api_channel_prices']) {
        const own = steps.filter(s => s.table === table);
        console.log(`${table}: ${own.filter(s => s.action === 'insert').length} insert, ${own.filter(s => s.action === 'update').length} update`);
      }
      const kimi = steps.find(s => s.target === 'kimi-k3.1-pro/open-weights')!;
      console.log(`Kimi K3.1 Pro open_source: ${kimi.action === 'skip' ? 'unchanged (already true)' : 'changes to true'}.`);
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.filter(s => s.action !== 'skip').length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('ERNIE: model metadata only; no official API price, no price rows. Context uses max inference (1,048,576), training context 131,072.');
      console.log('Rows with last_verified >= 2026-11-05 SGT keep their last_verified and notes.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
