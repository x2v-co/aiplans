#!/usr/bin/env tsx
/** Repair the two existing Kimi cache-write rows. Offline preview by default. */
import { KIMI_CACHE_WRITES } from './data/catalog-2026-11-02';
import { catalog20261102bSeedOptions, seedCatalog20261102b } from './data/catalog-2026-11-02b';

const { apply } = catalog20261102bSeedOptions(process.argv.slice(2));
async function main() {
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'DRY-RUN (offline; no database connection)',
      provider: 'moonshot-global', model: 'kimi-k3.1-pro',
      updates: KIMI_CACHE_WRITES.map(spec => ({ variant_key: spec.key, is_headline: spec.headline })),
    }, null, 2));
    console.log('Preview only. --apply validates both existing rows and updates changed headline flags atomically.');
    return;
  }
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await sql.begin('isolation level serializable', rawTx => seedCatalog20261102b(rawTx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    console.log(`Applied: ${steps.length} changes.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
