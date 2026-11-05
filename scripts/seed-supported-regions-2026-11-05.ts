#!/usr/bin/env tsx
/**
 * Manual seed: official supported-country lists for providers (verified 2026-11-05). Never part of rollout.
 * Requires migration 0016 (supported_regions columns) on the target database first.
 * Default: DB rehearsal dry-run (real writes inside a transaction, then ROLLBACK; nothing committed).
 * --apply writes atomically and needs separate approval.
 */
import { seedSupportedRegions } from './data/supported-regions-2026-11-05';
import { runRehearsable } from './db/rehearsal';

const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-supported-regions-2026-11-05.ts [--dry-run (default, rolled back) | --apply]');
}
const apply = args.includes('--apply');
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedSupportedRegions(tx as unknown as typeof sql));
    console.log(JSON.stringify(steps, null, 2));
    const updates = steps.filter(s => s.action === 'update').length;
    console.log(apply ? `Applied: ${updates} provider rows updated, ${steps.length - updates} unchanged.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${updates} provider rows would be updated, ${steps.length - updates} unchanged.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
