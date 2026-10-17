#!/usr/bin/env tsx
/** Optional seed. Default read-only dry-run; --apply writes one transaction. */
import { argonProSeedOptions, seedArgonPro } from './data/google-ai-pro-argon-2026-10-17';

const { apply } = argonProSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedArgonPro(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Updates existing Argon descriptions/Google notes and the google-ai-pro plan if present; no rows or prices are created. Gemini App access is unconfirmed.');
      console.log('Model-plan mappings are derived separately by materialize-model-plan-mappings.ts after selector review.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
