import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Optional manual catalog seed for Liquid LFM3-1.7B and Humans& Ampersand v0.1.
 * Never part of deploy or seed-catalog.sh. The CLI dry-run calls this with
 * apply=true inside runRehearsable, which rolls the transaction back.
 * :apply is a separate npm script. No deletes. Unpublished prices stay NULL.
 *
 * Verified 2026-11-07 against the live pages and APIs cited below.
 *
 * LFM3-1.7B:
 *   OpenRouter /api/v1/models lists liquid/lfm-3-1.7b (created 2026-11-06T23:57:57Z,
 *   canonical liquid/lfm-3-1.7b-20261106, context_length 262144) at
 *   prompt 0.00000008 / completion 0.0000002 / input_cache_read 0.00000002
 *   USD per token, which is $0.08 / $0.20 / $0.02 per 1M.
 *   liquid/lfm-3-1.7b:free is prompt "0" / completion "0" and publishes no cache field.
 *   Both OpenRouter pages say prompts and outputs may be retained and used to train
 *   Liquid models. The paid endpoints payload's only Liquid endpoint had status -2;
 *   the model-level /api/v1/models price is what this seed stores.
 *   Liquid pricing (https://www.liquid.ai/pricing) lists the same $0.08 / $0.02 / $0.20
 *   for LFM3-1.7B and says the price is the same wherever the model is called.
 *   That page does not mention training on prompts, so the official channel leaves
 *   data_for_discount NULL. The :free route is an OpenRouter id, not a second
 *   Liquid Console SKU, so it has no official channel.
 *   Hugging Face LiquidAI/LFM3-1.7B: 1.73B parameters, "256K tokens (input + output)",
 *   LFM Open License (lfm1.0), text-only. 262144 is OpenRouter's published integer;
 *   256000 is not stored. The 8192 completion cap is OpenRouter top_provider only
 *   and is not stored as max_output_tokens.
 *   Slugs are generateOpenRouterSlug('liquid/lfm-3-1.7b') and
 *   generateOpenRouterSlug('liquid/lfm-3-1.7b:free').
 *
 * Ampersand v0.1:
 *   Vercel changelog 2026-11-06: free on AI Gateway through November 13, 2026.
 *   Model id humansand/ampersand-v0.1. GET /v1/models/humansand/ampersand-v0.1
 *   (2026-11-07): pricing input "0", output "0", input_cache_read "0";
 *   context_window 1000000; max_tokens 32768; released 2026-11-06T00:00:00Z;
 *   text in / text out; zdr "none". The endpoints row has has_no_training false
 *   and has_zdr false. That is not a published training-for-discount term, so
 *   data_for_discount stays NULL. No post-promo price was published, so regular_*
 *   stay NULL. The changelog gives a calendar day and no clock. Non-China gateway
 *   promos use Pacific time; 2026-11-13 is PST (US DST ended 2026-11-01), so the
 *   exclusive cutoff is 2026-11-14T08:00:00Z (2026-11-14 00:00 Pacific). After that
 *   instant effectivePrice keeps the stored 0 because regular_* are NULL; the notes
 *   say 0 is not a verified post-window rate.
 */
export const VERIFIED = '2026-11-07';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const LFM_SLUG = 'liquid-lfm-3-1-7b';
export const LFM_FREE_SLUG = 'liquid-lfm-3-1-7b-free';
export const LFM_PROVIDER = 'liquid';
export const LFM_OPENROUTER_ID = 'liquid/lfm-3-1.7b';
export const LFM_FREE_ID = 'liquid/lfm-3-1.7b:free';
export const LFM_ALIASES = [LFM_SLUG, 'lfm-3-1.7b', 'lfm-3-1-7b', 'lfm3-1.7b', 'liquid-lfm-3-1.7b', LFM_OPENROUTER_ID];
export const LFM_FREE_ALIASES = [LFM_FREE_SLUG, 'lfm-3-1.7b-free', 'liquid-lfm-3-1.7b-free', LFM_FREE_ID];
export const LFM_OR_PAGE = 'https://openrouter.ai/liquid/lfm-3-1.7b';
export const LFM_FREE_PAGE = 'https://openrouter.ai/liquid/lfm-3-1.7b:free';
export const LFM_OR_API = 'https://openrouter.ai/api/v1/models';
export const LFM_PRICE_PAGE = 'https://www.liquid.ai/pricing';
export const LFM_HF = 'https://huggingface.co/LiquidAI/LFM3-1.7B';
export const LFM_LICENSE_URL = 'https://huggingface.co/LiquidAI/LFM3-1.7B/blob/main/LICENSE';
export const LFM_BLOG = 'https://www.liquid.ai/blog/lfm3';
export const LFM_RELEASED = '2026-11-06';
/** OpenRouter context_length. The model card says "256K" and does not publish 262144 versus 256000. */
export const LFM_CONTEXT = 262_144;
export const LFM_PAID = { input: 0.08, output: 0.2, cache: 0.02 } as const;

export const AMP_SLUG = 'humansand-ampersand-v0-1';
export const AMP_PROVIDER = 'humansand';
export const AMP_GATEWAY_ID = 'humansand/ampersand-v0.1';
export const AMP_ALIASES = [AMP_SLUG, 'ampersand-v0.1', 'ampersand-v0-1', AMP_GATEWAY_ID];
export const AMP_CHANGELOG = 'https://vercel.com/changelog/humans-and-ampersand-now-available-on-ai-gateway';
export const AMP_MODEL_API = 'https://ai-gateway.vercel.sh/v1/models/humansand/ampersand-v0.1';
export const AMP_ENDPOINTS = 'https://ai-gateway.vercel.sh/v1/models/humansand/ampersand-v0.1/endpoints';
export const AMP_RELEASED = '2026-11-06';
export const AMP_CONTEXT = 1_000_000;
export const AMP_MAX_OUTPUT = 32_768;
/**
 * Inclusive last day is 2026-11-13 Pacific. Exclusive instant is midnight at the
 * start of 2026-11-14 Pacific (PST, UTC-8). The changelog publishes no clock.
 */
export const AMP_PROMO_ENDS_AT = new Date('2026-11-14T08:00:00.000Z');

export const OPENROUTER_PROVIDER = 'openrouter';
export const VERCEL_SLUGS = ['vercel-ai-gateway', 'vercel'] as const;

/** Production-shaped dry-run: liquid, openrouter and one Vercel provider exist; humansand and the three models do not. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 3, update: 0 },
  api_channel_prices: { insert: 4, update: 0 },
} as const;

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export const LFM_TRAINING_NOTE = 'OpenRouter says prompts and outputs may be retained and used to train Liquid models.';

export const LFM_FACTS = evidence(
  `Liquid LFM3-1.7B (OpenRouter id ${LFM_OPENROUTER_ID}, canonical snapshot liquid/lfm-3-1.7b-20261106, Hugging Face LiquidAI/LFM3-1.7B). The model card lists 1.73B parameters, a text-only post-trained checkpoint, and a 256K-token context shared by input and output. OpenRouter publishes context_length 262144 and the page label 262K; 256000 is not stored. OpenRouter's 8192-token completion cap is top_provider only and is not max_output_tokens. License is the LFM Open License (card license_name lfm1.0). The family blog is dated 2026-10-27; the OpenRouter listing says released Nov 6, 2026 and created 2026-11-06T23:57:57Z. Agent, tool calling, and structured outputs; it reasons before answering. Catalog 2026-11-07 LFM3-1.7B.`,
  [LFM_HF, LFM_OR_PAGE, LFM_OR_API, LFM_BLOG, LFM_PRICE_PAGE],
);

export const LFM_FREE_FACTS = evidence(
  `OpenRouter route ${LFM_FREE_ID} of the same LiquidAI/LFM3-1.7B checkpoint (canonical snapshot liquid/lfm-3-1.7b-20261106). Not a second Liquid Console SKU and not a second set of weights. Price prompt "0" and completion "0". No cache-read field was published. context_length 262144. ${LFM_TRAINING_NOTE} Catalog 2026-11-07 LFM3-1.7B free route.`,
  [LFM_FREE_PAGE, LFM_OR_API, LFM_HF],
);

export const LFM_OFFICIAL_NOTES = evidence(
  `Liquid pricing page, LFM3-1.7B: input $0.08 / cached input $0.02 / output $0.20 per 1M tokens. The page says the price is the same wherever the model is called. Currency USD. No promo and no separate post-promo price, so promo_ends_at and regular_* are NULL. The page does not say prompts are used for training, so data_for_discount is NULL on this official channel. The OpenRouter :free route is a different id and is not this channel.`,
  [LFM_PRICE_PAGE],
);

export const LFM_OR_NOTES = evidence(
  `OpenRouter ${LFM_OPENROUTER_ID}. /api/v1/models pricing per token: prompt 0.00000008, completion 0.0000002, input_cache_read 0.00000002, which is $0.08 / $0.20 / $0.02 per 1M tokens. Same rates as the Liquid pricing page. ${LFM_TRAINING_NOTE} The endpoints payload listed one Liquid endpoint (tag liquid/fp8) at the same rates with status -2; that status is not treated as a shutdown. The model-level price is the channel price. ${LFM_FREE_ID} is a separate catalog row.`,
  [LFM_OR_API, LFM_OR_PAGE, LFM_PRICE_PAGE],
);

export const LFM_FREE_NOTES = evidence(
  `OpenRouter ${LFM_FREE_ID}. /api/v1/models pricing prompt "0" and completion "0". No input_cache_read field, so cached_input_price_per_1m is NULL. ${LFM_TRAINING_NOTE} The endpoints payload listed one Liquid endpoint at 0/0 with status 0 and no cache price.`,
  [LFM_OR_API, LFM_FREE_PAGE],
);

export const AMP_FACTS = evidence(
  `Humans& Ampersand v0.1, AI Gateway model id ${AMP_GATEWAY_ID}. Changelog 2026-11-06: available on AI Gateway for free through November 13, 2026. Gateway model record: text in and text out, context_window 1000000, max_tokens 32768, released 2026-11-06T00:00:00Z, pricing input/output/cache-read "0". Tags include reasoning and tool-use. Group-conversation behavior (speak or stay quiet) is described on the changelog. No Humans& list price after the free window was found, and no supported-country list was published. Catalog 2026-11-07 Ampersand v0.1.`,
  [AMP_CHANGELOG, AMP_MODEL_API, AMP_ENDPOINTS],
);

export const AMP_CHANNEL_NOTES = evidence(
  `Vercel AI Gateway ${AMP_GATEWAY_ID}. Current price input $0, output $0, cache read $0 per 1M tokens (Gateway model record input/output/input_cache_read "0"). Free through November 13, 2026. The changelog publishes that calendar day and no clock. promo_ends_at is 2026-11-14T08:00:00Z, the start of 2026-11-14 Pacific (PST, UTC-8; US DST ended 2026-11-01), so the inclusive last day in Pacific time is 2026-11-13. regular input/output/cache are NULL because no post-window price was published. After the cutoff the stored $0 remains the effective price until a post-window rate is verified; $0 is not that rate. Gateway zdr is "none" and the endpoint has_no_training and has_zdr are false. That does not state a training-for-discount term, so data_for_discount is NULL. The limited-time badge needs a regular input or output price, so this row is dated in promo_ends_at and in this note.`,
  [AMP_CHANGELOG, AMP_MODEL_API, AMP_ENDPOINTS],
);

export function catalog20261107NewModelsSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-07-new-models.ts [--dry-run | --apply]');
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

export async function seedCatalog20261107NewModels(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([LFM_PROVIDER, AMP_PROVIDER, OPENROUTER_PROVIDER, ...VERCEL_SLUGS])}`;
  const byProvider = (slug: string) => one(providers.filter(row => row.slug === slug), `providers/${slug}`);
  const liquid = byProvider(LFM_PROVIDER);
  const humansand = byProvider(AMP_PROVIDER);
  const openrouter = one(providers.filter(row => row.slug === OPENROUTER_PROVIDER), `providers/${OPENROUTER_PROVIDER}`, true);
  const vercelRows = providers.filter(row => (VERCEL_SLUGS as readonly string[]).includes(String(row.slug)));
  const vercel = one(vercelRows, 'providers/vercel', true);
  if (liquid && !['official', 'producer'].includes(String(liquid.type))) fail(`providers/${LFM_PROVIDER} has type ${String(liquid.type)}`);
  if (humansand && !['official', 'producer'].includes(String(humansand.type))) fail(`providers/${AMP_PROVIDER} has type ${String(humansand.type)}`);
  if (vercel && vercel.type != null && vercel.type !== 'aggregator') fail(`providers/${String(vercel.slug)} has type ${String(vercel.type)}`);

  const aliases = [...LFM_ALIASES, ...LFM_FREE_ALIASES, ...AMP_ALIASES];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(aliases)}`;
  const canonical = (slugAliases: readonly string[], slug: string) => {
    const matches = models.filter(row => slugAliases.includes(String(row.slug)));
    if (matches.some(row => row.slug !== slug)) fail(`Non-canonical row for ${slug} exists (${matches.map(row => row.slug).join(', ')})`);
    return one(matches, `models/${slug}`);
  };
  const paid = canonical(LFM_ALIASES, LFM_SLUG);
  const free = canonical(LFM_FREE_ALIASES, LFM_FREE_SLUG);
  const amp = canonical(AMP_ALIASES, AMP_SLUG);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row => {
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };

  const liquidOwner = liquid ?? save('providers', null, {
    slug: LFM_PROVIDER, name: 'Liquid AI', type: 'official', region: 'global', currency: 'USD',
    website: 'https://www.liquid.ai', pricing_url: LFM_PRICE_PAGE, api_docs_url: 'https://docs.liquid.ai',
    access_from_china: null, supported_regions: null, regions_source_url: null, regions_verified_at: null,
    notes: evidence('Provider identity for Liquid. No supported-country list was published on the pricing page, so supported_regions, regions_source_url, regions_verified_at and access_from_china are NULL.', [LFM_PRICE_PAGE, LFM_HF]),
  }, LFM_PROVIDER);
  const humansandOwner = humansand ?? save('providers', null, {
    slug: AMP_PROVIDER, name: 'Humans&', type: 'official', region: null, currency: 'USD',
    website: null, pricing_url: AMP_CHANGELOG, api_docs_url: null,
    access_from_china: null, supported_regions: null, regions_source_url: null, regions_verified_at: null,
    notes: evidence('Provider identity for Humans&, the maker of Ampersand. No first-party pricing page or supported-country list was verified, so website, api_docs_url, supported_regions, regions_source_url, regions_verified_at, region and access_from_china are NULL. The verified price is the Vercel AI Gateway channel.', [AMP_CHANGELOG, AMP_MODEL_API]),
  }, AMP_PROVIDER);

  const paidModel = save('models', paid, {
    slug: LFM_SLUG, name: 'LFM3-1.7B', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((paid?.provider_ids as number[] | undefined) ?? []), liquidOwner.id])],
    parameters: '1.73B', context_window: LFM_CONTEXT,
    open_source: true, license: 'LFM Open License (lfm1.0)', license_url: LFM_LICENSE_URL,
    released_at: new Date(`${LFM_RELEASED}T00:00:00Z`),
    input_type: ['text'], output_type: ['text'],
    input_modalities: ['text'], output_modalities: ['text'],
    ...modelCapabilities(paid, ['reasoning', 'tool-calling', 'structured-outputs']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(paid?.offical_link) ? {} : { offical_link: LFM_HF }),
    description: nonEmpty(paid?.description) ? appendEvidence(paid!.description, LFM_FACTS) : LFM_FACTS,
  }, LFM_SLUG);

  const freeModel = save('models', free, {
    slug: LFM_FREE_SLUG, name: 'LFM3-1.7B (free)', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((free?.provider_ids as number[] | undefined) ?? []), liquidOwner.id])],
    parameters: '1.73B', context_window: LFM_CONTEXT,
    open_source: true, license: 'LFM Open License (lfm1.0)', license_url: LFM_LICENSE_URL,
    released_at: new Date(`${LFM_RELEASED}T00:00:00Z`),
    input_type: ['text'], output_type: ['text'],
    input_modalities: ['text'], output_modalities: ['text'],
    ...modelCapabilities(free, ['reasoning', 'tool-calling', 'structured-outputs']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(free?.offical_link) ? {} : { offical_link: LFM_FREE_PAGE }),
    description: nonEmpty(free?.description) ? appendEvidence(free!.description, LFM_FREE_FACTS) : LFM_FREE_FACTS,
  }, LFM_FREE_SLUG);

  const ampModel = save('models', amp, {
    slug: AMP_SLUG, name: 'Ampersand v0.1', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((amp?.provider_ids as number[] | undefined) ?? []), humansandOwner.id])],
    context_window: AMP_CONTEXT, max_output_tokens: AMP_MAX_OUTPUT,
    open_source: null, license: null, license_url: null,
    released_at: new Date(`${AMP_RELEASED}T00:00:00Z`),
    input_type: ['text'], output_type: ['text'],
    input_modalities: ['text'], output_modalities: ['text'],
    ...modelCapabilities(amp, ['reasoning', 'tool-calling']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(amp?.offical_link) ? {} : { offical_link: AMP_CHANGELOG }),
    description: nonEmpty(amp?.description) ? appendEvidence(amp!.description, AMP_FACTS) : AMP_FACTS,
  }, AMP_SLUG);

  const channel = async (model: Row | null, providerId: number, target: string) => {
    const rows = model && providerId > 0
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${providerId}` : [];
    return one(rows, `api_channel_prices/${target}`);
  };
  const priceBase = {
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
  };

  const official = await channel(paid, liquidOwner.id, `${LFM_PROVIDER}/${LFM_SLUG}`);
  save('api_channel_prices', official, retainLockedUnavailable({
    ...priceBase, model_id: paidModel.id, provider_id: liquidOwner.id,
    input_price_per_1m: LFM_PAID.input, output_price_per_1m: LFM_PAID.output, cached_input_price_per_1m: LFM_PAID.cache,
    notes: LFM_OFFICIAL_NOTES,
  }, official), `${LFM_PROVIDER}/${LFM_SLUG}`);

  const orPaid = await channel(paid, openrouter!.id, `${OPENROUTER_PROVIDER}/${LFM_SLUG}`);
  save('api_channel_prices', orPaid, retainLockedUnavailable({
    ...priceBase, model_id: paidModel.id, provider_id: openrouter!.id,
    input_price_per_1m: LFM_PAID.input, output_price_per_1m: LFM_PAID.output, cached_input_price_per_1m: LFM_PAID.cache,
    data_for_discount: true, data_for_discount_note: LFM_TRAINING_NOTE,
    notes: LFM_OR_NOTES,
  }, orPaid), `${OPENROUTER_PROVIDER}/${LFM_SLUG}`);

  const orFree = await channel(free, openrouter!.id, `${OPENROUTER_PROVIDER}/${LFM_FREE_SLUG}`);
  save('api_channel_prices', orFree, retainLockedUnavailable({
    ...priceBase, model_id: freeModel.id, provider_id: openrouter!.id,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: null,
    data_for_discount: true, data_for_discount_note: LFM_TRAINING_NOTE,
    notes: LFM_FREE_NOTES,
  }, orFree), `${OPENROUTER_PROVIDER}/${LFM_FREE_SLUG}`);

  const gateway = await channel(amp, vercel!.id, `${String(vercel!.slug)}/${AMP_SLUG}`);
  save('api_channel_prices', gateway, retainLockedUnavailable({
    ...priceBase, model_id: ampModel.id, provider_id: vercel!.id,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: 0,
    promo_ends_at: AMP_PROMO_ENDS_AT,
    notes: AMP_CHANNEL_NOTES,
  }, gateway), `${String(vercel!.slug)}/${AMP_SLUG}`);

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
