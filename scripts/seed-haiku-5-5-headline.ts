#!/usr/bin/env tsx
/** Default dry-run (real writes, then ROLLBACK); --apply commits. */
import { seedHaikuHeadline } from './data/haiku-5-5-headline';
import { runRehearsable } from './db/rehearsal';
const args = process.argv.slice(2);
if (args.some(a => !['--apply', '--dry-run'].includes(a)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-haiku-5-5-headline.ts [--dry-run | --apply]');
}
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  const apply = args.includes('--apply');
  try {
    // Dry-run executes the real writes then rolls back, so constraint errors surface before --apply.
    const steps = await runRehearsable(sql, apply, tx => seedHaikuHeadline(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    console.log(`${apply ? 'Applied' : 'Dry-run (writes executed then ROLLBACK; nothing committed)'}: ${steps.length} changes.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
