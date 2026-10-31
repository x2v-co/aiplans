#!/usr/bin/env tsx
/** Optional manual seed. Default read-only dry-run; not part of deploy/rollout. */
import { catalog20261031SeedOptions, seedCatalog20261031 } from './data/catalog-2026-10-31';

const { apply } = catalog20261031SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261031(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Claude: supersede old Max 5x/20x slugs with Max/Ultra; keep historical rows and links. OpenAI: add GPT-6 Astra for Law and its single official promotional rate.');
      console.log('Run the standard model-plan mapping materializer separately after applying the reviewed seed.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
