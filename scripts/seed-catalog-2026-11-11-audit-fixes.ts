#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-11 Intel P0/P1 audit fixes.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 * Does not apply to production by itself. P2 is out of scope. P1-6 is not seeded.
 */
import {
  catalog20261111AuditFixesSeedOptions, seedCatalog20261111AuditFixes, seedStepCounts,
} from './data/catalog-2026-11-11-audit-fixes';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261111AuditFixesSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261111AuditFixes(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    const skipped = steps.filter(step => step.action === 'skip');
    if (skipped.length) {
      console.log(`Skipped ${skipped.length}:`);
      for (const step of skipped) console.log(`  ${step.target}: ${step.reason}`);
    }
    console.log(apply
      ? `Applied: ${steps.filter(step => step.action !== 'skip').length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.filter(step => step.action !== 'skip').length} changes. Negative IDs are new rows.`);
    console.log('Expected when one row exists for each audit-named model, official openai/google/qwen channels already exist, no context-band variants exist yet, and alias rows (gpt-image-2-2026-04-21, V4 Flash Vision Exp, Gemini batch SKUs, openai-gpt-6-* duplicates) do not: providers 0 insert, 0 update; models 0 insert, 9 update; api_channel_prices 0 insert, 15 update; api_channel_price_variants 0 update, 29 insert.');
    console.log('P1-6 is not in this seed: docs.x.ai pricing and the grok-imagine-video-1.5 model page still publish resolution tiers, which match the catalog.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
