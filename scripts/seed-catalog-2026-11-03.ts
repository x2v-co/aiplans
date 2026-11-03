#!/usr/bin/env tsx
/** Optional manual seed (Intel 2026-11-03). Default read-only dry-run; not part of deploy/rollout. */
import { catalog20261103SeedOptions, seedCatalog20261103 } from './data/catalog-2026-11-03';

const { apply } = catalog20261103SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261103(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.filter(s => s.action !== 'skip').length} changes, ${steps.filter(s => s.action === 'skip').length} skipped.`);
      console.log('Gemini 2.5 Pro/Flash: deprecated_at 2026-11-02 + replacement + changelog source; no shutdown_date (auto-route from 2026-12-01, endpoint stays up).');
      console.log('LongCat-2.5: meituan official CNY channel ¥2 / cache ¥0.04 / ¥8 per 1M (limited-time, no end date). OpenRouter rows come from the scraper.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
