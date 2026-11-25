import { notFound, permanentRedirect } from 'next/navigation';
import { benchmarkBaseSlug, CATALOG_ONLY_DETAIL_KINDS, isBenchmarkOnlySlug, parentSlugFor } from '@/lib/vertical-model-aliases';
import { catalogForKind, type AiCatalogItem, type AiCatalogKind, type AiModelCategory } from '@/lib/ai-vertical-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import type { ModelBenchmarkScore } from '@/lib/benchmarks';
import type { PlanCoverageFields } from '@/lib/third-party-coverage';
import { getModelUsagePrices } from '@/lib/model-usage-prices-query';
import { availableUsagePrices } from '@/lib/model-usage-prices';
import { verticalShouldIndex } from '@/lib/seo-index-policy';

const KIND_TO_CATEGORY: Partial<Record<AiCatalogKind, AiModelCategory>> = {
  'video-model': 'video',
  'music-model': 'music',
  'world-model': 'world',
  'decision-model': 'decision',
  'voice-model': 'speech',
  'image-model': 'image',
  'embedding-model': 'embedding',
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

/** Audited headline pricing stays static; DB usage rows supply source/unit references. */
export async function getVerticalModelDetail(kind: AiCatalogKind, slug: string, locale?: string): Promise<VerticalModelDetail> {
  if (!KIND_TO_CATEGORY[kind]) notFound();
  if (CATALOG_ONLY_DETAIL_KINDS.includes(kind) && !catalogForKind(kind).some(i => i.slug === slug)) notFound();
  const catalog = await getVerticalModelCatalog(kind);
  let resolvedSlug = parentSlugFor(kind, slug) ?? slug;
  // Old Arena benchmark URLs (arena-t2v-<model>) were once in the sitemap:
  // 301 them to the model family / model page when one exists.
  const base = benchmarkBaseSlug(slug);
  if (base) {
    const target = parentSlugFor(kind, base) ?? (catalog.some(entry => entry.slug === base) ? base : undefined);
    if (target) resolvedSlug = target;
  }
  if (isBenchmarkOnlySlug(resolvedSlug)) notFound();
  const item = catalog.find(entry => entry.slug === resolvedSlug);
  if (!item) notFound();
  if (resolvedSlug !== slug && verticalShouldIndex(kind, resolvedSlug, item.shutdownDate)) {
    permanentRedirect(`/${locale ?? 'en'}/${verticalKindPath(kind)}/${resolvedSlug}`);
  }
  // An excluded destination still resolves the existing family mapping, but
  // renders at the original noindex alias instead of permanently redirecting.
  const usagePrices = kind === 'video-model'
    ? await getModelUsagePrices(resolvedSlug).catch(error => {
      console.warn(`getModelUsagePrices(${resolvedSlug}) failed`, error);
      return [];
    }) : [];
  return { item, plans: [], usagePrices: availableUsagePrices(usagePrices, true), benchmarks: catalogBenchmarks(kind, item), source: 'catalog' };
}

/**
 * Static benchmark summaries for decision models (e.g. AA Decision Index on Decider v1.3).
 * Other kinds keep their existing detail behaviour.
 */
export function catalogBenchmarks(kind: AiCatalogKind, item: AiCatalogItem): ModelBenchmarkScore[] {
  if (kind !== 'decision-model') return [];
  return (item.benchmarkSummaries ?? []).map(summary => ({
    benchmark_slug: summary.benchmarkSlug,
    benchmark_name: summary.benchmarkName,
    benchmark_type: 'decision',
    official_url: summary.officialUrl,
    version_label: summary.benchmarkName.match(/v\d+(?:\.\d+)*/)?.[0] ?? '',
    task_name: summary.taskName,
    metric_name: summary.metricName,
    unit: summary.unit,
    higher_better: true,
    value: summary.value,
    release_date: null,
  }));
}

export function verticalKindPath(kind: AiCatalogKind): string {
  if (kind === 'video-model') return 'video-models';
  if (kind === 'music-model') return 'music-models';
  if (kind === 'world-model') return 'world-models';
  if (kind === 'decision-model') return 'decision-models';
  if (kind === 'voice-model') return 'voice-models';
  if (kind === 'image-model') return 'image-models';
  if (kind === 'embedding-model') return 'embedding-models';
  return 'models';
}
