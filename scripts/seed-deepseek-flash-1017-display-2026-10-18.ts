#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { flash1017DisplayOptions, seedDeepSeekFlash1017Display } from './data/deepseek-flash-1017-display-2026-10-18';

const { apply } = flash1017DisplayOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedDeepSeekFlash1017Display(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Only updates display name/description on deepseek-v4-flash and deepseek-v4.1-flash; does not touch prices.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
