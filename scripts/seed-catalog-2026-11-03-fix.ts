#!/usr/bin/env tsx
/** Optional manual seed (#301 follow-up): retire the shut-down Gemini API Veo 3.1 usage rows. Default read-only dry-run. */
import { catalog20261103FixSeedOptions, seedCatalog20261103Fix } from './data/catalog-2026-11-03-fix';

const { apply } = catalog20261103FixSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261103Fix(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`usage_prices: 0 insert, ${steps.length} update (ids: ${steps.map(s => s.id).join(', ') || 'none'})`);
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
