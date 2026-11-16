#!/usr/bin/env tsx
/** Manual only; no deployment hook. Default real-write rehearsal then ROLLBACK.
 * --apply is explicit and separate. Never import this CLI from tests.
 */
import { hy4FlashSeedOptions, seedHy4Flash } from './data/catalog-2026-11-16-hy4-flash';
import { runRehearsable } from './db/rehearsal';

const { apply } = hy4FlashSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedHy4Flash(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    console.log(apply ? `Applied ${steps.length} changes.` : `Rehearsal: ${steps.length} changes executed then ROLLBACK; nothing committed.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
