#!/usr/bin/env tsx
/** Optional manual embedding seed. Default: read-only dry-run. Only --apply writes. --slug a,b narrows the run. */
import { embeddingSeedOptions, seedEmbeddings1106 } from './data/catalog-2026-11-06-embeddings';

const { apply, slugs } = embeddingSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedEmbeddings1106(tx, apply, slugs);
      console.log(JSON.stringify(steps, null, 2));
      for (const table of ['providers', 'models', 'usage_prices'] as const) {
        const own = steps.filter(step => step.table === table);
        console.log(`${table}: ${own.filter(step => step.action === 'insert').length} insert, ${own.filter(step => step.action === 'update').length} update`);
      }
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      if (slugs) console.log(`Slug filter: ${[...slugs].join(', ')}`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
