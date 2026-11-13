#!/usr/bin/env tsx
/**
 * Manual seed for the 2026-11-13 Intel catalog audit.
 * Never part of deploy or seed-catalog.sh.
 * Default: rehearsal dry-run (real writes inside a transaction, then ROLLBACK).
 * --apply commits. The :apply npm script is the only write entrypoint.
 */
import {
  PRODUCTION_SHAPED_DRY_RUN, catalog20261113AuditFixesSeedOptions,
  seedCatalog20261113AuditFixes, seedStepCounts,
} from './data/catalog-2026-11-13-audit-fixes';
import { runRehearsable } from './db/rehearsal';

const { apply } = catalog20261113AuditFixesSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedCatalog20261113AuditFixes(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const counts = seedStepCounts(steps);
    for (const table of ['providers', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants'] as const) {
      console.log(`${table}: ${counts[table].insert} insert, ${counts[table].update} update`);
    }
    const skipped = steps.filter(step => step.action === 'skip');
    if (skipped.length) {
      console.log('Skipped:');
      for (const step of skipped) console.log(`- ${step.table}/${step.target}: ${step.reason}`);
    }
    console.log(apply
      ? `Applied: ${steps.filter(step => step.action !== 'skip').length} changes.`
      : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.filter(step => step.action !== 'skip').length} changes. Negative IDs are new rows.`);
    console.log(`Documented production-shaped dry-run: ${JSON.stringify(PRODUCTION_SHAPED_DRY_RUN)}.`);
    console.log('Assumes existing official/producer providers elevenlabs, xai and qwen; existing models elevenlabs-scribe-v2 / v2-realtime, mistral-medium-3.5, gemini-3.1-flash-lite, mistral-devstral-2512, gpt-image-2, grok-imagine-video-1-5-agent and grok-imagine-video-720p; no qwen4-max-preview or new ElevenLabs models. Scribe rates go to $0.20 / $0.22 per hour; xAI video resolution rates flatten to official $0.080 and $0.050 per second; lifecycle dates as in the PR. gpt-image-2 snapshot and missing rows are skipped, not created. Long-context tiers and Alibaba Token Plan personal are not in this seed.');
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
