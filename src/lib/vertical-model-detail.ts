import { notFound } from 'next/navigation';
import { catalogForKind, type AiCatalogItem, type AiCatalogKind, type AiModelCategory } from '@/lib/ai-vertical-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import type { ModelBenchmarkScore } from '@/lib/benchmarks';
import type { PlanCoverageFields } from '@/lib/third-party-coverage';

const KIND_TO_CATEGORY: Partial<Record<AiCatalogKind, AiModelCategory>> = {
  'video-model': 'video',
  'music-model': 'music',
  'world-model': 'world',
  'decision-model': 'decision',
  'voice-model': 'speech',
  'image-model': 'image',
};

export interface VerticalModelPlanRow extends PlanCoverageFields {
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
  benchmarks: ModelBenchmarkScore[];
  source: 'db' | 'catalog';
}

/** Audited pricing is static; stale DB plans/usage rows never override it. */
export async function getVerticalModelDetail(kind: AiCatalogKind, slug: string): Promise<VerticalModelDetail> {
  if (!KIND_TO_CATEGORY[kind]) notFound();
  if ((['world-model', 'decision-model', 'voice-model', 'image-model'].includes(kind)) && !catalogForKind(kind).some(i => i.slug === slug)) notFound();
  const catalog = await getVerticalModelCatalog(kind);
  const item = catalog.find(entry => entry.slug === slug);
  if (!item) notFound();
  return { item, plans: [], usagePrices: [], benchmarks: [], source: 'catalog' };
}

export function verticalKindPath(kind: AiCatalogKind): string {
  if (kind === 'video-model') return 'video-models';
  if (kind === 'music-model') return 'music-models';
  if (kind === 'world-model') return 'world-models';
  if (kind === 'decision-model') return 'decision-models';
  if (kind === 'voice-model') return 'voice-models';
  if (kind === 'image-model') return 'image-models';
  return 'models';
}
