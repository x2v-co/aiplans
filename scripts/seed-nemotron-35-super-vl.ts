#!/usr/bin/env tsx
/** Default dry-run (real writes, then ROLLBACK); --apply commits. */
import { seedNemotronPrice } from './data/nemotron-35-super-vl-price';
import { runRehearsable } from './db/rehearsal';
const args = process.argv.slice(2);
if (args.some(a => !['--apply', '--dry-run'].includes(a)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-nemotron-35-super-vl.ts [--dry-run | --apply]');
}
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  const apply = args.includes('--apply');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedNemotronPrice(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const writes = steps.filter(s => s.action === 'update').length;
    console.log(`${apply ? 'Applied' : 'Dry-run (writes executed then ROLLBACK; nothing committed)'}: ${writes} updates, ${steps.length - writes} rows for review.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
