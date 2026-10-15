import { sql, INT4_ARRAY, TEXT_ARRAY } from '@/lib/db';
import { catalogForKind, type AiBenchmarkSummary, type AiCatalogItem, type AiCatalogKind, type AiCatalogModality, type AiCatalogStatus, type AiModelCategory } from '@/lib/ai-vertical-catalog';
import { getVerticalProviderLogo } from '@/lib/vertical-provider-logos';
import { getVerticalBenchmarkSummary } from '@/lib/vertical-benchmarks';
import { isBenchmarkOnlySlug, parentSlugFor } from '@/lib/vertical-model-aliases';

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

interface DbUsagePriceRow { model_id: number; price: number; currency: string | null; unit: string; price_kind: string }

function dbBillingUnit(row: DbUsagePriceRow): AiCatalogItem['billingUnit'] | undefined {
  if (row.price_kind === 'video_second' || /second/i.test(row.unit)) return 'per_second';
  if (/song/i.test(row.unit)) return 'per_song';
  return undefined;
}

/** Lowest/highest DB usage price per model, only for units the UI can render. */
async function getDbPrices(modelIds: number[]): Promise<Map<number, { low: number; high: number; currency: string; billingUnit: NonNullable<AiCatalogItem['billingUnit']> }>> {
  const out = new Map<number, { low: number; high: number; currency: string; billingUnit: NonNullable<AiCatalogItem['billingUnit']> }>();
  if (modelIds.length === 0) return out;
  const rows = await sql<DbUsagePriceRow[]>`
    SELECT model_id, price, currency, unit, price_kind FROM usage_prices
    WHERE model_id = ANY(${sql.array(modelIds, INT4_ARRAY)}) AND price IS NOT NULL AND price > 0 AND COALESCE(is_available, true)
  `;
  for (const row of rows) {
    const billingUnit = dbBillingUnit(row);
    if (!billingUnit) continue;
    const currency = row.currency ?? 'USD';
    const prev = out.get(row.model_id);
    if (prev && (prev.billingUnit !== billingUnit || prev.currency !== currency)) continue;
    out.set(row.model_id, prev
      ? { ...prev, low: Math.min(prev.low, row.price), high: Math.max(prev.high, row.price) }
      : { low: row.price, high: row.price, currency, billingUnit });
  }
  return out;
}

type DbPrice = Awaited<ReturnType<typeof getDbPrices>> extends Map<number, infer V> ? V : never;

function dbRowToCatalogItem(kind: AiCatalogKind, row: DbVerticalModelRow, benchmarkSummaries: AiBenchmarkSummary[] = [], dbPrice?: DbPrice): AiCatalogItem {
  const sourceUrls = sourcesFromDescription(row.description);
  const pricingConfidence = confidenceFromDescription(row.description);
  const priceFields: Partial<AiCatalogItem> = dbPrice
    ? { priceStatus: 'priced', billingUnit: dbPrice.billingUnit, pricePerUnit: dbPrice.low, currency: dbPrice.currency, ...(dbPrice.high > dbPrice.low ? { pricePerUnitHigh: dbPrice.high } : {}) }
    : { priceStatus: 'not-public', pricePerUnit: null };
  return {
    kind,
    slug: row.slug,
    name: row.name,
    provider: row.provider_name ?? row.provider_slug ?? 'Unknown',
    providerSlug: row.provider_slug ?? undefined,
    providerLogoUrl: row.provider_logo_url ?? row.provider_logo ?? getVerticalProviderLogo(row.provider_slug),
    status: statusFromDescription(row.description, row.open_source),
    pricing: pricingConfidence === 'not-commercial' ? 'Research / self-hosted compute' : dbPrice ? 'Usage price from provider price table' : 'Price not publicly disclosed',
    unit: row.pricing_unit ?? 'unknown',
    pricingUnit: row.pricing_unit ?? 'unknown',
    pricingConfidence,
    ...priceFields,
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
    const listExtras = kind === 'video-model' || kind === 'music-model';
    const dbOnly = listExtras ? rows.filter((row) => !slugs.includes(row.slug) && !isBenchmarkOnlySlug(row.slug)) : [];
    // Version-level rows whose family is in the audited catalog merge into it.
    const childRows = new Map<string, DbVerticalModelRow[]>();
    const extraRows: DbVerticalModelRow[] = [];
    for (const row of dbOnly) {
      const parent = parentSlugFor(kind, row.slug);
      if (parent && slugs.includes(parent)) childRows.set(parent, [...(childRows.get(parent) ?? []), row]);
      else extraRows.push(row);
    }
    const benchmarkSummaries = await getBenchmarkSummaries([...matchingRows, ...dbOnly].map((row) => row.id));
    const auditedItems = items.map((item) => {
      const row = bySlug.get(item.slug!);
      const children = childRows.get(item.slug!) ?? [];
      if (!row && children.length === 0) return item;
      const own = row ? benchmarkSummaries.get(row.id) ?? [] : [];
      const merged = [...(own.length ? own : item.benchmarkSummaries ?? []), ...children.flatMap((child) => benchmarkSummaries.get(child.id) ?? [])];
      return {
        ...item,
        providerLogoUrl: row?.provider_logo_url ?? row?.provider_logo ?? item.providerLogoUrl,
        benchmarkSummaries: merged.length ? merged : item.benchmarkSummaries,
      };
    });
    const dbPrices = await getDbPrices(extraRows.map((row) => row.id)).catch((error) => {
      console.warn(`getDbPrices(${kind}) failed`, error);
      return new Map<number, DbPrice>();
    });
    const extras = extraRows.map((row) => dbRowToCatalogItem(kind, row, benchmarkSummaries.get(row.id) ?? [], dbPrices.get(row.id)));
    return [...auditedItems, ...extras];
  } catch (error) {
    console.warn(`getVerticalModelCatalog(${kind}) using static catalog without DB enrichment`, error);
    return items;
  }
}

export async function getVerticalModelCatalog(kind: AiCatalogKind): Promise<AiCatalogItem[]> {
  return KIND_TO_CATEGORY[kind] ? getStaticModelCatalog(kind) : catalogForKind(kind);
}
