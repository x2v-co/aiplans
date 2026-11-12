#!/usr/bin/env tsx
/**
 * Manual seed for ERNIE-Wizshot-ME (文心一镜微表情大模型).
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import {
  PRODUCTION_SHAPED_DRY_RUN, catalog20261112ErnieWizshotMeSeedOptions,
  seedCatalog20261112ErnieWizshotMe, seedStepCounts,
} from './data/catalog-2026-11-12-ernie-wizshot-me';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261112ErnieWizshotMeSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261112ErnieWizshotMe(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    console.log(apply
      ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Expected when providers.baidu already exists as official/producer and none of LOOKUP_SLUGS exist: providers 0 insert 0 update, models 1 insert 0 update, usage_prices 1 insert 0 update, api_channel_prices 0, api_channel_price_variants 0.');
    console.log('If a lookup slug already exists, the seed attaches baidu on that row (models 0 insert / 1 update, slug not rewritten) and still writes the usage_prices row. Price is CNY 0.7 per 1 second of video duration from the official Qianfan billing table. baidu-global is not written.');
    console.log(`Documented production-shaped dry-run: ${JSON.stringify(PRODUCTION_SHAPED_DRY_RUN)}.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
