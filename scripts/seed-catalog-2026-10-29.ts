#!/usr/bin/env tsx
/** Optional SRE seed (Intel audit 2026-10-29). Not part of deploy or rollout. Default read-only dry-run. */
import { catalog20261029SeedOptions, seedCatalog20261029 } from './data/catalog-2026-10-29';

const { apply } = catalog20261029SeedOptions(process.argv.slice(2));
async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const steps = await seedCatalog20261029(tx, apply);
      console.log(JSON.stringify(steps, null, 2));
      const writes = steps.filter(step => step.action !== 'skip').length;
      const skips = steps.length - writes;
      console.log(`${apply ? 'Applied' : 'Dry-run; no writes'}: ${writes} write steps, ${skips} skipped (see reason).`);
      console.log('Fixes stale 128K context windows (GPT-6 / GPT-6.1 to 1,050,000, GPT-5 family to 400,000), records the Kimi K2 deprecation source without a date, sets access_from_china=false on Claude Team, ChatGPT Business/Team and Google AI Ultra 20x, moves gemini-2.5-flash-image to shutdown 2027-03-15 and re-enables channels the shutdown sweep locked, and adds the zhipu-global GLM-5.3-FlashX and minimax-global MiniMax-M3.1-Flash channels. Not part of deploy.');
    });
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
