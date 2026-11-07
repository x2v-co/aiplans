#!/usr/bin/env tsx
/**
 * Manual seed for Liquid LFM3-1.7B and Humans& Ampersand v0.1.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import { catalog20261107NewModelsSeedOptions, seedCatalog20261107NewModels, seedStepCounts } from './data/catalog-2026-11-07-new-models';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261107NewModelsSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261107NewModels(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'api_channel_prices'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    console.log(apply
      ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Expected when liquid, openrouter and one Vercel provider already exist and humansand plus the three models do not: providers 1 insert (humansand), models 3 insert, api_channel_prices 4 insert.');
    console.log('LFM3-1.7B official and OpenRouter paid: USD 0.08 / 0.20 / cache 0.02 per 1M. OpenRouter liquid/lfm-3-1.7b:free: 0/0, cache NULL, prompts may train. Ampersand v0.1 on Vercel AI Gateway: 0/0/cache 0 through 2026-11-13 Pacific; regular prices NULL.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
