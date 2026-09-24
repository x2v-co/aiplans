/**
 * XycAi pricing scraper — https://www.xyc.ai
 *
 * Public, unauthenticated machine-readable pricing endpoint provided by XycAi:
 *   GET https://www.xyc.ai/api/provider/pricing
 *
 * The endpoint returns public billed prices in CNY per 1M tokens.
 * Some models appear in multiple XycAi groups. The headline price intentionally
 * prefers the most stable / easiest-to-use public tier instead of mechanically
 * taking the cheapest row:
 *   企业版 (enterprise) → 工作流 (workflow) → 经济版 (economy) → 学习版 (study)
 * Remaining tiers are preserved in notes for transparency.
 *
 * NO FALLBACK DATA — fails loud when the endpoint shape changes.
 */

import type { ScrapedPrice, ScrapedPriceVariant, ScraperResult } from '../utils/validator';
import { validatePrice, slugify } from '../utils/validator';
import { normalizeModelName, normalizeSlug } from '../utils/model-normalizer';

const XYCAI_PRICING_API = 'https://www.xyc.ai/api/provider/pricing';
const XYCAI_PRICING_PAGE = 'https://docs.xyc.ai/models.html';
const XYCAI_DOCS = 'https://docs.xyc.ai/';

const MIN_PRICES = 60;

interface XycAiRow {
  model_name?: string;
  group_name?: string;
  input_price?: number | null;
  output_price?: number | null;
  cache_input_price?: number | null;
  cache_create_price?: number | null;
  enabled?: boolean;
  note?: string;
}

interface XycAiPayload {
  schema_version?: string;
  success?: boolean;
  data?: {
    currency?: string;
    price_unit?: string;
    site_name?: string;
    site_domain?: string;
    updated_at?: string;
    models?: XycAiRow[];
  };
}

interface CandidatePrice {
  row: XycAiRow;
  slug: string;
  input: number;
  output: number;
  cachedInput: number | null;
}

/**
 * Explicit aliases for XycAi model ids that differ from our canonical slugs.
 * For most rows normalizeSlug() is enough; keep this table small and only for
 * known collisions / upstream aliases.
 */
const MODEL_SLUG_OVERRIDES: Record<string, string> = {
  'claude-3-7-sonnet': 'claude-3.7-sonnet',
  'claude-fable-5-1': 'claude-fable-5.1',
  'claude-opus-4-5': 'claude-opus-4.5',
  'claude-opus-4-6': 'claude-opus-4.6',
  'claude-opus-4-7': 'claude-opus-4.7',
  'claude-opus-4-8': 'claude-opus-4.8',
  'claude-sonnet-4-5': 'claude-sonnet-4.5',
  'claude-sonnet-4-6': 'claude-sonnet-4.6',
  'gemini-flash-latest': 'gemini-flash',
  'gemini-pro-latest': 'gemini-pro',
  'mistral-large-latest': 'mistral-large',
  'open-mistral-nemo': 'mistral-nemo',
};

function cleanModelId(modelName: string): string {
  return modelName.trim().split('/').pop() ?? modelName.trim();
}

function canonicalSlug(modelName: string): string {
  const cleaned = cleanModelId(modelName);
  const normalized = normalizeSlug(cleaned);
  return MODEL_SLUG_OVERRIDES[cleaned] ?? MODEL_SLUG_OVERRIDES[normalized] ?? normalized;
}

function groupKind(groupName?: string): string {
  const group = groupName ?? '';
  if (group.includes('企业版')) return 'enterprise';
  if (group.includes('工作流')) return 'workflow';
  if (group.includes('经济版')) return 'economy';
  if (group.includes('学习版')) return 'study';
  return 'other';
}

function groupRank(groupName?: string): number {
  switch (groupKind(groupName)) {
    case 'enterprise': return 0;
    case 'workflow': return 1;
    case 'economy': return 2;
    case 'study': return 3;
    default: return 9;
  }
}

function groupFamily(groupName?: string): string {
  const group = (groupName ?? 'default').trim();
  return group.split(/\s+/)[0] || 'default';
}

function cleanSourceModelKey(modelName?: string): string {
  return modelName ? slugify(cleanModelId(modelName)) : 'unknown-model';
}

function fullSourceModelKey(modelName?: string): string {
  return modelName ? slugify(modelName) : 'unknown-model';
}

function variantKey(groupName?: string, modelName?: string): string {
  const source = `-${fullSourceModelKey(modelName)}`;
  return `${groupFamily(groupName).toLowerCase()}-${groupKind(groupName)}${source}`;
}

function pickHeadline(candidates: CandidatePrice[]): CandidatePrice {
  return [...candidates].sort((a, b) => {
    const rankDelta = groupRank(a.row.group_name) - groupRank(b.row.group_name);
    if (rankDelta !== 0) return rankDelta;

    // Same quality class: cheaper row first, then stable lexical ordering.
    const priceDelta = (a.input + a.output) - (b.input + b.output);
    if (Math.abs(priceDelta) > 1e-9) return priceDelta;
    return (a.row.group_name ?? '').localeCompare(b.row.group_name ?? '');
  })[0];
}

function money(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}

function dedupeCandidates(candidates: CandidatePrice[]): CandidatePrice[] {
  const seen = new Set<string>();
  const unique: CandidatePrice[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.row.group_name ?? ''}:${candidate.input}:${candidate.output}:${candidate.cachedInput ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function buildNotes(
  headline: CandidatePrice,
  alternatives: CandidatePrice[],
  updatedAt?: string,
  schemaVersion?: string
): string {
  const parts = [
    `XycAi ${headline.row.group_name ?? 'default'} tier selected as the stable/self-service headline price`,
  ];

  const otherTiers = dedupeCandidates(alternatives)
    .filter(candidate => candidate !== headline)
    .sort((a, b) => groupRank(a.row.group_name) - groupRank(b.row.group_name) || (a.input + a.output) - (b.input + b.output));

  if (otherTiers.length > 0) {
    parts.push(
      `other public tiers: ${otherTiers
        .map(candidate => `${candidate.row.group_name ?? 'default'} ¥${money(candidate.input)}/¥${money(candidate.output)} per 1M`)
        .join(', ')}`
    );
  }

  if (headline.cachedInput != null) {
    parts.push(`cache read ¥${money(headline.cachedInput)} per 1M`);
  }
  if (updatedAt) parts.push(`source updated_at ${updatedAt}`);
  if (schemaVersion) parts.push(`schema ${schemaVersion}`);
  parts.push(XYCAI_PRICING_PAGE, XYCAI_DOCS);
  return parts.join('; ');
}

function isTextLlmModelName(modelName: string): boolean {
  const name = modelName.toLowerCase();
  return !/(^|[-/])(audio|realtime|image|embedding|tts|asr|transcribe|search)(?=-|$)/.test(name)
    && !name.includes('google-search');
}

function toCandidate(row: XycAiRow): CandidatePrice | null {
  if (row.enabled !== true) return null;
  if (typeof row.model_name !== 'string' || row.model_name.trim().length === 0) return null;
  if (!isTextLlmModelName(row.model_name)) return null;
  if (typeof row.input_price !== 'number' || typeof row.output_price !== 'number') return null;
  if (!Number.isFinite(row.input_price) || !Number.isFinite(row.output_price)) return null;
  if (!validatePrice(row.input_price) || !validatePrice(row.output_price)) return null;
  if (row.output_price < row.input_price) return null;

  return {
    row,
    slug: canonicalSlug(row.model_name),
    input: row.input_price,
    output: row.output_price,
    cachedInput: typeof row.cache_input_price === 'number' && Number.isFinite(row.cache_input_price)
      ? row.cache_input_price
      : null,
  };
}

export async function scrapeXycAiDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const skipped: string[] = [];

  try {
    console.log('🔄 Fetching XycAi pricing...');

    const response = await fetch(XYCAI_PRICING_API, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'aiplans.dev pricing scraper (+https://aiplans.dev)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = await response.json() as XycAiPayload;
    if (payload.success !== true || !Array.isArray(payload.data?.models)) {
      throw new Error('pricing endpoint returned success=false or no data.models array');
    }
    if (payload.data.currency !== 'CNY') {
      throw new Error(`unexpected currency ${payload.data.currency ?? '(missing)'} — expected CNY`);
    }
    if (payload.data.price_unit !== 'per_1m_tokens') {
      throw new Error(`unexpected price_unit ${payload.data.price_unit ?? '(missing)'} — expected per_1m_tokens`);
    }

    const bySlug = new Map<string, CandidatePrice[]>();
    const directCanonicalSource = new Map<string, string>();
    for (const row of payload.data.models) {
      const candidate = toCandidate(row);
      if (!candidate) {
        skipped.push(`${row.model_name ?? '(missing model_name)'}: disabled, non-text-token, invalid, or output<input`);
        continue;
      }
      const sourceKey = cleanSourceModelKey(row.model_name);
      if (sourceKey === candidate.slug) {
        directCanonicalSource.set(candidate.slug, sourceKey);
      }
      const group = bySlug.get(candidate.slug) ?? [];
      group.push(candidate);
      bySlug.set(candidate.slug, group);
    }

    // If the upstream provides an exact canonical model row, keep only that
    // route for the canonical model. Otherwise dated/preview/audio-ish aliases
    // can collapse onto the base slug and create misleading variants.
    for (const [slug, sourceKey] of directCanonicalSource) {
      const candidates = bySlug.get(slug) ?? [];
      const direct = candidates.filter(candidate => cleanSourceModelKey(candidate.row.model_name) === sourceKey);
      if (direct.length > 0) bySlug.set(slug, direct);
    }

    const prices: ScrapedPrice[] = [];
    const variants: ScrapedPriceVariant[] = [];
    for (const [slug, candidates] of bySlug) {
      const headline = pickHeadline(candidates);
      const normalizedName = normalizeModelName(cleanModelId(headline.row.model_name!));
      prices.push({
        modelName: normalizedName,
        modelSlug: slug,
        inputPricePer1M: headline.input,
        outputPricePer1M: headline.output,
        cachedInputPricePer1M: headline.cachedInput ?? undefined,
        isAvailable: true,
        currency: 'CNY',
        notes: buildNotes(headline, candidates, payload.data.updated_at, payload.schema_version),
      });

      const uniqueCandidates = dedupeCandidates(candidates);
      for (const candidate of uniqueCandidates) {
        // A model/provider pair has exactly one active headline row in the
        // database.  Do not mark same-priced aliases in the same upstream
        // group as headlines: XycAi currently publishes rows such as a
        // stable model id and its preview alias together, and the partial
        // unique index would reject both rows in one batch.
        const isHeadline = candidate === headline;
        variants.push({
          modelName: normalizeModelName(cleanModelId(candidate.row.model_name!)),
          modelSlug: slug,
          variantKey: variantKey(candidate.row.group_name, candidate.row.model_name),
          variantName: candidate.row.group_name ?? 'default',
          variantKind: groupKind(candidate.row.group_name),
          sourceGroupKey: groupKind(candidate.row.group_name),
          sourceGroupName: candidate.row.group_name,
          sourceUpdatedAt: payload.data.updated_at,
          sourceUrl: XYCAI_PRICING_API,
          inputPricePer1M: candidate.input,
          outputPricePer1M: candidate.output,
          cachedInputPricePer1M: candidate.cachedInput ?? undefined,
          cacheCreatePricePer1M: typeof candidate.row.cache_create_price === 'number' ? candidate.row.cache_create_price : undefined,
          currency: 'CNY',
          priceUnit: 'per_1m_tokens',
          isAvailable: true,
          isPublic: true,
          isSelfService: true,
          isPartnerOnly: false,
          isHeadline,
          headlineRank: groupRank(candidate.row.group_name),
          headlineReason: isHeadline ? 'Stable/self-service tier preferred over the lowest-price tier for headline comparisons.' : undefined,
          raw: { ...candidate.row },
          notes: candidate.row.note,
        });
      }
    }

    if (prices.length < MIN_PRICES) {
      errors.push(`only ${prices.length} mapped token prices (minimum ${MIN_PRICES}) — endpoint shape or filters changed`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ XycAi scrape completed in ${duration}ms`);
    console.log(`   - Source rows: ${payload.data.models.length}`);
    console.log(`   - Unique token models priced: ${prices.length}`);
    console.log(`   - Rows skipped: ${skipped.length}`);
    console.log(`   - Errors: ${errors.length}`);
    if (skipped.length > 0) {
      console.log(`⏭  Skipped ${skipped.length} rows:`);
      for (const reason of skipped.slice(0, 20)) console.log(`    - ${reason}`);
      if (skipped.length > 20) console.log(`    ... ${skipped.length - 20} more`);
    }

    return {
      source: 'XycAi',
      success: errors.length === 0 && prices.length > 0,
      prices,
      variants,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ XycAi scrape failed:', error);
    return {
      source: 'XycAi',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

if (require.main === module) {
  scrapeXycAiDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify({
      source: result.source,
      success: result.success,
      errors: result.errors,
      count: result.prices.length,
      sample: result.prices.slice(0, 20),
    }, null, 2));
  });
}
