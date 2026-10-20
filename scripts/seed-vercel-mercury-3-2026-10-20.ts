#!/usr/bin/env tsx
/** Optional SRE seed. Default read-only dry-run; --apply writes one serializable transaction. */
import { seedVercelMercury3, vercelMercury3Options } from './data/vercel-mercury-3-2026-10-20';

const { apply } = vercelMercury3Options(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedVercelMercury3(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Adds/updates the Vercel AI Gateway channel on inception-mercury-3 at 50%-off launch price ($0.10/$0.35/cache $0.01). Does not create models or providers.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
