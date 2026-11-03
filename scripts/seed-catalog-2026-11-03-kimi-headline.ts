#!/usr/bin/env tsx
/** Optional manual seed (planprice audit 2026-11-03). Default read-only dry-run against the DB; not part of deploy/rollout. */
import { KIMI_HEADLINE_TARGET, kimiHeadlineSeedOptions, seedKimiHeadline20261103 } from './data/catalog-2026-11-03-kimi-headline';

const { apply } = kimiHeadlineSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedKimiHeadline20261103(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes (scope: ${KIMI_HEADLINE_TARGET} only).`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
