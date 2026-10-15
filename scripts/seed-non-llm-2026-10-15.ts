#!/usr/bin/env tsx
/** Optional SRE seed. Offline preview by default; --apply writes atomically. */
import { NON_LLM_CATALOG, MOONDREAM_SHUTDOWN } from '../src/lib/non-llm-catalog';
import { seedNonLlm } from './data/non-llm-seed';

const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: seed-non-llm-2026-10-15.ts [--dry-run | --apply]');
}
async function main() {
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'DRY-RUN (offline; no database connection)', models: NON_LLM_CATALOG,
      existingMoondreamUpdates: MOONDREAM_SHUTDOWN }, null, 2));
    console.log('Apply upserts providers, models, manual reference plans/mappings and usage prices; updates every existing Moondream lifecycle. Run with --apply to write.');
    return;
  }
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const steps = await seedNonLlm(rawTx as unknown as typeof sql, true);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`Applied: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
