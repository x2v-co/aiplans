#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-11 Gemini 4 Carbon paid-API update and
 * ERNIE-5.5-Flash-Preview. Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import { catalog20261111CarbonErnieSeedOptions, seedCatalog20261111CarbonErnie, seedStepCounts } from './data/catalog-2026-11-11-carbon-ernie';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261111CarbonErnieSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261111CarbonErnie(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    console.log(apply
      ? `Applied: ${steps.length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes. Negative IDs are new rows.`);
    console.log('Expected when google, vertex-ai, openrouter, one Vercel provider and baidu exist, Gemini 4 Carbon is still the locked October reference row, Vertex is $2/$10 with no cutoff, and baidu-global, the Carbon batch row and ERNIE-5.5-Flash-Preview do not: providers 1 insert (baidu-global), models 1 update and 2 insert, api_channel_prices 2 update and 6 insert, api_channel_price_variants 2 insert.');
    console.log('Gemini 4 Carbon Standard: USD 2/10/cache 0.10 through 2026-11-30, then 4/20/cache 0.20, promo_ends_at 2026-12-01T08:00:00.000Z. OpenRouter batch: 1/5/cache 0.05 then 2/10/cache 0.10. ERNIE CN peak promo CNY 1/4/cache 0.10 (list 2/8/cache 0.20); idle promo 0.5/2/cache 0.05. CN promo end is unpublished. Qianfan International and OpenRouter: USD 0.28/1.13/cache 0.028. Context 1024000. Seedream 5.5 is not seeded.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
