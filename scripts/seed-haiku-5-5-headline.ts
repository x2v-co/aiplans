#!/usr/bin/env tsx
/** Default dry-run (READ ONLY transaction); --apply writes. */
import { seedHaikuHeadline } from './data/haiku-5-5-headline';
const args = process.argv.slice(2);
if (args.some(a => !['--apply', '--dry-run'].includes(a)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-haiku-5-5-headline.ts [--dry-run | --apply]');
}
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  const apply = args.includes('--apply');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedHaikuHeadline(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
