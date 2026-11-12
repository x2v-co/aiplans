#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-12 Intel audit (P1-7 Gemini Decision 1).
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 * Does not apply to production by itself. P0-2, P0-3, P1-1, P1-5, P1-R, P1-8 and
 * P1-9 live in already-merged 11-11 seeds that still need a separate apply.
 * P1-6 is not seeded.
 */
import {
  catalog20261112AuditFixesSeedOptions, PRODUCTION_SHAPED_DRY_RUN, SEED_TABLES,
  seedCatalog20261112AuditFixes, seedStepCounts,
} from './data/catalog-2026-11-12-audit-fixes';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261112AuditFixesSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261112AuditFixes(tx as unknown as typeof sql, true));
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
    console.log('Expected production dry-run assumes google and vercel-ai-gateway already exist, and the model plus both channels are absent:');
    console.log(JSON.stringify(PRODUCTION_SHAPED_DRY_RUN, null, 2));
    console.log('Companion unapplied seeds: seed:catalog-2026-11-11-audit-fixes (P0-2, P0-3, P1-1, P1-5, P1-R) and seed:catalog-2026-11-11-token-plan-h3-image (P1-8, P1-9). P1-6 is not seeded.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
