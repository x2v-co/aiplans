#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { deepseekOfficialSeedOptions, seedDeepSeekOfficialV41 } from './data/deepseek-official-v41-2026-10-22';

const { apply } = deepseekOfficialSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedDeepSeekOfficialV41(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Moves the DeepSeek official USD channel to models/deepseek-v4.1-flash and retires it on models/deepseek-v4-flash.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });