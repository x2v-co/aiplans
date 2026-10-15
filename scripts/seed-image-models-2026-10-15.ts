#!/usr/bin/env tsx
/** Optional SRE seed for the image-model catalog. Offline preview by default; --db-dry-run executes the real writes then ROLLBACK; --apply writes atomically. */
import { IMAGE_MODEL_CATALOG } from '../src/lib/image-model-catalog';
import { seedImageModels } from './data/non-llm-seed';
import { runRehearsable } from './db/rehearsal';

const args = process.argv.slice(2);
const modes = ['--apply', '--dry-run', '--db-dry-run'];
if (args.some(arg => !modes.includes(arg)) || args.filter(arg => modes.includes(arg)).length > 1) {
  throw new Error('Usage: seed-image-models-2026-10-15.ts [--dry-run (offline) | --db-dry-run (rehearsal, rolled back) | --apply]');
}
const dbDryRun = args.includes('--db-dry-run');
async function main() {
  if (!args.includes('--apply') && !dbDryRun) {
    console.log(JSON.stringify({ mode: 'DRY-RUN (offline; no database connection)', models: IMAGE_MODEL_CATALOG }, null, 2));
    console.log(`Apply upserts providers, ${IMAGE_MODEL_CATALOG.length} image models, reference plans/mappings and itemized usage prices. Run with --db-dry-run to diff against the DB, --apply to write.`);
    return;
  }
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    // --db-dry-run performs the real writes and then rolls back, so constraint errors show up now.
    const steps = await runRehearsable(sql, !dbDryRun, tx => seedImageModels(tx as unknown as typeof sql, true));
    const count = (table: string) => steps.filter(step => step.table === table).length;
    console.log(JSON.stringify(steps, null, 2));
    const summary = ['providers', 'models', 'plans', 'model_plan_mapping', 'usage_prices'].map(t => `${t}=${count(t)}`).join(' ');
    console.log(dbDryRun ? `DB dry-run (writes executed then ROLLBACK; nothing committed): ${steps.length} changes would be applied (${summary}).`
      : `Applied: ${steps.length} changes (${summary}).`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
