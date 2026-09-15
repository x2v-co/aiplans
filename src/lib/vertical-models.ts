import { sql, TEXT_ARRAY } from '@/lib/db';
import { catalogForKind, type AiCatalogItem, type AiCatalogKind, type AiCatalogModality, type AiCatalogStatus } from '@/lib/ai-vertical-catalog';

const KIND_TO_CATEGORY: Partial<Record<AiCatalogKind, 'video' | 'music' | 'world'>> = {
  'video-model': 'video',
  'music-model': 'music',
  'world-model': 'world',
};

interface DbVerticalModelRow {
  name: string;
  slug: string;
  provider_name: string | null;
  provider_slug: string | null;
  description: string | null;
  offical_link: string | null;
  model_category: 'video' | 'music' | 'world';
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

function dbRowToCatalogItem(kind: AiCatalogKind, row: DbVerticalModelRow): AiCatalogItem {
  const sourceUrls = sourcesFromDescription(row.description);
  const pricingConfidence = confidenceFromDescription(row.description);
  return {
    kind,
    slug: row.slug,
    name: row.name,
    provider: row.provider_name ?? row.provider_slug ?? 'Unknown',
    providerSlug: row.provider_slug ?? undefined,
    status: statusFromDescription(row.description, row.open_source),
    pricing: pricingConfidence === 'not-commercial' ? 'Research / self-hosted compute' : 'See official source for current plan/API pricing',
    unit: row.pricing_unit ?? 'unknown',
    pricingUnit: row.pricing_unit ?? 'unknown',
    pricingConfidence,
    capabilities: row.capabilities ?? [],
    bestFor: row.description?.split('\n')[0] ?? `${row.name} ${row.model_category} model`,
    url: row.offical_link ?? sourceUrls?.[0]?.url,
    modelCategory: row.model_category,
    inputModalities: toModalities(row.input_modalities),
    outputModalities: toModalities(row.output_modalities),
    access: row.open_source ? ['open-weights'] : ['consumer-app'],
    sourceUrls,
    lastVerified: verifiedFromDescription(row.description),
  };
}

export async function getVerticalModelCatalog(kind: AiCatalogKind): Promise<AiCatalogItem[]> {
  const category = KIND_TO_CATEGORY[kind];
  if (!category) return catalogForKind(kind);

  try {
    const rows = await sql<DbVerticalModelRow[]>`
      SELECT
        m.name,
        m.slug,
        p.name AS provider_name,
        p.slug AS provider_slug,
        m.description,
        m.offical_link,
        m.model_category,
        COALESCE(m.input_modalities, ${sql.array([], TEXT_ARRAY)}) AS input_modalities,
        COALESCE(m.output_modalities, ${sql.array([], TEXT_ARRAY)}) AS output_modalities,
        COALESCE(m.capabilities, ${sql.array([], TEXT_ARRAY)}) AS capabilities,
        m.pricing_unit,
        m.open_source
      FROM models m
      LEFT JOIN LATERAL (
        SELECT providers.name, providers.slug
        FROM providers
        WHERE providers.id = ANY(m.provider_ids)
        ORDER BY providers.priority NULLS LAST, providers.id
        LIMIT 1
      ) p ON true
      WHERE m.model_category = ${category}
      ORDER BY p.priority NULLS LAST, m.name ASC
    `;

    if (rows.length === 0) return catalogForKind(kind);
    return rows.map((row) => dbRowToCatalogItem(kind, row));
  } catch (error) {
    console.warn(`getVerticalModelCatalog(${kind}) falling back to static catalog`, error);
    return catalogForKind(kind);
  }
}
