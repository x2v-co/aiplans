#!/usr/bin/env tsx
/**
 * Manual seed for Claude Fable 5.2 batch, the Fable latest alias, Nex-N2.6,
 * and the Inkling 2 Small OpenRouter :free route.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import { catalog20261110FableNexInklingSeedOptions, seedCatalog20261110FableNexInkling, seedStepCounts } from './data/catalog-2026-11-10-fable-nex-inkling';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261110FableNexInklingSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261110FableNexInkling(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'api_channel_prices'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    console.log(apply
      ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Expected when anthropic, openrouter and thinkingmachines exist, ~anthropic-claude-fable-latest is still $10/$50 with last_verified at or before 2026-11-10T00:00:00Z, and nex-agi plus the batch, Nex-N2.6 and Inkling :free models do not: providers 1 insert (nex-agi), models 3 insert, api_channel_prices 3 insert and 1 update.');
    console.log('Fable 5.2 batch OpenRouter channel: USD 4 / 20 / cache 0.10 per 1M. Fable latest alias: USD 8 / 40 / cache 0.20. Nex-N2.6: USD 0.12 / 0.40 / cache 0.024, context 262144. Inkling 2 Small :free: 0/0, cache NULL. Paid Inkling, Workers AI, LFM3-1.7B and Ampersand are not written.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
