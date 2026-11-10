import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Optional manual catalog seed for Claude Fable 5.2 batch, the Fable latest
 * alias, Nex-N2.6, and the Inkling 2 Small OpenRouter :free route.
 * Never part of deploy or seed-catalog.sh. The CLI dry-run calls this with
 * apply=true inside runRehearsable, which rolls the transaction back.
 * :apply is a separate npm script. No deletes.
 *
 * Does not touch Cloudflare Workers AI shutdown dates, LFM3-1.7B, or Ampersand.
 * Does not rewrite the 11-06 Inkling 2 Small model or its Tinker channel.
 *
 * Verified 2026-11-10 against the live pages and APIs cited below.
 *
 * Claude Fable 5.2 batch:
 *   Release notes (2026-11-09) and the pricing page: standard input $8 / output
 *   $40 per 1M tokens. The batch table lists input $4 / output $20. OpenRouter
 *   id anthropic/claude-fable-5.2:batch publishes prompt 0.000004 / completion
 *   0.00002 / input_cache_read 0.0000001, which is $4 / $20 / $0.10 per 1M.
 *   *-batch rows in this catalog are OpenRouter products, so this seed writes
 *   the OpenRouter channel only. No Anthropic producer channel is inserted.
 *   Cache-write and web-search rates are published but have no channel column,
 *   so they are not stored. The base Fable 5.2 row is not created or repriced.
 *
 * ~anthropic/claude-fable-latest:
 *   OpenRouter says the id always redirects to the latest Claude Fable model.
 *   On 2026-11-10 its model-level price is prompt 0.000008 / completion 0.00004
 *   / input_cache_read 0.0000002, i.e. $8 / $40 / cache read $0.20 per 1M, the
 *   same standard rates as Fable 5.2. The routed model id was not returned by
 *   the endpoints payload (endpoints: []), so this seed does not record one.
 *   Either catalog slug ~anthropic-claude-fable-latest or ~claude-fable-latest
 *   is updated in place. A missing row is inserted under the OpenRouter slug.
 *
 * nex-agi/nex-n2.6:
 *   OpenRouter /api/v1/models (created 2026-11-10T03:46:19Z, canonical
 *   nex-agi/nex-n2.6-20261110, context_length 262144) at prompt 0.00000012 /
 *   completion 0.0000004 / input_cache_read 0.000000024, which is $0.12 / $0.40
 *   / $0.024 per 1M. The endpoint repeats those three rates (discount 0.2 is
 *   not applied again). 262000 is not stored. The 235929 completion cap is
 *   top_provider only and is not max_output_tokens. "about 321B" is the
 *   listing's wording; parameters stays NULL.
 *
 * thinkingmachines/inkling-2-small:free:
 *   Separate OpenRouter id, same pattern as the 11-07 free route: its own model
 *   row, not a second channel on the paid model. Price
 *   prompt "0" / completion "0", no cache field. context_length 1048576.
 *   The 11-06 paid row stays at context 262144; this seed does not update it.
 *   The 131072 completion cap is top_provider only and is not stored.
 *
 * A channel whose last_verified is later than 2026-11-10T00:00:00Z keeps its
 * prices and evidence (#347). Rows verified at or before that instant are updated.
 */
export const VERIFIED = '2026-11-10';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const ANTHROPIC_RELEASE = 'https://docs.anthropic.com/en/release-notes/api';
export const ANTHROPIC_PRICING = 'https://platform.claude.com/docs/en/about-claude/pricing';
export const FABLE_OVERVIEW = 'https://platform.claude.com/docs/en/models/fable-5-2/overview';
export const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

export const FABLE_BATCH_SLUG = 'anthropic-claude-fable-5-2-batch';
export const FABLE_BATCH_ID = 'anthropic/claude-fable-5.2:batch';
export const FABLE_BATCH_ALIASES = [
  FABLE_BATCH_SLUG, 'claude-fable-5.2-batch', 'claude-fable-5-2-batch', 'anthropic-claude-fable-5.2-batch', FABLE_BATCH_ID,
] as const;
export const FABLE_BATCH_PAGE = 'https://openrouter.ai/anthropic/claude-fable-5.2:batch';
export const FABLE_BATCH_CANONICAL = 'anthropic/claude-fable-5.2-20261109';
export const FABLE_RELEASED = '2026-11-09';
/** OpenRouter context_length and the docs' "1M". 1048576 was not published. */
export const FABLE_CONTEXT = 1_000_000;
/** Model overview max output and OpenRouter top_provider max_completion_tokens. */
export const FABLE_MAX_OUTPUT = 128_000;
export const FABLE_BATCH_PRICE = { input: 4, output: 20, cache: 0.1 } as const;
export const FABLE_STANDARD_PRICE = { input: 8, output: 40, cache: 0.2 } as const;

export const LATEST_CANONICAL = '~anthropic-claude-fable-latest';
export const LATEST_SHORT = '~claude-fable-latest';
export const LATEST_ID = '~anthropic/claude-fable-latest';
export const LATEST_ACCEPTED = [LATEST_CANONICAL, LATEST_SHORT] as const;
export const LATEST_ALIASES = [...LATEST_ACCEPTED, LATEST_ID] as const;
export const LATEST_PAGE = 'https://openrouter.ai/~anthropic/claude-fable-latest';

export const NEX_SLUG = 'nex-agi-nex-n2-6';
export const NEX_PROVIDER = 'nex-agi';
export const NEX_ID = 'nex-agi/nex-n2.6';
export const NEX_ALIASES = [NEX_SLUG, 'nex-n2.6', 'nex-n2-6', 'nex-agi-nex-n2.6', NEX_ID] as const;
export const NEX_PAGE = 'https://openrouter.ai/nex-agi/nex-n2.6';
export const NEX_ENDPOINTS = 'https://openrouter.ai/api/v1/models/nex-agi/nex-n2.6/endpoints';
export const NEX_HF = 'https://huggingface.co/nex-agi/Nex-N2.6';
export const NEX_RELEASED = '2026-11-10';
/** OpenRouter context_length. The listing label is 262K; 262000 is not stored. */
export const NEX_CONTEXT = 262_144;
export const NEX_PRICE = { input: 0.12, output: 0.4, cache: 0.024 } as const;

export const INKLING_FREE_SLUG = 'thinkingmachines-inkling-2-small-free';
export const INKLING_PROVIDER = 'thinkingmachines';
export const INKLING_PAID_SLUG = 'thinkingmachines-inkling-2-small';
export const INKLING_FREE_ID = 'thinkingmachines/inkling-2-small:free';
export const INKLING_FREE_ALIASES = [
  INKLING_FREE_SLUG, 'inkling-2-small-free', 'thinkingmachines-inkling-2-small:free', INKLING_FREE_ID,
] as const;
export const INKLING_FREE_PAGE = 'https://openrouter.ai/thinkingmachines/inkling-2-small:free';
export const INKLING_FREE_ENDPOINTS = 'https://openrouter.ai/api/v1/models/thinkingmachines/inkling-2-small:free/endpoints';
export const INKLING_NEWS = 'https://thinkingmachines.ai/news/inkling-2-small/';
export const INKLING_FREE_RELEASED = '2026-11-09';
/** OpenRouter context_length for this :free id. The paid 11-06 row stays 262144. */
export const INKLING_FREE_CONTEXT = 1_048_576;

export const ANTHROPIC_PROVIDER = 'anthropic';
export const OPENROUTER_PROVIDER = 'openrouter';

/**
 * Production-shaped dry-run: anthropic, openrouter and thinkingmachines exist;
 * the latest alias and its OpenRouter channel exist at the Fable 5.1 rate;
 * nex-agi, the batch model, Nex-N2.6 and the Inkling :free model do not.
 * The paid Inkling row, when present, is not a write.
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 3, update: 0 },
  api_channel_prices: { insert: 3, update: 1 },
} as const;

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export const FABLE_BATCH_FACTS = evidence(
  `OpenRouter route ${FABLE_BATCH_ID} of Claude Fable 5.2 (canonical snapshot ${FABLE_BATCH_CANONICAL}, API model id claude-fable-5-2). Not a second set of weights. Released 2026-11-09. Docs and OpenRouter context_length are 1000000 ("1M"); 1048576 is not stored. Max output 128000 tokens (model overview synchronous Messages API limit; OpenRouter top_provider max_completion_tokens is the same 128000). Fable 5.2 is not in the docs' 300k batch-output list. OpenRouter input modalities are text, image and file; file is not a catalog modality, so input_modalities stores text and image only. Web search $0.01 per request and the cache-write rates are not channel columns and are not stored. Standard price is input $8 / output $40 / cache read $0.20 per 1M; this row is the batch route only. The base Fable 5.2 model is not written. Catalog 2026-11-10 Fable 5.2 batch.`,
  [ANTHROPIC_RELEASE, ANTHROPIC_PRICING, FABLE_OVERVIEW, FABLE_BATCH_PAGE, OPENROUTER_API],
);

export const FABLE_BATCH_NOTES = evidence(
  `OpenRouter ${FABLE_BATCH_ID}. /api/v1/models pricing per token: prompt 0.000004, completion 0.00002, input_cache_read 0.0000001, which is $4 / $20 / $0.10 per 1M tokens. Anthropic's batch table lists Claude Fable 5.2 batch input $4 / output $20 per 1M (50% off the $8 / $40 standard rates). The batch table has no cache column. The pricing page says cache multipliers stack with the batch discount; the stored cache read is the OpenRouter published $0.10, not a cell in that table. Cache-write prices on the same payload (5m 0.000005, 1h 0.000008 per token) and web_search 0.01 are not stored. No Anthropic producer channel: *-batch catalog rows are OpenRouter products. Currency USD. No promo.`,
  [OPENROUTER_API, FABLE_BATCH_PAGE, ANTHROPIC_PRICING, ANTHROPIC_RELEASE],
);

export const LATEST_NOTES = evidence(
  `OpenRouter ${LATEST_ID}. The listing says this id always redirects to the latest Claude Fable model. /api/v1/models pricing per token on ${VERIFIED}: prompt 0.000008, completion 0.00004, input_cache_read 0.0000002, which is $8 / $40 / $0.20 per 1M tokens. That is Claude Fable 5.2's standard price (release notes and the pricing table: input $8 / output $40; cache hits $0.20). Fable 5.1 remains $10 / $50, cache read $0.25. The endpoints payload returned no endpoint rows, so the concrete model id behind the alias was not stored. Cache-write and web-search rates are not stored. Currency USD. No promo.`,
  [OPENROUTER_API, LATEST_PAGE, ANTHROPIC_PRICING, ANTHROPIC_RELEASE, FABLE_OVERVIEW],
);

export const NEX_FACTS = evidence(
  `Nex AGI Nex-N2.6 (OpenRouter id ${NEX_ID}, canonical snapshot nex-agi/nex-n2.6-20261110, Hugging Face id published as nex-agi/Nex-N2.6). The listing says it is built on GLM-5.3-Flash with about 321B parameters. That count is approximate, so parameters is NULL. context_length 262144 (labeled 262K); 262000 is not stored. OpenRouter's 235929-token completion cap is top_provider only and is not max_output_tokens. Text and image in, text out. Reasoning, tool calling and structured outputs. The Hugging Face card was not fetched, so license, license_url and open_source are NULL. No supported-country list was published. Created 2026-11-10T03:46:19Z. Catalog 2026-11-10 Nex-N2.6.`,
  [NEX_PAGE, OPENROUTER_API, NEX_ENDPOINTS, NEX_HF],
);

export const NEX_NOTES = evidence(
  `OpenRouter ${NEX_ID}. /api/v1/models pricing per token: prompt 0.00000012, completion 0.0000004, input_cache_read 0.000000024, which is $0.12 / $0.40 / $0.024 per 1M tokens. The Nex AGI endpoint (tag nex-agi/fp8, status 0) repeats those three rates and also has discount 0.2. The discount field is not applied a second time; the stored rates are the published prompt and completion strings. No training-for-discount term was on the endpoints payload, so data_for_discount is not set. Currency USD. No promo.`,
  [OPENROUTER_API, NEX_PAGE, NEX_ENDPOINTS],
);

export const INKLING_FREE_FACTS = evidence(
  `OpenRouter route ${INKLING_FREE_ID} (canonical snapshot thinkingmachines/inkling-2-small-20261107, created 2026-11-09T22:04:07Z). The listing describes the same Inkling 2 Small checkpoint as the 11-06 catalog row ${INKLING_PAID_SLUG}: 594B total / 17B active, image and text input, closed weights. This seed does not update that paid row, its Tinker channel, or its train rates. OpenRouter context_length for this route is 1048576. The paid row's context_window remains 262144; 262144 and 256000 are not this route's published integers. The 131072 completion cap is top_provider only and is not max_output_tokens. No cache-read field was published. Price prompt "0" and completion "0". Catalog 2026-11-10 Inkling 2 Small free route.`,
  [INKLING_FREE_PAGE, INKLING_FREE_ENDPOINTS, OPENROUTER_API, INKLING_NEWS],
);

export const INKLING_FREE_NOTES = evidence(
  `OpenRouter ${INKLING_FREE_ID}. /api/v1/models pricing prompt "0" and completion "0". No input_cache_read field, so cached_input_price_per_1m is NULL. The Thinking Machines endpoint (tag thinkingmachines/nvfp4, status 0) repeats 0/0 and publishes no training-for-discount term, so data_for_discount is not set. This is not the Tinker prefill $0.30 / sample $1.00 channel on ${INKLING_PAID_SLUG}.`,
  [OPENROUTER_API, INKLING_FREE_PAGE, INKLING_FREE_ENDPOINTS],
);

export function catalog20261110FableNexInklingSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-10-fable-nex-inkling.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

export function seedStepCounts(steps: Step[]) {
  const tables = ['providers', 'models', 'api_channel_prices'] as const;
  return Object.fromEntries(tables.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

const PRICE_EVIDENCE_KEYS = [
  'last_verified', 'notes', 'currency', 'price_unit', 'is_available',
  'input_price_per_1m', 'output_price_per_1m', 'cached_input_price_per_1m',
  'promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m',
  'regular_cached_input_price_per_1m',
] as const;

export async function seedCatalog20261110FableNexInkling(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = [ANTHROPIC_PROVIDER, OPENROUTER_PROVIDER, INKLING_PROVIDER, NEX_PROVIDER];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const byProvider = (slug: string, required = false) => one(providers.filter(row => row.slug === slug), `providers/${slug}`, required);
  const anthropic = byProvider(ANTHROPIC_PROVIDER, true);
  const openrouter = byProvider(OPENROUTER_PROVIDER, true);
  const thinkingmachines = byProvider(INKLING_PROVIDER, true);
  const nex = byProvider(NEX_PROVIDER);
  if (anthropic && !['official', 'producer'].includes(String(anthropic.type))) fail(`providers/${ANTHROPIC_PROVIDER} has type ${String(anthropic.type)}`);
  if (openrouter && openrouter.type != null && openrouter.type !== 'aggregator') fail(`providers/${OPENROUTER_PROVIDER} has type ${String(openrouter.type)}`);
  if (thinkingmachines && !['official', 'producer'].includes(String(thinkingmachines.type))) fail(`providers/${INKLING_PROVIDER} has type ${String(thinkingmachines.type)}`);
  if (nex && !['official', 'producer'].includes(String(nex.type))) fail(`providers/${NEX_PROVIDER} has type ${String(nex.type)}`);

  const aliases = [...FABLE_BATCH_ALIASES, ...LATEST_ALIASES, ...NEX_ALIASES, ...INKLING_FREE_ALIASES];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(aliases)}`;
  const resolveModel = (slugAliases: readonly string[], accepted: readonly string[], label: string) => {
    const matches = models.filter(row => slugAliases.includes(String(row.slug)));
    if (matches.length > 1) fail(`Ambiguous ${label} (${matches.map(row => row.slug).join(', ')})`);
    const row = matches[0] ?? null;
    if (row && !accepted.includes(String(row.slug))) fail(`Non-canonical row for ${label} exists (${String(row.slug)})`);
    return row;
  };
  const batch = resolveModel(FABLE_BATCH_ALIASES, [FABLE_BATCH_SLUG], FABLE_BATCH_SLUG);
  const latest = resolveModel(LATEST_ALIASES, LATEST_ACCEPTED, LATEST_CANONICAL);
  const nexModel = resolveModel(NEX_ALIASES, [NEX_SLUG], NEX_SLUG);
  const free = resolveModel(INKLING_FREE_ALIASES, [INKLING_FREE_SLUG], INKLING_FREE_SLUG);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row => {
    // #347: a dated seed must not roll back a newer live scrape's prices or evidence.
    if (table === 'api_channel_prices' && existing?.last_verified &&
        new Date(String(existing.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      desired = { ...desired };
      for (const key of PRICE_EVIDENCE_KEYS) delete desired[key];
    }
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };

  const nexOwner = nex ?? save('providers', null, {
    slug: NEX_PROVIDER, name: 'Nex AGI', type: 'official', region: null, currency: 'USD',
    website: null, pricing_url: null, api_docs_url: null,
    access_from_china: null, supported_regions: null, regions_source_url: null, regions_verified_at: null,
    notes: evidence('Provider identity for Nex AGI, the maker of Nex-N2.6. No first-party website, pricing page or supported-country list was verified, so website, pricing_url, api_docs_url, supported_regions, regions_source_url, regions_verified_at, region and access_from_china are NULL. The verified price is the OpenRouter channel.', [NEX_PAGE, NEX_ENDPOINTS]),
  }, NEX_PROVIDER);

  const textImage = {
    input_type: ['text', 'image'], output_type: ['text'],
    input_modalities: ['text', 'image'], output_modalities: ['text'],
    pricing_unit: 'per_1m_tokens',
  };
  const batchRow = save('models', batch, {
    slug: FABLE_BATCH_SLUG, name: 'Claude Fable 5.2 (batch)', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((batch?.provider_ids as number[] | undefined) ?? []), anthropic!.id])],
    context_window: FABLE_CONTEXT, max_output_tokens: FABLE_MAX_OUTPUT,
    open_source: batch?.open_source ?? null, license: batch?.license ?? null, license_url: batch?.license_url ?? null,
    released_at: new Date(`${FABLE_RELEASED}T00:00:00Z`),
    ...textImage,
    ...modelCapabilities(batch, ['reasoning', 'tool-calling', 'structured-outputs', 'vision']),
    ...(nonEmpty(batch?.offical_link) ? {} : { offical_link: FABLE_BATCH_PAGE }),
    description: nonEmpty(batch?.description) ? appendEvidence(batch!.description, FABLE_BATCH_FACTS) : FABLE_BATCH_FACTS,
  }, FABLE_BATCH_SLUG);

  const nexRow = save('models', nexModel, {
    slug: NEX_SLUG, name: 'Nex-N2.6', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((nexModel?.provider_ids as number[] | undefined) ?? []), nexOwner.id])],
    parameters: nexModel?.parameters ?? null, context_window: NEX_CONTEXT,
    open_source: nexModel?.open_source ?? null, license: nexModel?.license ?? null, license_url: nexModel?.license_url ?? null,
    released_at: new Date(`${NEX_RELEASED}T00:00:00Z`),
    ...textImage,
    ...modelCapabilities(nexModel, ['reasoning', 'tool-calling', 'structured-outputs', 'vision']),
    ...(nonEmpty(nexModel?.offical_link) ? {} : { offical_link: NEX_PAGE }),
    description: nonEmpty(nexModel?.description) ? appendEvidence(nexModel!.description, NEX_FACTS) : NEX_FACTS,
  }, NEX_SLUG);

  const freeRow = save('models', free, {
    slug: INKLING_FREE_SLUG, name: 'Inkling 2 Small (free)', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((free?.provider_ids as number[] | undefined) ?? []), thinkingmachines!.id])],
    parameters: '594B', 'active parameters': '17B', context_window: INKLING_FREE_CONTEXT,
    open_source: false, license: null, license_url: null,
    released_at: new Date(`${INKLING_FREE_RELEASED}T00:00:00Z`),
    ...textImage,
    ...modelCapabilities(free, ['reasoning', 'tool-calling', 'vision']),
    ...(nonEmpty(free?.offical_link) ? {} : { offical_link: INKLING_FREE_PAGE }),
    description: nonEmpty(free?.description) ? appendEvidence(free!.description, INKLING_FREE_FACTS) : INKLING_FREE_FACTS,
  }, INKLING_FREE_SLUG);

  const latestRow = latest ?? save('models', null, {
    slug: LATEST_CANONICAL, name: 'Claude Fable Latest', type: 'llm', model_category: 'text',
    provider_ids: [anthropic!.id],
    context_window: FABLE_CONTEXT, max_output_tokens: FABLE_MAX_OUTPUT,
    open_source: null, license: null, license_url: null,
    input_type: ['text', 'image'], output_type: ['text'],
    input_modalities: ['text', 'image'], output_modalities: ['text'],
    ...modelCapabilities(null, ['reasoning', 'tool-calling', 'structured-outputs', 'vision']),
    pricing_unit: 'per_1m_tokens',
    offical_link: LATEST_PAGE,
    description: evidence(
      `OpenRouter alias ${LATEST_ID}. The listing says it always redirects to the latest Claude Fable model. On ${VERIFIED} the published token price matches Claude Fable 5.2 standard rates. The concrete routed model id was not in the endpoints payload and is not stored.`,
      [LATEST_PAGE, OPENROUTER_API, ANTHROPIC_PRICING],
    ),
  }, LATEST_CANONICAL);

  const channel = async (model: Row | null, providerId: number, target: string) => {
    const rows = model && providerId > 0
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${providerId}` : [];
    return one(rows, `api_channel_prices/${target}`);
  };
  const priceBase = {
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
  };

  const batchChannel = await channel(batch, openrouter!.id, `${OPENROUTER_PROVIDER}/${FABLE_BATCH_SLUG}`);
  save('api_channel_prices', batchChannel, retainLockedUnavailable({
    ...priceBase, model_id: batchRow.id, provider_id: openrouter!.id,
    input_price_per_1m: FABLE_BATCH_PRICE.input, output_price_per_1m: FABLE_BATCH_PRICE.output, cached_input_price_per_1m: FABLE_BATCH_PRICE.cache,
    notes: FABLE_BATCH_NOTES,
  }, batchChannel), `${OPENROUTER_PROVIDER}/${FABLE_BATCH_SLUG}`);

  const latestSlug = String(latestRow.slug ?? LATEST_CANONICAL);
  const latestChannel = await channel(latest, openrouter!.id, `${OPENROUTER_PROVIDER}/${latestSlug}`);
  save('api_channel_prices', latestChannel, retainLockedUnavailable({
    ...priceBase, model_id: latestRow.id, provider_id: openrouter!.id,
    input_price_per_1m: FABLE_STANDARD_PRICE.input, output_price_per_1m: FABLE_STANDARD_PRICE.output, cached_input_price_per_1m: FABLE_STANDARD_PRICE.cache,
    notes: LATEST_NOTES,
  }, latestChannel), `${OPENROUTER_PROVIDER}/${latestSlug}`);

  const nexChannel = await channel(nexModel, openrouter!.id, `${OPENROUTER_PROVIDER}/${NEX_SLUG}`);
  save('api_channel_prices', nexChannel, retainLockedUnavailable({
    ...priceBase, model_id: nexRow.id, provider_id: openrouter!.id,
    input_price_per_1m: NEX_PRICE.input, output_price_per_1m: NEX_PRICE.output, cached_input_price_per_1m: NEX_PRICE.cache,
    notes: NEX_NOTES,
  }, nexChannel), `${OPENROUTER_PROVIDER}/${NEX_SLUG}`);

  const freeChannel = await channel(free, openrouter!.id, `${OPENROUTER_PROVIDER}/${INKLING_FREE_SLUG}`);
  save('api_channel_prices', freeChannel, retainLockedUnavailable({
    ...priceBase, model_id: freeRow.id, provider_id: openrouter!.id,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: null,
    notes: INKLING_FREE_NOTES,
  }, freeChannel), `${OPENROUTER_PROVIDER}/${INKLING_FREE_SLUG}`);

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
