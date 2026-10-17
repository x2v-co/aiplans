#!/usr/bin/env tsx
/** Optional seed; never part of deploy/scrapers. Default READ ONLY dry-run.
 * --apply writes one serializable transaction. Requires price-variant and promo columns.
 */
import { beamSeedOptions, seedReflectionBeam } from './data/reflection-beam-2026-10-17';

const { apply } = beamSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedReflectionBeam(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
      console.log('reflection/beam + provider reflection: limited-time free, then paid (date/rates unknown). reflection/beam-free: stops when free offer ends. Paid upstreams are variants.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
