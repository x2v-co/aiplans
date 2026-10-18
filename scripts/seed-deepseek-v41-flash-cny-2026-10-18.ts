#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { v41FlashSeedOptions, seedV41FlashCny } from './data/deepseek-v41-flash-cny-2026-10-18';

const { apply } = v41FlashSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedV41FlashCny(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Only upserts the DeepSeek official CNY channel (+ peak/off-peak variants) on models/deepseek-v4.1-flash.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
