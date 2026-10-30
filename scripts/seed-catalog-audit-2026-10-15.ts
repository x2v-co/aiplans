#!/usr/bin/env tsx
/** Default dry-run; --apply writes one serializable transaction. Requires migration 0007. */
import { seedCatalogAudit } from './data/catalog-audit-seed';
import { parseSeedArgs } from './utils/seed-diff';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slug' && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
  if (args[i].startsWith('--slug=') && args[i].slice('--slug='.length).trim()) continue;
  if (['--apply', '--dry-run'].includes(args[i])) continue;
  throw new Error('Usage: seed-catalog-audit-2026-10-15.ts [--dry-run | --apply] [--slug a,b]');
}
if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run.');
const { apply, slugs } = parseSeedArgs(process.argv);
async function main() {
  if (!slugs) console.warn('WARNING: no --slug filter; --apply will write the full catalog audit, including historical prices, verification dates and shared plans.');
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalogAudit(tx, apply, slugs);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes. Negative IDs in dry-run represent new rows.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
