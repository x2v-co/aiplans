#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-14 Intel morning + noon aiplans gaps.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 *
 * DeepSeek OCR/file-parse and speech list prices also live in the static
 * api-pricing table. Copilot 12-14 deprecations are code-only. Microsoft
 * Foundry Claude retirement dates are not written (no first-party channel).
 */
import {
  catalog20261114IntelSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261114Intel, seedStepCounts,
} from './data/catalog-2026-11-14-intel';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261114IntelSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261114Intel(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of SEED_TABLES) console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    const skipped = steps.filter(step => step.action === 'skip');
    if (skipped.length) {
      console.log(`Skipped ${skipped.length}:`);
      for (const step of skipped) console.log(`  ${step.target}: ${step.reason}`);
    }
    console.log(apply
      ? `Applied: ${steps.filter(step => step.action !== 'skip').length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.filter(step => step.action !== 'skip').length} changes. Negative IDs are new rows.`);
    console.log('Expected production dry-run assumes vercel-ai-gateway, cloudflare, deepseek, the five Token Pass models, and embeddinggemma-300m already exist, and that parallel, zyphra, and the five new models do not:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
