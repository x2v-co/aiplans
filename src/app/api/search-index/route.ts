import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Lightweight site-search index for the header command palette: one request
 * when the palette first opens, then all filtering/ranking runs client-side
 * via lib/search-match so typing stays instant. Only models with a live
 * detail target (an available channel or a plan) are included — the palette
 * must never link to a page that 404s or renders empty.
 */
export const dynamic = 'force-dynamic';

type ModelRow = { slug: string; name: string; provider_name: string | null; provider_slug: string | null };
type PlanRow = { id: number; name: string; provider_name: string; provider_slug: string };
type ProviderRow = { slug: string; name: string };

export async function GET() {
  try {
    const [models, plans, providers] = await Promise.all([
      sql<ModelRow[]>`
        SELECT m.slug, m.name,
               p.name AS provider_name,
               p.slug AS provider_slug
        FROM models m
        LEFT JOIN providers p ON p.id = m.provider_ids[1]
        WHERE m.type = 'llm'
          AND (
            EXISTS (
              SELECT 1 FROM api_channel_prices cp
              WHERE cp.model_id = m.id AND cp.is_available = true
            )
            OR EXISTS (
              SELECT 1 FROM model_plan_mapping mpm
              WHERE mpm.model_id = m.id AND mpm.plan_id IS NOT NULL
            )
          )
        ORDER BY m.name
      `,
      sql<PlanRow[]>`
        SELECT pl.id, pl.name,
               p.name AS provider_name,
               p.slug AS provider_slug
        FROM plans pl
        JOIN providers p ON p.id = pl.provider_id
        ORDER BY p.name, pl.name
      `,
      sql<ProviderRow[]>`
        SELECT slug, name
        FROM providers
        ORDER BY name
      `,
    ]);

    const payload = {
      models: models.map((m) => ({
        slug: m.slug,
        name: m.name,
        providerName: m.provider_name ?? null,
        providerSlug: m.provider_slug ?? null,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        providerName: p.provider_name,
        providerSlug: p.provider_slug,
      })),
      providers: providers.map((p) => ({ slug: p.slug, name: p.name })),
    };

    const response = NextResponse.json(payload);
    response.headers.set('Cache-Control', 'private, max-age=300');
    return response;
  } catch (error) {
    console.error('Error building search index:', error);
    return NextResponse.json({ error: 'Failed to build search index' }, { status: 500 });
  }
}
