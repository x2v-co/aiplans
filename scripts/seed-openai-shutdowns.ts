#!/usr/bin/env tsx
/** Default: read-only dry run. Only --apply writes; never creates model rows. */
import { OPENAI_SHUTDOWNS, planOpenAIShutdowns, shutdownSeedMode, type Shutdown, type ShutdownModelRow } from './data/openai-shutdowns';

export async function runShutdownSeed(shutdowns: readonly Shutdown[], mode: 'apply' | 'dry-run') {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    console.log(`seed-openai-shutdowns [${mode.toUpperCase()}]`);
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (mode === 'dry-run') await tx`SET TRANSACTION READ ONLY`;
      const slugs = [...new Set(shutdowns.flatMap(item => [...item.ids]))];
      const rows = await tx<ShutdownModelRow[]>`
        SELECT id, slug, shutdown_date::text, replacement_model, deprecation_source_url, deprecated_at::text
        FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const plan = planOpenAIShutdowns(rows, shutdowns);
      console.log(JSON.stringify(plan, null, 2));
      console.log(`Matched ${plan.matches.filter(item => item.slug).length} API IDs; ${plan.updates.length} model rows would change.`);
      for (const status of ['covered-by-family', 'snapshot-not-cataloged', 'not-present']) {
        const ids = plan.matches.filter(item => item.status === status).map(item => item.apiId);
        console.log(`${status} (${ids.length}):`, ids.join(', ') || '(none)');
      }
      // Include unchanged models: a later run must retire channels when the date arrives.
      // Use the transaction's UTC day and post-update dates so the preview matches --apply.
      const [clock] = await tx<Array<{ today: string }>>`SELECT (now() AT TIME ZONE 'UTC')::date::text AS today`;
      const retiredIds = plan.updates.filter(update => update.to.shutdown_date! <= clock.today).map(update => update.id);
      const retiringIds = plan.updates.filter(update => update.to.shutdown_date! > clock.today).map(update => update.id);
      // Preview matches the apply UPDATE below: only slugs this script owns.
      const retired = await tx`SELECT cp.id, m.slug, cp.is_available FROM api_channel_prices cp
        JOIN models m ON m.id = cp.model_id
        WHERE cp.is_available = true AND m.slug IN ${tx(slugs)}
          AND m.id NOT IN ${tx(retiringIds.length ? retiringIds : [-1])}
          AND (m.shutdown_date <= ${clock.today}::date OR m.id IN ${tx(retiredIds.length ? retiredIds : [-1])})`;
      const retiredVariants = await tx`SELECT v.id, m.slug FROM api_channel_price_variants v
        JOIN models m ON m.id = v.model_id
        WHERE v.is_available = true AND m.slug IN ${tx(slugs)}
          AND m.id NOT IN ${tx(retiringIds.length ? retiringIds : [-1])}
          AND (m.shutdown_date <= ${clock.today}::date OR m.id IN ${tx(retiredIds.length ? retiredIds : [-1])})`;
      console.log('Channels to disable:', JSON.stringify({ channels: retired, variants: retiredVariants }, null, 2));
      if (mode === 'dry-run') {
        console.log('Dry-run: no writes. Only explicit --apply updates the listed rows.');
        return;
      }
      for (const update of plan.updates) {
        await tx`UPDATE models SET ${tx({ ...update.to, updated_at: new Date() })}
                 WHERE id = ${update.id} AND slug = ${update.slug}`;
      }
      // Only OpenAI slugs listed in this script. Other vendors' past shutdown
      // dates (MiniMax, image models, grok-code-fast-1, …) stay untouched.
      for (const table of ['api_channel_prices', 'api_channel_price_variants']) {
        await tx`UPDATE ${tx(table)} SET is_available = false, updated_at = now()
          WHERE is_available = true AND model_id IN (SELECT id FROM models
            WHERE slug IN ${tx(slugs)}
              AND shutdown_date <= (now() AT TIME ZONE 'UTC')::date)`;
      }
      console.log(`Applied ${plan.updates.length} model updates in one transaction.`);
    });
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const mode = shutdownSeedMode(process.argv.slice(2));
  runShutdownSeed(OPENAI_SHUTDOWNS, mode).catch(error => { console.error(error); process.exitCode = 1; });
}
