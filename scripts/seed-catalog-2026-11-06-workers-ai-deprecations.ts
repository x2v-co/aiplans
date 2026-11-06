#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or seed-catalog.sh. Default dry-run; --apply writes one transaction. Never creates models. */
import { CF_SHUTDOWN_DATE, planWorkersAiDeprecations, workersAiSeedOptions, WORKERS_AI_CANDIDATE_SLUGS, type WorkersAiModelRow } from './data/catalog-2026-11-06-workers-ai-deprecations';

interface DbRow {
  id: number;
  slug: string;
  shutdown_date: string | null;
  deprecated_at: string | null;
  replacement_model: string | null;
  deprecation_source_url: string | null;
  provider_slugs: string[] | null;
}

export async function runWorkersAiDeprecationSeed(apply: boolean) {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    console.log(`seed-catalog-2026-11-06-workers-ai-deprecations [${apply ? 'APPLY' : 'DRY-RUN'}]`);
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const rows = await tx<DbRow[]>`
        SELECT m.id, m.slug, m.shutdown_date::text AS shutdown_date, m.deprecated_at::text AS deprecated_at,
               m.replacement_model, m.deprecation_source_url,
               COALESCE((
                 SELECT array_agg(DISTINCT p.slug)
                 FROM providers p
                 WHERE p.id = ANY(COALESCE(m.provider_ids, ARRAY[]::integer[]))
                    OR EXISTS (
                      SELECT 1 FROM api_channel_prices cp
                      WHERE cp.model_id = m.id AND cp.provider_id = p.id
                    )
               ), ARRAY[]::text[]) AS provider_slugs
        FROM models m
        WHERE m.slug IN ${tx(WORKERS_AI_CANDIDATE_SLUGS)}
        ORDER BY m.slug`;
      const catalog: WorkersAiModelRow[] = rows.map(row => ({
        id: row.id, slug: row.slug, shutdown_date: row.shutdown_date, deprecated_at: row.deprecated_at,
        replacement_model: row.replacement_model, deprecation_source_url: row.deprecation_source_url,
        providerSlugs: row.provider_slugs ?? [],
      }));
      const plan = planWorkersAiDeprecations(catalog);
      console.log(JSON.stringify(plan, null, 2));
      console.log(`Would update ${plan.updates.length} exclusive Workers AI rows. Skipped endpoints: ${plan.skipped.length}. Untouched lookalikes: ${plan.untouched.length}.`);
      if (!apply) {
        console.log('Dry-run: no writes. Only explicit --apply updates the listed rows.');
        return;
      }
      for (const update of plan.updates) {
        await tx`UPDATE models SET shutdown_date = ${update.to.shutdown_date}::date,
          deprecated_at = ${update.to.deprecated_at}::date,
          replacement_model = ${update.to.replacement_model},
          deprecation_source_url = ${update.to.deprecation_source_url},
          updated_at = ${new Date()}
          WHERE id = ${update.id} AND slug = ${update.slug}`;
      }
      console.log(`Applied ${plan.updates.length} model updates. Channel retirement on ${CF_SHUTDOWN_DATE} is the existing shutdown sweep, not this seed.`);
    });
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const { apply } = workersAiSeedOptions(process.argv.slice(2));
  runWorkersAiDeprecationSeed(apply).catch(error => { console.error(error); process.exitCode = 1; });
}
