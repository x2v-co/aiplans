#!/usr/bin/env tsx
/** Manual one-row fix for plans/google-ai-plus; never part of deployment. Default: rehearsal dry-run (real write in a transaction, then ROLLBACK); --apply needs boss approval. */
import { runRehearsable } from './db/rehearsal';
import { googleAiPlusSeedOptions, seedGoogleAiPlus20261105 } from './data/google-ai-plus-2026-11-05';

const { apply } = googleAiPlusSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await runRehearsable(sql, apply, async rawTx => {
      const steps = await seedGoogleAiPlus20261105(rawTx as unknown as typeof sql);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run (writes executed then ROLLBACK; nothing committed)'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
