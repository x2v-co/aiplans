#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { claudeCreditSeedOptions, seedClaudeApiCredits } from './data/claude-api-credits-2026-10-18';

const { apply } = claudeCreditSeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedClaudeApiCredits(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Only updates monthly_api_credit_usd/status, notes and last_verified on anthropic claude-max-5x, claude-max-20x, claude-team, claude-team-premium.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
