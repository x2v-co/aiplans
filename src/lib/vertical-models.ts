import { sql, TEXT_ARRAY } from '@/lib/db';
import { catalogForKind, type AiBenchmarkSummary, type AiCatalogItem, type AiCatalogKind, type AiCatalogModality, type AiCatalogStatus, type AiModelCategory } from '@/lib/ai-vertical-catalog';
import { getVerticalProviderLogo } from '@/lib/vertical-provider-logos';
import { getVerticalBenchmarkSummary } from '@/lib/vertical-benchmarks';

const KIND_TO_CATEGORY: Partial<Record<AiCatalogKind, AiModelCategory>> = {
  'video-model': 'video',
  'music-model': 'music',
  'world-model': 'world',
  'decision-model': 'decision',
  'voice-model': 'speech',
  'image-model': 'image',
};

interface DbVerticalModelRow {
  id: number;
  name: string;
  slug: string;
  provider_name: string | null;
  provider_slug: string | null;
  provider_logo: string | null;
  provider_logo_url: string | null;
  description: string | null;
  offical_link: string | null;
  model_category: AiModelCategory;
  input_modalities: string[] | null;
  output_modalities: string[] | null;
  capabilities: string[] | null;
  pricing_unit: string | null;
  open_source: boolean | null;
}

function confidenceFromDescription(description: string | null): AiCatalogItem['pricingConfidence'] {
  const match = description?.match(/Pricing confidence: ([^.]+)\./i);
  const value = match?.[1];
  if (value === 'verified' || value === 'unit-only' || value === 'unknown' || value === 'not-commercial') {
    return value;
  }
  return 'unknown';
}

function verifiedFromDescription(description: string | null): string | undefined {
  return description?.match(/Last verified: (\d{4}-\d{2}-\d{2})\./i)?.[1];
}

function statusFromDescription(description: string | null, openSource: boolean | null): AiCatalogStatus {
  const match = description?.match(/Status: ([^.]+)\./i);
  const value = match?.[1];
  if (value === 'available' || value === 'waitlist' || value === 'preview' || value === 'research' || value === 'announced' || value === 'discontinued') {
    return value;
  }
  return openSource ? 'research' : 'available';
}

function sourcesFromDescription(description: string | null): AiCatalogItem['sourceUrls'] {
  const sources = description?.match(/Sources: ([\s\S]+)$/)?.[1];
  if (!sources) return undefined;
  return sources.split(' | ').map((part) => {
    const [publisher, ...urlParts] = part.split(': ');
    const url = urlParts.join(': ').trim();
    return { publisher: publisher.trim(), label: publisher.trim(), url };
  }).filter((source) => source.publisher && source.url.startsWith('https://'));
}

const MODALITIES: AiCatalogModality[] = ['text', 'image', 'video', 'audio', 'music', '3d', 'simulation', 'code', 'robotics'];

function toModalities(values: string[] | null): AiCatalogModality[] {
  return (values ?? []).filter((value): value is AiCatalogModality => MODALITIES.includes(value as AiCatalogModality));
}

async function getBenchmarkSummaries(modelIds: number[]): Promise<Map<number, AiBenchmarkSummary[]>> {
  const byModel = new Map<number, AiBenchmarkSummary[]>();
  await Promise.all(modelIds.map(async (modelId) => {
    try {
      byModel.set(modelId, await getVerticalBenchmarkSummary(modelId));
    } catch (error) {
      console.warn(`getVerticalBenchmarkSummary(${modelId}) failed`, error);
      byModel.set(modelId, []);
    }
  }));
  return byModel;
}

function dbRowToCatalogItem(kind: AiCatalogKind, row: DbVerticalModelRow, benchmarkSummaries: AiBenchmarkSummary[] = []): AiCatalogItem {
  const sourceUrls = sourcesFromDescription(row.description);
  const pricingConfidence = confidenceFromDescription(row.description);
  return {
    kind,
    slug: row.slug,
    name: row.name,
    provider: row.provider_name ?? row.provider_slug ?? 'Unknown',
    providerSlug: row.provider_slug ?? undefined,
    providerLogoUrl: row.provider_logo_url ?? row.provider_logo ?? getVerticalProviderLogo(row.provider_slug),
    status: statusFromDescription(row.description, row.open_source),
    pricing: pricingConfidence === 'not-commercial' ? 'Research / self-hosted compute' : 'See official source for current plan/API pricing',
    unit: row.pricing_unit ?? 'unknown',
    pricingUnit: row.pricing_unit ?? 'unknown',
    pricingConfidence,
    priceStatus: 'needs-verification', pricePerUnit: null,
    needsVerification: ['No price supplied in the 2026-10-15 audit.'],
    capabilities: row.capabilities ?? [],
    bestFor: row.description?.split('\n')[0] ?? `${row.name} ${row.model_category} model`,
    url: row.offical_link ?? sourceUrls?.[0]?.url,
    modelCategory: row.model_category,
    inputModalities: toModalities(row.input_modalities),
    outputModalities: toModalities(row.output_modalities),
    access: row.open_source ? ['open-weights'] : ['consumer-app'],
    sourceUrls,
    lastVerified: verifiedFromDescription(row.description),
    benchmarkSummaries,
  };
}

/** Audited rows own identity/pricing; DB-only video/music rows remain unpriced. */
async function getStaticModelCatalog(kind: AiCatalogKind): Promise<AiCatalogItem[]> {
  const items = catalogForKind(kind);
  try {
    const slugs = items.map((item) => item.slug!);
    const rows = await sql<DbVerticalModelRow[]>`
      SELECT m.*, p.name AS provider_name, p.slug AS provider_slug, p.logo AS provider_logo, p.logo_url AS provider_logo_url
      FROM models m
      LEFT JOIN LATERAL (
        SELECT providers.name, providers.slug, providers.logo, providers.logo_url
        FROM providers
        WHERE providers.id = ANY(m.provider_ids)
        ORDER BY providers.priority NULLS LAST, providers.id
        LIMIT 1
      ) p ON true
      WHERE m.model_category = ${KIND_TO_CATEGORY[kind]!}
        AND (${kind === 'video-model' || kind === 'music-model'} OR m.slug = ANY(${sql.array(slugs, TEXT_ARRAY)}))
    `;
    const matchingRows = rows.filter((row) => slugs.includes(row.slug));
    const bySlug = new Map(matchingRows.map((row) => [row.slug, row]));
    const benchmarkSummaries = await getBenchmarkSummaries(matchingRows.map((row) => row.id));
    const auditedItems = items.map((item) => {
      const row = bySlug.get(item.slug!);
      if (!row) return item;
      const summaries = benchmarkSummaries.get(row.id);
      return {
        ...item,
        providerLogoUrl: row.provider_logo_url ?? row.provider_logo ?? item.providerLogoUrl,
        benchmarkSummaries: summaries?.length ? summaries : item.benchmarkSummaries,
      };
    });
    const extras = kind === 'video-model' || kind === 'music-model'
      ? rows.filter(row => !slugs.includes(row.slug)).map(row => dbRowToCatalogItem(kind, row)) : [];
    return [...auditedItems, ...extras];
  } catch (error) {
    console.warn(`getVerticalModelCatalog(${kind}) using static catalog without DB enrichment`, error);
    return items;
  }
}

export async function getVerticalModelCatalog(kind: AiCatalogKind): Promise<AiCatalogItem[]> {
  return KIND_TO_CATEGORY[kind] ? getStaticModelCatalog(kind) : catalogForKind(kind);
}
