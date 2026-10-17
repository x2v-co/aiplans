#!/usr/bin/env tsx
/** Default read-only dry-run. --apply updates one existing official channel atomically. */
import { mistralLarge4SeedOptions, seedMistralLarge4Promo } from './data/mistral-large-4-promo';

const { apply } = mistralLarge4SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedMistralLarge4Promo(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
