#!/usr/bin/env tsx
/**
 * Manual seed for Ling-3.2-flash and Inkling 2 Small. Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import { catalog20261106LingInklingSeedOptions, seedCatalog20261106LingInkling, seedStepCounts } from './data/catalog-2026-11-06-ling-inkling';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261106LingInklingSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261106LingInkling(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'api_channel_prices', 'usage_prices'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    console.log(apply
      ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Expected when inclusionai and thinkingmachines already exist and neither model does: providers 0 insert/0 update, models 2 insert, api_channel_prices 2 insert, usage_prices 2 insert (Inkling train 64K and 256K).');
    console.log('Ling-3.2-flash: CNY 0/0 now; promo_ends_at, regular prices and cache read are NULL. Inkling 2 Small: USD prefill 0.30 / cache 0.03 / sample 1.00 per 1M tokens; train 1.50 (64K) / 3.00 (256K).');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
