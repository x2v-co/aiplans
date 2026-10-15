#!/usr/bin/env tsx
/** Default dry-run; --apply writes one serializable transaction. Requires migration 0007. */
import { seedCatalogAudit } from './data/catalog-audit-seed';
const args = process.argv.slice(2);
if (args.some(a => !['--apply', '--dry-run'].includes(a)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-catalog-audit-2026-10-15.ts [--dry-run | --apply]');
}
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  const apply = args.includes('--apply');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalogAudit(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
