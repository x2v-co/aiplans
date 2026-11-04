#!/usr/bin/env tsx
/** Optional SRE seed. Default read-only dry-run; --apply writes one serializable transaction. */
import { HY4_SLUG, hy4SeedOptions, seedHy4 } from './data/hy4-2026-11-04';

const { apply } = hy4SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedHy4(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log(`Adds ${HY4_SLUG} (Tencent) and its OpenRouter channel at the 50%-off price $0.417/$1.251/cache $0.021 (list $0.834/$2.501/$0.042 in notes). Does not create providers or an official Tencent channel.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
