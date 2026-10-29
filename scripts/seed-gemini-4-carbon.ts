#!/usr/bin/env tsx
import { databaseSql as sql } from './db/postgres-admin';
import { carbonSeedOptions, seedCarbon } from './data/gemini-4-carbon';

async function main() {
  const { apply } = carbonSeedOptions(process.argv.slice(2));
  console.log(`seed-gemini-4-carbon [${apply ? 'APPLY' : 'DRY-RUN'}]`);
  // Dry-run is SELECT-only. Apply uses one transaction owned by this caller.
  const steps = apply
    ? await sql.begin('isolation level serializable', tx => seedCarbon(tx as unknown as typeof sql, true))
    : await seedCarbon(sql);
  console.log(JSON.stringify(steps, null, 2));
  console.log(`Planned: ${steps.length} row changes. ${apply ? 'Applied in one transaction.' : 'Dry-run: no writes; new channel model_id=null means the inserted model ID.'}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());
