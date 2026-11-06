#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or seed-catalog.sh. Default dry-run; --apply writes one transaction.
 * Inserts missing Workers AI rows as cloudflare-<model id>. Never updates a non-Cloudflare provider's row. */
import { CF_DEPRECATION_SOURCE, CF_SHUTDOWN_DATE, planWorkersAiDeprecations, workersAiSeedOptions, WORKERS_AI_CANDIDATE_SLUGS, type WorkersAiModelRow } from './data/catalog-2026-11-06-workers-ai-deprecations';

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
      const [provider] = await tx<Array<{ id: number; slug: string }>>`SELECT id, slug FROM providers WHERE slug = ${'cloudflare'}`;
      console.log(JSON.stringify({ provider: provider?.slug ?? null, ...plan }, null, 2));
      console.log(`Cloudflare rows: insert ${plan.inserts.length}, update ${plan.updates.length}. Skipped endpoints: ${plan.skipped.length}. Non-Cloudflare rows left unchanged: ${plan.untouched.length}.`);
      if (!apply) {
        console.log('Dry-run: no writes. Only explicit --apply inserts missing cloudflare-<id> rows and updates exclusive Cloudflare rows.');
        return;
      }
      let providerId = provider?.id;
      if (providerId == null) {
        const providerRow = {
          slug: 'cloudflare', name: 'Cloudflare', type: 'producer', region: 'global',
          website: 'https://developers.cloudflare.com/workers-ai/', access_from_china: null,
          notes: `Identity verified 2026-11-05 (Workers AI deprecations). Other provider metadata unverified. Source: ${CF_DEPRECATION_SOURCE}`,
        };
        const [created] = await tx<Array<{ id: number }>>`INSERT INTO providers ${tx(providerRow, ...Object.keys(providerRow))} RETURNING id`;
        providerId = created.id;
      }
      const now = new Date();
      for (const insert of plan.inserts) {
        const row = { ...insert.values, provider_ids: [providerId], updated_at: now };
        await tx`INSERT INTO models ${tx(row, ...Object.keys(row))}`;
      }
      for (const update of plan.updates) {
        await tx`UPDATE models SET shutdown_date = ${update.to.shutdown_date}::date,
          deprecated_at = ${update.to.deprecated_at}::date,
          replacement_model = ${update.to.replacement_model},
          deprecation_source_url = ${update.to.deprecation_source_url},
          updated_at = ${now}
          WHERE id = ${update.id} AND slug = ${update.slug}`;
      }
      console.log(`Applied ${plan.inserts.length} inserts and ${plan.updates.length} updates. Channel retirement on ${CF_SHUTDOWN_DATE} is the existing shutdown sweep, not this seed.`);
    });
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const { apply } = workersAiSeedOptions(process.argv.slice(2));
  runWorkersAiDeprecationSeed(apply).catch(error => { console.error(error); process.exitCode = 1; });
}
