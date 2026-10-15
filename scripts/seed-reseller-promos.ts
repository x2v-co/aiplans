#!/usr/bin/env tsx
/** Audit #6 repair: default read-only dry-run; --apply writes one transaction. */
import { databaseSql as sql } from './db/postgres-admin';
import { syncResellerPromos } from './db/promo-sync';
const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-reseller-promos.ts [--dry-run | --apply]');
}
syncResellerPromos(args.includes('--apply'), true)
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => sql.end());
