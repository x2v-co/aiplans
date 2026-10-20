#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy. Default read-only dry-run; --apply writes one serializable transaction. */
import { mimoSeedOptions, seedMimo20261020 } from './data/mimo-2026-10-20';

const { apply } = mimoSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedMimo20261020(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.filter(s => s.action !== 'skip').length} changes, ${steps.filter(s => s.action === 'skip').length} skipped.`);
      console.log('Sets shutdown 2026-10-21 + replacement on xiaomi-mimo-v2-5 / -v2-5-pro, adds official MiMo providers (CNY China, USD overseas) and official real-time + batch prices on 5 MiMo models. Does not create models or touch OpenRouter rows.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
