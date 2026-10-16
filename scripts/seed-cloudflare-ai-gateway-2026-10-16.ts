#!/usr/bin/env tsx
/** Optional SRE seed: Cloudflare AI Gateway (Unified Billing) as a pay-as-you-go aggregator provider.
 * Default SELECT-only dry-run; --apply writes atomically. No migration required. Never part of rollout.
 */
import { cfGatewaySeedOptions, seedCloudflareAiGateway } from './data/cloudflare-ai-gateway-2026-10-16';

const { apply } = cfGatewaySeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCloudflareAiGateway(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${steps.length} changes.`);
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
