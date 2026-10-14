#!/usr/bin/env tsx
/** Default: read-only dry run. Only --apply writes; never creates model rows. */
import { OPENAI_SHUTDOWNS, planOpenAIShutdowns, shutdownSeedMode, type ShutdownModelRow } from './data/openai-shutdowns';

async function main() {
  // Validate before loading DB configuration or opening any connection.
  const mode = shutdownSeedMode(process.argv.slice(2));
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    console.log(`seed-openai-shutdowns [${mode.toUpperCase()}]`);
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (mode === 'dry-run') await tx`SET TRANSACTION READ ONLY`;
      const slugs = [...new Set(OPENAI_SHUTDOWNS.flatMap(item => [...item.ids, ...(item.aliasSlug ? [item.aliasSlug] : [])]))];
      const rows = await tx<ShutdownModelRow[]>`
        SELECT id, slug, shutdown_date::text, replacement_model, deprecation_source_url
        FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
      const plan = planOpenAIShutdowns(rows);
      console.log(JSON.stringify(plan, null, 2));
      console.log(`Matched ${plan.matches.filter(item => item.slug).length} API IDs; ${plan.updates.length} model rows would change.`);
      console.log('IDs without a matching row:', plan.matches.filter(item => !item.slug).map(item => item.apiId).join(', ') || '(none)');
      if (mode === 'dry-run') {
        console.log('Dry-run: no writes. Only explicit --apply updates the listed rows.');
        return;
      }
      for (const update of plan.updates) {
        await tx`UPDATE models SET ${tx({ ...update.to, updated_at: new Date() })}
                 WHERE id = ${update.id} AND slug = ${update.slug}`;
      }
      console.log(`Applied ${plan.updates.length} model updates in one transaction.`);
    });
  } finally {
    await sql.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
