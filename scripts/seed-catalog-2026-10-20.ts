#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or rollout. Default read-only dry-run. */
import { catalog20261020SeedOptions, seedCatalog20261020 } from './data/catalog-2026-10-20';

const { apply } = catalog20261020SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261020(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} steps.`);
      console.log('Reprices the existing azure-openai channel on openai-gpt-4 to GPT-4 8K $30/$60 (cached NULL) and writes 8K/32K context_band variants ($30/$60, $60/$120). Never creates the channel. Not part of deploy.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
