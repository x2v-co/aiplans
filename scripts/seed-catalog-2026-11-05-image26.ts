#!/usr/bin/env tsx
/**
 * Manual seed for gpt-image-2.6-sunburst / gpt-image-2.6-flare (verified 2026-11-05). Never part of rollout.
 * Default: DB rehearsal dry-run (real writes inside a transaction, then ROLLBACK; nothing committed).
 * --apply writes atomically and needs separate CTO/SRE approval.
 */
import { IMAGE26_CATALOG, seedImage26Models } from './data/non-llm-seed';
import { runRehearsable } from './db/rehearsal';

const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-catalog-2026-11-05-image26.ts [--dry-run (default, rolled back) | --apply]');
}
const apply = args.includes('--apply');
async function main() {
  if (IMAGE26_CATALOG.length !== 2) throw new Error(`Expected 2 gpt-image-2.6 catalog rows, got ${IMAGE26_CATALOG.length}; nothing written.`);
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await runRehearsable(sql, apply, tx => seedImage26Models(tx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    const summary = ['providers', 'models', 'plans', 'model_plan_mapping', 'usage_prices'].map(t => `${t}=${steps.filter(s => s.table === t).length}`).join(' ');
    console.log(apply ? `Applied: ${steps.length} changes (${summary}).` : `Dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes would be applied (${summary}).`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
