#!/usr/bin/env tsx
/** Optional SRE seed. Not part of deploy or seed-catalog.sh. Default dry-run; --apply writes one transaction.
 * Updates the 24 cloudflare-* Workers AI rows from shutdown_date 2026-11-15 to 2026-11-20,
 * and rewrites description text that still names the old day. Never inserts.
 * Never updates a non-cloudflare slug (kimi / glm / deepseek official rows). */
import {
  planWorkersAiDeprecationDate, workersAiDateSeedOptions, WORKERS_AI_CORRECTION_SLUGS,
  type WorkersAiDateRow,
} from './data/catalog-2026-11-07-workers-ai-deprecation-date';

interface DbRow {
  id: number;
  slug: string;
  shutdown_date: string | null;
  description: string | null;
  provider_slugs: string[] | null;
}

export async function runWorkersAiDeprecationDateSeed(apply: boolean) {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    console.log(`seed-catalog-2026-11-07-workers-ai-deprecation-date [${apply ? 'APPLY' : 'DRY-RUN'}]`);
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const rows = await tx<DbRow[]>`
        SELECT m.id, m.slug, m.shutdown_date::text AS shutdown_date, m.description,
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
        WHERE m.slug IN ${tx(WORKERS_AI_CORRECTION_SLUGS)}
          AND m.slug LIKE 'cloudflare-%'
        ORDER BY m.slug`;
      const catalog: WorkersAiDateRow[] = rows.map(row => ({
        id: row.id, slug: row.slug, shutdown_date: row.shutdown_date, description: row.description,
        providerSlugs: row.provider_slugs ?? [],
      }));
      const plan = planWorkersAiDeprecationDate(catalog);
      console.log(JSON.stringify(plan, null, 2));
      console.log(`Cloudflare rows: insert ${plan.inserts.length}, update ${plan.updates.length}. Missing: ${plan.skipped.filter(row => row.status === 'missing').length}. Skipped non-exclusive: ${plan.skipped.filter(row => row.status === 'not-exclusive-cloudflare').length}. Non-Cloudflare slugs left unchanged: ${plan.untouched.length}.`);
      if (!apply) {
        console.log('Dry-run: no writes. Only explicit --apply updates shutdown_date and description on exclusive cloudflare-* rows.');
        return;
      }
      const now = new Date();
      for (const update of plan.updates) {
        if (!update.slug.startsWith('cloudflare-') || !WORKERS_AI_CORRECTION_SLUGS.includes(update.slug)) {
          throw new Error(`Refusing to update non-Cloudflare slug ${update.slug}; nothing written.`);
        }
      }
      for (const update of plan.updates) {
        await tx`UPDATE models SET shutdown_date = ${update.to.shutdown_date}::date,
          description = ${update.to.description},
          updated_at = ${now}
          WHERE id = ${update.id} AND slug = ${update.slug} AND slug LIKE 'cloudflare-%'`;
      }
      console.log(`Applied 0 inserts and ${plan.updates.length} updates. Channel retirement on ${plan.updates[0]?.to.shutdown_date ?? '2026-11-20'} is the existing shutdown sweep, not this seed.`);
    });
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const { apply } = workersAiDateSeedOptions(process.argv.slice(2));
  runWorkersAiDeprecationDateSeed(apply).catch(error => { console.error(error); process.exitCode = 1; });
}
