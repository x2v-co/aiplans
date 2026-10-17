#!/usr/bin/env tsx
/** Optional seed; never run during deploy or scraping. Default is a read-only preview. */
import { glimpseDeciderSeedOptions, seedGlimpseDecider } from './data/glimpse-decider-2026-10-17';

const { apply } = glimpseDeciderSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedGlimpseDecider(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      for (const step of steps.filter(step => step.table === 'providers' && step.action === 'insert')) {
        console.log(`${apply ? 'Created provider' : 'Would create provider'}: ${step.target}`);
      }
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
