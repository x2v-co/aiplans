import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import {
  CARBON_BLOG, CARBON_INTRO, CARBON_PROMO_ENDS_AT,
  CARBON_SLUG, CARBON_SOURCE, CARBON_STANDARD, CARBON_VERTEX, CARBON_VERCEL, carbonChannelRow, carbonModelRow,
} from './gemini-4-carbon';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Optional manual catalog seed for the 2026-11-11 Gemini 4 Carbon GA update and
 * ERNIE-5.5-Flash-Preview. Never part of deploy or seed-catalog.sh. The CLI
 * dry-run calls this with apply=true inside runRehearsable, which rolls back.
 * :apply is a separate npm script. No deletes.
 *
 * Does not seed ernie-light-dt-1.0-intl, Seedream 5.5, Val Town, Fable, Nex,
 * Inkling, or Strands Decider. Seedream 5.5 is not seeded: the 2026-11-09
 * ByteDance blog has no list price, and the Volcengine Ark price list fetched
 * 2026-11-11 still names only Seedream 5.0 / 4.x. Adding it would require a
 * model id or a price this catalog does not have.
 *
 * A channel or variant whose last_verified is later than 2026-11-11T00:00:00Z
 * keeps its prices and evidence. The Google Carbon row's 2026-10-29
 * availability lock is cleared by carbonChannelRow (the paid API is open).
 * Other locked-off channels stay unavailable.
 */
export const VERIFIED = '2026-11-11';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const CARBON_OR_ID = 'google/gemini-4-carbon';
export const CARBON_BATCH_SLUG = 'gemini-4-carbon-batch';
export const CARBON_BATCH_ID = 'google/gemini-4-carbon:batch';
export const CARBON_OR_PAGE = 'https://openrouter.ai/google/gemini-4-carbon';
export const CARBON_BATCH_PAGE = 'https://openrouter.ai/google/gemini-4-carbon:batch';
export const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';
export const CARBON_BATCH_INTRO = { input: 1, output: 5, cache: 0.05 } as const;
export const CARBON_BATCH_REGULAR = { input: 2, output: 10, cache: 0.1 } as const;
export const CARBON_ALIASES = [CARBON_SLUG, 'google-gemini-4-carbon', 'google-gemini-gemini-4-carbon', CARBON_OR_ID] as const;
export const CARBON_BATCH_ALIASES = [
  CARBON_BATCH_SLUG, 'google-gemini-4-carbon-batch', 'google-gemini-gemini-4-carbon-batch', CARBON_BATCH_ID,
] as const;

export const ERNIE_SLUG = 'baidu-ernie-5-5-flash-preview';
export const ERNIE_ID = 'baidu/ernie-5.5-flash-preview';
export const ERNIE_ALIASES = [
  ERNIE_SLUG, 'ernie-5.5-flash-preview', 'ernie-5-5-flash-preview', ERNIE_ID, 'baidu/ERNIE-5.5-Flash-Preview',
] as const;
export const ERNIE_CN_PAGE = 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya';
export const ERNIE_INTL_PAGE = 'https://intl.cloud.baidu.com/en/doc/qianfan/s/Jm8r1826a-intl-en';
export const ERNIE_OR_PAGE = 'https://openrouter.ai/baidu/ernie-5.5-flash-preview';
export const ERNIE_OR_ENDPOINTS = 'https://openrouter.ai/api/v1/models/baidu/ernie-5.5-flash-preview/endpoints';
/** OpenRouter context_length. Not 1000000 and not 1048576. Hugging Face returned 401. */
export const ERNIE_CONTEXT = 1_024_000;
export const ERNIE_INTL = { input: 0.28, output: 1.13, cache: 0.028 } as const;
/** Page unit is 元/千tokens. These are per 1M (page price × 1000). */
export const ERNIE_CN = {
  peak: {
    clock: '8:00-22:00',
    promo: { input: 1, output: 4, cache: 0.1 },
    list: { input: 2, output: 8, cache: 0.2 },
  },
  idle: {
    clock: '22:00-次日8:00',
    promo: { input: 0.5, output: 2, cache: 0.05 },
    list: { input: 1, output: 4, cache: 0.1 },
  },
} as const;

export const GOOGLE_PROVIDER = 'google';
export const VERTEX_PROVIDER = 'vertex-ai';
export const OPENROUTER_PROVIDER = 'openrouter';
export const BAIDU_PROVIDER = 'baidu';
export const BAIDU_GLOBAL_PROVIDER = 'baidu-global';
export const BAIDU_GLOBAL_ALIASES = [BAIDU_GLOBAL_PROVIDER, 'qianfan-intl', 'baidu-intl', 'qianfan-international'] as const;
export const VERCEL_SLUGS = ['vercel-ai-gateway', 'vercel'] as const;

/**
 * Production-shaped dry-run: google, vertex-ai, openrouter, one Vercel provider
 * and baidu exist; Carbon exists locked at the October reference row; Vertex
 * exists at $2/$10 with no cutoff; baidu-global, the batch row and ERNIE do not.
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 2, update: 1 },
  api_channel_prices: { insert: 6, update: 2 },
  api_channel_price_variants: { insert: 2, update: 0 },
} as const;

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export const VERTEX_NOTES = evidence(
  `Vertex AI global Standard for Gemini 4 Carbon. Model Garden lists "Gemini 4 Carbon* through November 30, 2026" at global input $2 / text output $10 / cached input $0.10 per 1M tokens, and "Gemini 4 Carbon (Starting December 1, 2026), Gemini 4 Carbon Cyber Permissive" at global $4 / $20 / cached input $0.20. promo_ends_at is ${CARBON_PROMO_ENDS_AT}, the Gemini 4 Argon Pacific-midnight convention; the page publishes those calendar dates and no clock. Non-global is 10% higher ($2.20 / $11 / $0.11, then $4.40 / $22 / $0.22) and is not this channel. Cyber Permissive shares the December 1 rates and is not a separate catalog model. The footnote says promotional pricing does not apply to Gemini 4 Carbon Cyber Permissive, and that the promotion is 50% credits back on net spend. This channel stores the printed global Standard token rates. Two further tables list global $3.60 / $18 / cache $0.18 and $1 / $5 / cache $0.05 through November 30, then $7.20 / $36 / $0.36 and $2 / $10 / $0.10. Their headings were not in the extracted text; the numbers match Gemini API Priority and Flex/Batch and are not separate channels. Text output is labeled response and reasoning. Vertex grounding (5,000 free queries/month across Gemini 3 and Gemini 4, then $14 / 1,000) is not a token price on this row.`,
  [CARBON_VERTEX, CARBON_SOURCE],
);

export const CARBON_OR_NOTES = evidence(
  `OpenRouter ${CARBON_OR_ID}. /api/v1/models pricing per token: prompt 0.000002, completion 0.00001, input_cache_read 0.0000001, which is $2 / $10 / $0.10 per 1M tokens, shown as 50% off list $4 / $20. The payload has no promo-end timestamp. promo_ends_at ${CARBON_PROMO_ENDS_AT} and regular $4 / $20 / $0.20 follow the official Standard intro through 2026-11-30 and the Argon Pacific-midnight convention, not an OpenRouter clock. Vertex, AI Studio, Flex and Priority provider rows are not flattened into this channel. input_cache_write 0.0000001875 per token and web_search 0.014 are not channel columns. context_length 1048576 is not written on the model. Canonical snapshot google/gemini-4-carbon-20261110, created 2026-11-10T16:07:51Z.`,
  [OPENROUTER_API, CARBON_OR_PAGE, CARBON_SOURCE],
);

export const CARBON_BATCH_NOTES = evidence(
  `OpenRouter ${CARBON_BATCH_ID}. /api/v1/models pricing per token: prompt 0.000001, completion 0.000005, input_cache_read 0.00000005, which is $1 / $5 / $0.05 per 1M tokens. Official Gemini API Batch (and Flex) move to $2 / $10 / $0.10 on 2026-12-01. promo_ends_at ${CARBON_PROMO_ENDS_AT} uses that official date and the Argon Pacific-midnight convention; the OpenRouter payload has no cutoff field. No Google producer channel: *-batch catalog rows are OpenRouter products. The official Batch/Flex/Priority rates stay on the ${CARBON_SLUG} Google channel note. Cache-write and web_search are not stored. context_length 1048576 is not written.`,
  [OPENROUTER_API, CARBON_BATCH_PAGE, CARBON_SOURCE],
);

export const CARBON_VERCEL_NOTES = evidence(
  `Vercel AI Gateway model id ${CARBON_OR_ID}. Changelog 2026-11-10: 50% off through November 30, 2026. AI Gateway reflects provider pricing with no markup and does not charge a platform fee on inference, including BYOK. The changelog does not print a dollar table or a cache rate, and it does not print a $1 / $5 price. This channel is the official Standard pass-through: input $2 / output $10 / cache $0.10 through 2026-11-30, then $4 / $20 / cache $0.20. promo_ends_at is ${CARBON_PROMO_ENDS_AT} (Argon Pacific-midnight convention; the changelog gives the calendar day and no clock). The changelog's "1M-token context window" is not an integer and is not stored.`,
  [CARBON_VERCEL, CARBON_SOURCE],
);

export const ERNIE_FACTS = evidence(
  `ERNIE-5.5-Flash-Preview (Qianfan version name; model family ERNIE-5.5-Flash; OpenRouter id ${ERNIE_ID}, canonical snapshot baidu/ernie-5.5-flash-preview-20261110, created 2026-11-10T17:58:53Z). OpenRouter context_length and the Baidu endpoint context_length are 1024000. 1000000 and 1048576 were not published and are not stored. OpenRouter top_provider max_completion_tokens 921600 is not max_output_tokens. Text in, text out. OpenRouter supported_parameters include reasoning, tools and structured outputs. The OpenRouter description is truncated at "280 billion total", so parameters and active parameters are NULL. huggingface.co/baidu/ERNIE-5.5-Flash-Preview returned 401, so license, license_url and open_source are NULL. Catalog 2026-11-11 ERNIE-5.5-Flash-Preview.`,
  [ERNIE_OR_PAGE, OPENROUTER_API, ERNIE_OR_ENDPOINTS, ERNIE_CN_PAGE, ERNIE_INTL_PAGE],
);

export const ERNIE_CN_NOTES = evidence(
  `Qianfan CN online inference for ERNIE-5.5-Flash-Preview. Page unit is 元/千tokens; stored per_1m_tokens = page price × 1000. Peak (table cell 高峰时段：8: 00-22:00) promo 活动价 input ¥1 / output ¥4 / cache ¥0.10, list 原价 ¥2 / ¥8 / cache ¥0.20. Idle (table cell 空闲时段：22:00-次日8:00) promo ¥0.5 / ¥2 / cache ¥0.05, list ¥1 / ¥4 / cache ¥0.10. Cache is 10% of the input price on each row. The headline channel and the peak variant store the peak promo. The idle variant stores the idle promo. List prices are in this note and in constraints_json list_* fields. The page does not publish an activity end date and does not label a timezone, so promo_ends_at and regular_* are NULL and no end date was inferred. The clock strings are the table's hours only. Batch inference column is "-"; no batch price is stored. Currency CNY.`,
  [ERNIE_CN_PAGE],
);

export const ERNIE_INTL_NOTES = evidence(
  `Qianfan International online inference for ERNIE-5.5-Flash / ERNIE-5.5-Flash-Preview: input $0.28 / cache hit $0.028 / output $1.13 per 1M tokens. No peak/idle split. The page does not mark these as a promotion, so promo_ends_at and regular_* are NULL. Currency USD. This is not the Qianfan CN CNY table.`,
  [ERNIE_INTL_PAGE],
);

export const ERNIE_OR_NOTES = evidence(
  `OpenRouter ${ERNIE_ID}. /api/v1/models pricing per token: prompt 0.00000028, completion 0.00000113, input_cache_read 0.000000028, which is $0.28 / $1.13 / $0.028 per 1M tokens. That matches the Qianfan International list. The Baidu endpoint (tag baidu, status 0) repeats those three rates and discount 0. No training-for-discount term was on the payload, so data_for_discount is NULL. context_length 1024000. Currency USD. No promo.`,
  [OPENROUTER_API, ERNIE_OR_PAGE, ERNIE_OR_ENDPOINTS, ERNIE_INTL_PAGE],
);

export const CARBON_BATCH_FACTS = evidence(
  `OpenRouter route ${CARBON_BATCH_ID} of Gemini 4 Carbon (canonical snapshot google/gemini-4-carbon-20261110). Not a second set of weights. Official Batch and Flex rates are also noted on the ${CARBON_SLUG} Google channel; this row is the OpenRouter batch id only. context_length 1048576 is not stored. Catalog 2026-11-11 Gemini 4 Carbon batch.`,
  [CARBON_BATCH_PAGE, OPENROUTER_API, CARBON_SOURCE, CARBON_BLOG],
);

export function catalog20261111CarbonErnieSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-11-carbon-ernie.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'api_channel_price_variants';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

export function seedStepCounts(steps: Step[]) {
  const tables = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const;
  return Object.fromEntries(tables.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

const PRICE_EVIDENCE_KEYS = [
  'last_verified', 'notes', 'currency', 'price_unit', 'is_available', 'availability_locked',
  'input_price_per_1m', 'output_price_per_1m', 'cached_input_price_per_1m',
  'promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m',
  'regular_cached_input_price_per_1m',
] as const;

export async function seedCatalog20261111CarbonErnie(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = [GOOGLE_PROVIDER, VERTEX_PROVIDER, OPENROUTER_PROVIDER, BAIDU_PROVIDER, ...BAIDU_GLOBAL_ALIASES, ...VERCEL_SLUGS];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const byProvider = (slug: string, required = false) => one(providers.filter(row => row.slug === slug), `providers/${slug}`, required);
  const google = byProvider(GOOGLE_PROVIDER, true);
  const vertex = byProvider(VERTEX_PROVIDER, true);
  const openrouter = byProvider(OPENROUTER_PROVIDER, true);
  const baidu = byProvider(BAIDU_PROVIDER, true);
  const globalRows = providers.filter(row => (BAIDU_GLOBAL_ALIASES as readonly string[]).includes(String(row.slug)));
  if (globalRows.some(row => row.slug !== BAIDU_GLOBAL_PROVIDER)) fail(`Non-canonical Qianfan International provider (${globalRows.map(row => row.slug).join(', ')})`);
  const baiduGlobal = one(globalRows, `providers/${BAIDU_GLOBAL_PROVIDER}`);
  const vercelRows = providers.filter(row => (VERCEL_SLUGS as readonly string[]).includes(String(row.slug)));
  const vercel = one(vercelRows, 'providers/vercel', true);
  if (!google || !['official', 'producer'].includes(String(google.type))) fail(`providers/${GOOGLE_PROVIDER} has type ${String(google?.type)}`);
  if (!vertex || vertex.type !== 'cloud') fail(`providers/${VERTEX_PROVIDER} has type ${String(vertex?.type)}`);
  if (!openrouter || (openrouter.type != null && openrouter.type !== 'aggregator')) fail(`providers/${OPENROUTER_PROVIDER} has type ${String(openrouter?.type)}`);
  if (!baidu || !['official', 'producer'].includes(String(baidu.type))) fail(`providers/${BAIDU_PROVIDER} has type ${String(baidu?.type)}`);
  if (baiduGlobal && !['official', 'producer'].includes(String(baiduGlobal.type))) fail(`providers/${BAIDU_GLOBAL_PROVIDER} has type ${String(baiduGlobal.type)}`);
  if (!vercel || (vercel.type != null && vercel.type !== 'aggregator')) fail(`providers/${String(vercel?.slug)} has type ${String(vercel?.type)}`);

  const aliases = [...CARBON_ALIASES, ...CARBON_BATCH_ALIASES, ...ERNIE_ALIASES];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(aliases)}`;
  const resolveModel = (slugAliases: readonly string[], accepted: readonly string[], label: string) => {
    const matches = models.filter(row => slugAliases.includes(String(row.slug)));
    if (matches.length > 1) fail(`Ambiguous ${label} (${matches.map(row => row.slug).join(', ')})`);
    const row = matches[0] ?? null;
    if (row && !accepted.includes(String(row.slug))) fail(`Non-canonical row for ${label} exists (${String(row.slug)})`);
    return row;
  };
  const carbon = resolveModel(CARBON_ALIASES, [CARBON_SLUG], CARBON_SLUG);
  const batch = resolveModel(CARBON_BATCH_ALIASES, [CARBON_BATCH_SLUG], CARBON_BATCH_SLUG);
  const ernie = resolveModel(ERNIE_ALIASES, [ERNIE_SLUG], ERNIE_SLUG);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string, respectLock = true): Row => {
    if ((table === 'api_channel_prices' || table === 'api_channel_price_variants') && existing?.last_verified &&
        new Date(String(existing.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      desired = { ...desired };
      for (const key of PRICE_EVIDENCE_KEYS) delete desired[key];
    }
    if (table === 'api_channel_prices' && respectLock) desired = retainLockedUnavailable(desired as { is_available: boolean }, existing);
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };

  const globalOwner = baiduGlobal ?? save('providers', null, {
    slug: BAIDU_GLOBAL_PROVIDER, name: 'Baidu Qianfan International', type: 'official', region: 'global', currency: 'USD',
    website: 'https://intl.cloud.baidu.com', pricing_url: ERNIE_INTL_PAGE, api_docs_url: null,
    access_from_china: null, supported_regions: null, regions_source_url: null, regions_verified_at: null,
    notes: evidence('Provider identity for Qianfan International USD list prices. No supported-country list was on the price page, so supported_regions, regions_source_url, regions_verified_at and access_from_china are NULL.', [ERNIE_INTL_PAGE]),
  }, BAIDU_GLOBAL_PROVIDER);

  const carbonRow = save('models', carbon, carbonModelRow(google.id), CARBON_SLUG);
  const batchRow = save('models', batch, {
    slug: CARBON_BATCH_SLUG, name: 'Gemini 4 Carbon (batch)', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((batch?.provider_ids as number[] | undefined) ?? []), google.id])],
    context_window: null, max_output_tokens: null, parameters: null, 'active parameters': null,
    open_source: null, license: null, license_url: null,
    released_at: new Date('2026-11-10T00:00:00Z'),
    input_type: ['text', 'image', 'audio', 'video'], output_type: ['text'],
    input_modalities: ['text', 'image', 'audio', 'video'], output_modalities: ['text'],
    ...modelCapabilities(batch, ['reasoning']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(batch?.offical_link) ? {} : { offical_link: CARBON_BATCH_PAGE }),
    description: nonEmpty(batch?.description) ? appendEvidence(batch!.description, CARBON_BATCH_FACTS) : CARBON_BATCH_FACTS,
  }, CARBON_BATCH_SLUG);
  const ernieRow = save('models', ernie, {
    slug: ERNIE_SLUG, name: 'ERNIE-5.5-Flash-Preview', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((ernie?.provider_ids as number[] | undefined) ?? []), baidu.id])],
    parameters: null, 'active parameters': null, context_window: ERNIE_CONTEXT, max_output_tokens: null,
    open_source: null, license: null, license_url: null,
    released_at: new Date('2026-11-10T00:00:00Z'),
    input_type: ['text'], output_type: ['text'],
    input_modalities: ['text'], output_modalities: ['text'],
    ...modelCapabilities(ernie, ['reasoning', 'tool-calling', 'structured-outputs']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(ernie?.offical_link) ? {} : { offical_link: ERNIE_CN_PAGE }),
    description: nonEmpty(ernie?.description) ? appendEvidence(ernie!.description, ERNIE_FACTS) : ERNIE_FACTS,
  }, ERNIE_SLUG);

  const channel = async (model: Row | null, providerId: number, target: string) => {
    const rows = model && model.id > 0
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${providerId}` : [];
    return one(rows, `api_channel_prices/${target}`);
  };
  const schedule = (intro: { input: number; output: number; cache: number }, regular: { input: number; output: number; cache: number }) => ({
    input_price_per_1m: intro.input, output_price_per_1m: intro.output, cached_input_price_per_1m: intro.cache,
    promo_ends_at: CARBON_PROMO_ENDS_AT,
    regular_input_price_per_1m: regular.input, regular_output_price_per_1m: regular.output, regular_cached_input_price_per_1m: regular.cache,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
  });

  const googleChannel = await channel(carbon, google.id, `google/${CARBON_SLUG}`);
  save('api_channel_prices', googleChannel, carbonChannelRow(google.id, carbonRow.id), `google/${CARBON_SLUG}`, false);

  const vertexChannel = await channel(carbon, vertex.id, `vertex-ai/${CARBON_SLUG}`);
  save('api_channel_prices', vertexChannel, retainLockedUnavailable({
    ...schedule(CARBON_INTRO, CARBON_STANDARD), model_id: carbonRow.id, provider_id: vertex.id, notes: VERTEX_NOTES,
  }, vertexChannel), `vertex-ai/${CARBON_SLUG}`);

  const orCarbon = await channel(carbon, openrouter.id, `openrouter/${CARBON_SLUG}`);
  save('api_channel_prices', orCarbon, retainLockedUnavailable({
    ...schedule(CARBON_INTRO, CARBON_STANDARD), model_id: carbonRow.id, provider_id: openrouter.id, notes: CARBON_OR_NOTES,
  }, orCarbon), `openrouter/${CARBON_SLUG}`);

  const gateway = await channel(carbon, vercel.id, `${String(vercel.slug)}/${CARBON_SLUG}`);
  save('api_channel_prices', gateway, retainLockedUnavailable({
    ...schedule(CARBON_INTRO, CARBON_STANDARD), model_id: carbonRow.id, provider_id: vercel.id, notes: CARBON_VERCEL_NOTES,
  }, gateway), `${String(vercel.slug)}/${CARBON_SLUG}`);

  const orBatch = await channel(batch, openrouter.id, `openrouter/${CARBON_BATCH_SLUG}`);
  save('api_channel_prices', orBatch, retainLockedUnavailable({
    ...schedule(CARBON_BATCH_INTRO, CARBON_BATCH_REGULAR),
    model_id: batchRow.id, provider_id: openrouter.id, notes: CARBON_BATCH_NOTES,
  }, orBatch), `openrouter/${CARBON_BATCH_SLUG}`);

  const cnChannel = await channel(ernie, baidu.id, `baidu/${ERNIE_SLUG}`);
  save('api_channel_prices', cnChannel, retainLockedUnavailable({
    model_id: ernieRow.id, provider_id: baidu.id,
    input_price_per_1m: ERNIE_CN.peak.promo.input, output_price_per_1m: ERNIE_CN.peak.promo.output,
    cached_input_price_per_1m: ERNIE_CN.peak.promo.cache,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT, notes: ERNIE_CN_NOTES,
  }, cnChannel), `baidu/${ERNIE_SLUG}`);

  const intlChannel = await channel(ernie, globalOwner.id, `${BAIDU_GLOBAL_PROVIDER}/${ERNIE_SLUG}`);
  save('api_channel_prices', intlChannel, retainLockedUnavailable({
    model_id: ernieRow.id, provider_id: globalOwner.id,
    input_price_per_1m: ERNIE_INTL.input, output_price_per_1m: ERNIE_INTL.output, cached_input_price_per_1m: ERNIE_INTL.cache,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT, notes: ERNIE_INTL_NOTES,
  }, intlChannel), `${BAIDU_GLOBAL_PROVIDER}/${ERNIE_SLUG}`);

  const orErnie = await channel(ernie, openrouter.id, `openrouter/${ERNIE_SLUG}`);
  save('api_channel_prices', orErnie, retainLockedUnavailable({
    model_id: ernieRow.id, provider_id: openrouter.id,
    input_price_per_1m: ERNIE_INTL.input, output_price_per_1m: ERNIE_INTL.output, cached_input_price_per_1m: ERNIE_INTL.cache,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT, notes: ERNIE_OR_NOTES,
  }, orErnie), `openrouter/${ERNIE_SLUG}`);

  const variantRows = ernie && ernie.id > 0
    ? await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${ernie.id} AND provider_id = ${baidu.id}` : [];
  for (const row of variantRows.filter(row => row.is_headline === true && row.variant_key !== 'peak')) {
    save('api_channel_price_variants', row, { is_headline: false }, `baidu/${ERNIE_SLUG}/${String(row.variant_key)}`);
  }
  for (const window of [ERNIE_CN.peak, ERNIE_CN.idle] as const) {
    const key = window === ERNIE_CN.peak ? 'peak' : 'idle';
    const existing = one(variantRows.filter(row => row.variant_key === key), `variants/baidu/${ERNIE_SLUG}/${key}`);
    save('api_channel_price_variants', existing, {
      model_id: ernieRow.id, provider_id: baidu.id,
      variant_key: key, variant_name: key === 'peak' ? 'Peak' : 'Idle', variant_kind: 'time_window',
      input_price_per_1m: window.promo.input, output_price_per_1m: window.promo.output, cached_input_price_per_1m: window.promo.cache,
      currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true, is_public: true,
      is_headline: key === 'peak', source_url: ERNIE_CN_PAGE, last_verified: VERIFIED_AT,
      constraints_json: {
        time_window: key, clock: window.clock, timezone: null, promo_end_published: false,
        page_unit: '元/千tokens', batch_inference: null,
        list_input_price_per_1m: window.list.input, list_output_price_per_1m: window.list.output,
        list_cached_input_price_per_1m: window.list.cache,
      },
      notes: ERNIE_CN_NOTES,
    }, `baidu/${ERNIE_SLUG}/${key}`);
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id']) if (key in payload) payload[key] = resolveId(payload[key]);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolveId);
      if (operation.existing) await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(operation.id, inserted.id);
      }
    }
  }
  return steps;
}
