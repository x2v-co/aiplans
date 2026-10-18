#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { seedVercelDeepSeekFlash1017, vercelFlash1017Options } from './data/vercel-deepseek-flash-1017-2026-10-18';

const { apply } = vercelFlash1017Options(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedVercelDeepSeekFlash1017(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Adds Vercel AI Gateway channel for deepseek/deepseek-v4.1-flash-1017 and appends Session affinity to provider notes.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
