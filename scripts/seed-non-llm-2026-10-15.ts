#!/usr/bin/env tsx
/** Optional SRE seed. Offline preview by default; --db-dry-run reads production read-only; --apply writes atomically. */
import { NON_LLM_CATALOG, MOONDREAM_SHUTDOWN } from '../src/lib/non-llm-catalog';
import { seedNonLlm } from './data/non-llm-seed';

const args = process.argv.slice(2);
const modes = ['--apply', '--dry-run', '--db-dry-run'];
if (args.some(arg => !modes.includes(arg)) || args.filter(arg => modes.includes(arg)).length > 1) {
  throw new Error('Usage: seed-non-llm-2026-10-15.ts [--dry-run (offline) | --db-dry-run (read-only DB) | --apply]');
}
const dbDryRun = args.includes('--db-dry-run');
async function main() {
  if (!args.includes('--apply') && !dbDryRun) {
    console.log(JSON.stringify({ mode: 'DRY-RUN (offline; no database connection)', models: NON_LLM_CATALOG,
      existingMoondreamUpdates: MOONDREAM_SHUTDOWN }, null, 2));
    console.log('Apply upserts providers, models, manual reference plans/mappings and usage prices; updates every existing Moondream lifecycle. Run with --apply to write.');
    return;
  }
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      // Read-only transaction: any accidental write fails in PostgreSQL itself.
      if (dbDryRun) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedNonLlm(tx, !dbDryRun);
      console.log(JSON.stringify(steps, null, 2));
      console.log(dbDryRun ? `DB dry-run (read-only; no writes): ${steps.length} changes would be applied. Negative IDs are new rows.`
        : `Applied: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
