#!/usr/bin/env tsx
/** Default read-only dry-run; --apply writes one serializable transaction. */
import { opencodeSecurityOptions, seedOpenCodeConsoleSecurity } from './data/opencode-console-security-2026-10-18';

const { apply } = opencodeSecurityOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedOpenCodeConsoleSecurity(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
      console.log('Appends OpenCode Console BYOK security note to opencode-zen / opencode-go provider notes only.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
