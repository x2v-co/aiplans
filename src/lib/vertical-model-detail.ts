import { notFound } from 'next/navigation';
import { sql, INT4_ARRAY } from '@/lib/db';
import { catalogForKind, type AiCatalogItem, type AiCatalogKind } from '@/lib/ai-vertical-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';

const KIND_TO_CATEGORY: Partial<Record<AiCatalogKind, 'video' | 'music' | 'world'>> = {
  'video-model': 'video',
  'music-model': 'music',
  'world-model': 'world',
};

export interface VerticalModelPlanRow {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  annual_price: number | null;
  currency: string | null;
  price_unit: string | null;
  tier: string | null;
  included_usage_unit: string | null;
  included_usage_amount: number | null;
  is_contact_sales: boolean | null;
  source: string | null;
  notes: string | null;
  last_verified: string | null;
  provider_name: string | null;
  provider_slug: string | null;
}

export interface VerticalUsagePriceRow {
  id: number;
  price_kind: string;
  unit: string;
  price: number | null;
  currency: string | null;
  source_url: string | null;
  last_verified: string | null;
  provider_name: string | null;
  provider_slug: string | null;
  plan_name: string | null;
  plan_slug: string | null;
}

export interface VerticalModelDetail {
  item: AiCatalogItem;
  plans: VerticalModelPlanRow[];
  usagePrices: VerticalUsagePriceRow[];
  source: 'db' | 'catalog';
}

async function getPlans(modelId: number): Promise<VerticalModelPlanRow[]> {
  const mappings = await sql<Array<{ plan_id: number | null }>>`
    SELECT plan_id FROM model_plan_mapping WHERE model_id = ${modelId}
  `;
  const planIds = mappings.map((mapping) => mapping.plan_id).filter((id): id is number => id != null);
  if (planIds.length === 0) return [];

  return sql<VerticalModelPlanRow[]>`
    SELECT
      pl.id,
      pl.name,
      pl.slug,
      pl.price,
      pl.annual_price,
      pl.currency,
      pl.price_unit,
      pl.tier,
      pl.included_usage_unit,
      pl.included_usage_amount,
      pl.is_contact_sales,
      pl.source,
      pl.notes,
      pl.last_verified::text AS last_verified,
      p.name AS provider_name,
      p.slug AS provider_slug
    FROM plans pl
    LEFT JOIN providers p ON p.id = pl.provider_id
    WHERE pl.id = ANY(${sql.array(planIds, INT4_ARRAY)})
    ORDER BY pl.price ASC NULLS LAST, pl.tier_rank ASC NULLS LAST, pl.name ASC
  `;
}

async function getUsagePrices(modelId: number): Promise<VerticalUsagePriceRow[]> {
  return sql<VerticalUsagePriceRow[]>`
    SELECT
      up.id,
      up.price_kind,
      up.unit,
      up.price,
      up.currency,
      up.source_url,
      up.last_verified::text AS last_verified,
      p.name AS provider_name,
      p.slug AS provider_slug,
      pl.name AS plan_name,
      pl.slug AS plan_slug
    FROM usage_prices up
    LEFT JOIN providers p ON p.id = up.provider_id
    LEFT JOIN plans pl ON pl.id = up.plan_id
    WHERE up.model_id = ${modelId} AND up.is_available = true
    ORDER BY up.price_kind ASC, up.price ASC NULLS LAST
  `;
}

export async function getVerticalModelDetail(kind: AiCatalogKind, slug: string): Promise<VerticalModelDetail> {
  const category = KIND_TO_CATEGORY[kind];
  if (!category) notFound();

  const [model] = await sql<Array<{ id: number }>>`
    SELECT id FROM models WHERE slug = ${slug} AND model_category = ${category} LIMIT 1
  `;

  if (model) {
    const catalog = await getVerticalModelCatalog(kind);
    const item = catalog.find((entry) => entry.slug === slug);
    if (!item) notFound();
    const [plans, usagePrices] = await Promise.all([getPlans(model.id), getUsagePrices(model.id)]);
    return { item, plans, usagePrices, source: 'db' };
  }

  const fallback = catalogForKind(kind).find((entry) => entry.slug === slug);
  if (!fallback) notFound();
  return { item: fallback, plans: [], usagePrices: [], source: 'catalog' };
}

export function verticalKindPath(kind: AiCatalogKind): string {
  if (kind === 'video-model') return 'video-models';
  if (kind === 'music-model') return 'music-models';
  if (kind === 'world-model') return 'world-models';
  return 'models';
}
