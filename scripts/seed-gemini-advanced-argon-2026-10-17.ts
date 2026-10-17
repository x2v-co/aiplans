#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { advancedArgonSeedOptions, seedAdvancedArgon } from './data/gemini-advanced-argon-2026-10-17';

const { apply } = advancedArgonSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedAdvancedArgon(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Only removes gemini-4-argon from google/gemini-advanced model_selector.exclude. Mappings are derived separately by materialize-model-plan-mappings.ts.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
