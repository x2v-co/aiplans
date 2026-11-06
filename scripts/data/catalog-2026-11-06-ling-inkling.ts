import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Optional manual catalog seed for Ling-3.2-flash and Inkling 2 Small.
 * Never part of deploy or seed-catalog.sh. The CLI dry-run calls this with
 * apply=true inside runRehearsable, which rolls the transaction back.
 * :apply is a separate npm script. No deletes. Unknown prices stay NULL.
 *
 * Verified 2026-11-06 against the live pages cited below.
 *
 * Ling-3.2-flash (Ant Ling / inclusionai):
 *   Changelog 2026-11-05: launched, 560B total / 25B activated, 1M context,
 *   image + text + video input, free for the first 2 weeks after launch.
 *   Pricing page: the model is not in the CNY or USD tables. No calendar
 *   cutoff and no post-promo list price, so promo_ends_at and regular_* are
 *   NULL (2026-11-19 is not inferred). Cache-read price is not published.
 *   Current input and output are 0. Currency is CNY because that page's
 *   first-party section says "All prices below are in CNY" and payment is
 *   personal Alipay; the free sentence itself has no currency symbol.
 *   context_window is 1000000. The pages say "1M" and do not choose between
 *   1000000 and 1048576; this matches the Gemini 4 Argon "1M" convention.
 *   Slug matches the live inclusionai-ling-3-1-flash row
 *   (generateOpenRouterSlug('inclusionai/ling-3.2-flash')).
 *   supported_regions lives on providers/plans (#327), not models. Neither
 *   vendor published a country list, so a newly inserted provider stores
 *   NULL / NULL source / NULL verified_at. An existing provider is not touched.
 *
 * Inkling 2 Small (Thinking Machines / Tinker):
 *   News 2026-11-05: 594B total / 17B active, image input, closed weights,
 *   Apache 2.0 intended "next week" after safety testing. No date, no weight
 *   URL, so open_source is false and license stays NULL.
 *   models.json + the pricing page: prices are USD per million tokens.
 *   Prefill $0.30, cached prefill $0.03, sample $1.00 on the 64K row, the
 *   256K row, and serverless inference. Train $1.50 (64K) / $3.00 (256K).
 *   256K is the tinker id suffix 262144, stored as context_window (max
 *   inference context). "64K" has no raw token integer, so 65536 is not stored.
 *   Slug matches thinkingmachines-inkling / thinkingmachines-inkling-small.
 *   Same supported_regions rule as Ling: no official country list, so NULL.
 */
export const VERIFIED = '2026-11-06';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const LING_SLUG = 'inclusionai-ling-3-2-flash';
export const LING_PROVIDER = 'inclusionai';
export const LING_ALIASES = [LING_SLUG, 'ling-3.2-flash', 'ling-3-2-flash', 'inclusionai-ling-3.2-flash', 'inclusionai/ling-3.2-flash'];
export const LING_MODEL_PAGE = 'https://developer.ant-ling.com/en/docs/models/ling';
export const LING_PRICE_PAGE = 'https://developer.ant-ling.com/en/docs/models/price/';
export const LING_CHANGELOG = 'https://developer.ant-ling.com/en/docs/getting-started/changelog';
export const LING_FAQ = 'https://developer.ant-ling.com/en/docs/faq/';
export const LING_API = 'https://developer.ant-ling.com/en/docs/api-reference/chat/openai/';
export const LING_RELEASED = '2026-11-05';
/** Official wording is "1M". 1048576 was not published. */
export const LING_CONTEXT = 1_000_000;

export const INKLING_SLUG = 'thinkingmachines-inkling-2-small';
export const INKLING_PROVIDER = 'thinkingmachines';
export const INKLING_ALIASES = [INKLING_SLUG, 'inkling-2-small', 'thinkingmachines/inkling-2-small'];
export const INKLING_NEWS = 'https://thinkingmachines.ai/news/inkling-2-small/';
export const INKLING_PRICE_PAGE = 'https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/';
export const INKLING_MODELS_JSON = 'https://tinker-docs.thinkingmachines.ai/tinker/models.json';
export const INKLING_SERVERLESS_JSON = 'https://tinker-docs.thinkingmachines.ai/tinker/serverless.json';
export const INKLING_RELEASED = '2026-11-05';
/** thinkingmachines/Inkling-2-Small:peft:262144 and the serverless id. */
export const INKLING_CONTEXT = 262_144;

export const LING_MODALITIES = ['text', 'image', 'video'] as const;
export const INKLING_MODALITIES = ['text', 'image'] as const;

/** Production-shaped dry-run: both providers already exist and neither model does. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 2, update: 0 },
  api_channel_prices: { insert: 2, update: 0 },
  usage_prices: { insert: 2, update: 0 },
} as const;

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export const LING_FACTS = evidence(
  'Ant Ling Ling-3.2-flash (API model id Ling-3.2-flash), launched 2026-11-05. MoE, 560B total parameters, 25B activated. Official context wording is "1M", shared between input and output; context_window stores 1000000. The pages do not publish 1000000 versus 1048576. Native image, text, and video input; the chat API returns text. The OpenAI-compatible API documents thinking mode and tool calls for the 3.2 series. This release\'s weights and licence are not stated. No supported-regions list was published. Personal Alipay is required to pay. The pricing page says the model is free for the first 2 weeks after launch and does not give a calendar end date or a post-promo list price, so promo_ends_at and regular prices are NULL. Cache-read price is not published. Currency is CNY because the first-party section of that page is priced in CNY; the free sentence itself has no currency symbol. The FAQ\'s separate daily quota of 500,000 tokens and the Ling Studio Open API QPS limit of 2 are platform terms, not this launch price. Catalog 2026-11-06 Ling-3.2-flash.',
  [LING_CHANGELOG, LING_MODEL_PAGE, LING_PRICE_PAGE, LING_FAQ, LING_API],
);

export const LING_CHANNEL_NOTES = evidence(
  'Ant Ling official pay-as-you-go. Ling-3.2-flash is free for the first 2 weeks after the 2026-11-05 launch: input 0, output 0. Currency CNY (the pricing page says first-party prices are in CNY; the free line has no currency symbol; payment is personal Alipay). promo_ends_at NULL: no calendar cutoff was published, so 2026-11-19 was not inferred. regular input/output/cache NULL: no post-promo list price was published. cached_input_price_per_1m NULL: no cache-read price was published. This is not the FAQ daily 500,000-token quota.',
  [LING_PRICE_PAGE, LING_CHANGELOG, LING_FAQ],
);

export const INKLING_FACTS = evidence(
  'Thinking Machines Inkling 2 Small, announced 2026-11-05. MoE, 594B total / 17B active, Hybrid + Vision, image and text input. Initially available on Tinker with closed weights. The announcement says the full weights are intended for Apache 2.0 next week after external safety testing and red-teaming; no calendar date and no weight URL were published, so open_source is false and license is NULL. Base context is published as 64K with no raw token integer (65536 is not stored). Extended and serverless context is 256K; the Tinker id suffix is 262144, stored as context_window. Prefill $0.30, cached prefill $0.03 and sample $1.00 per million tokens apply to both contexts and to serverless inference. Train is $1.50 per million tokens at 64K and $3.00 at 256K. No supported-regions list was published. Catalog 2026-11-06 Inkling 2 Small.',
  [INKLING_NEWS, INKLING_PRICE_PAGE, INKLING_MODELS_JSON, INKLING_SERVERLESS_JSON],
);

export const INKLING_CHANNEL_NOTES = evidence(
  'Tinker prices are USD per million tokens. Prefill (input) $0.30, cached prefill $0.03, sample (output) $1.00. The same three rates are on the 64K training row (thinkingmachines/Inkling-2-Small), the 256K row (thinkingmachines/Inkling-2-Small:peft:262144), and serverless inference (thinkingmachines/Inkling-2-Small:peft:262144:sampling-nvfp4, context 256K, beta). Train is not an input/output rate: $1.50 at the published 64K context and $3.00 at 256K; extended context costs more for training only. Checkpoint storage on the same page is $0.10 per GB per month and is not a token rate. No promo.',
  [INKLING_PRICE_PAGE, INKLING_MODELS_JSON, INKLING_SERVERLESS_JSON],
);

export const INKLING_TRAIN = [
  { priceKind: 'train 64K', price: 1.5, context: '64K', contextTokens: null, tinkerId: 'thinkingmachines/Inkling-2-Small' },
  { priceKind: 'train 256K', price: 3, context: '256K', contextTokens: INKLING_CONTEXT, tinkerId: 'thinkingmachines/Inkling-2-Small:peft:262144' },
] as const;

export function catalog20261106LingInklingSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-06-ling-inkling.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'usage_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

export function seedStepCounts(steps: Step[]) {
  const tables = ['providers', 'models', 'api_channel_prices', 'usage_prices'] as const;
  return Object.fromEntries(tables.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

function providerInsert(slug: typeof LING_PROVIDER | typeof INKLING_PROVIDER) {
  if (slug === LING_PROVIDER) {
    return {
      slug, name: 'inclusionai', type: 'official', region: null, access_from_china: null,
      supported_regions: null, regions_source_url: null, regions_verified_at: null,
      website: 'https://developer.ant-ling.com', pricing_url: LING_PRICE_PAGE,
      api_docs_url: 'https://developer.ant-ling.com/en/docs/api-reference/',
      notes: evidence('Provider identity for the Ant Ling API. No supported-country list was published, so supported_regions, regions_source_url, regions_verified_at, region and access_from_china are NULL. The FAQ says payment is personal Alipay. Other metadata unverified.', [LING_PRICE_PAGE, LING_FAQ]),
    };
  }
  return {
    slug, name: 'thinkingmachines', type: 'official', region: null, access_from_china: null,
    supported_regions: null, regions_source_url: null, regions_verified_at: null,
    website: 'https://thinkingmachines.ai', pricing_url: INKLING_PRICE_PAGE,
    api_docs_url: 'https://tinker-docs.thinkingmachines.ai/',
    notes: evidence('Provider identity for Thinking Machines / Tinker. No supported-country list was published, so supported_regions, regions_source_url, regions_verified_at, region and access_from_china are NULL. Other metadata unverified.', [INKLING_NEWS, INKLING_PRICE_PAGE]),
  };
}

export async function seedCatalog20261106LingInkling(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) fail(`Ambiguous ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  const providerSlugs = [LING_PROVIDER, INKLING_PROVIDER];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const owners = new Map(providerSlugs.map(slug => [slug, one(providers.filter(row => row.slug === slug), `providers/${slug}`)]));
  for (const [slug, owner] of owners) {
    if (owner && !['official', 'producer'].includes(String(owner.type))) fail(`providers/${slug} has type ${String(owner.type)}`);
  }
  const aliases = [...LING_ALIASES, ...INKLING_ALIASES];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(aliases)}`;
  const canonical = (slugAliases: readonly string[], slug: string) => {
    const matches = models.filter(row => slugAliases.includes(String(row.slug)));
    if (matches.some(row => row.slug !== slug)) fail(`Non-canonical row for ${slug} exists (${matches.map(row => row.slug).join(', ')}); review before seeding`);
    return one(matches, `models/${slug}`);
  };
  const ling = canonical(LING_ALIASES, LING_SLUG);
  const inkling = canonical(INKLING_ALIASES, INKLING_SLUG);

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

  for (const slug of providerSlugs) {
    if (!owners.get(slug)) owners.set(slug, save('providers', null, providerInsert(slug as typeof LING_PROVIDER), slug));
  }
  const lingOwner = owners.get(LING_PROVIDER)!;
  const inklingOwner = owners.get(INKLING_PROVIDER)!;

  const lingModel = save('models', ling, {
    slug: LING_SLUG, name: 'Ling-3.2-flash', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((ling?.provider_ids as number[] | undefined) ?? []), lingOwner.id])],
    parameters: '560B', 'active parameters': '25B', context_window: LING_CONTEXT,
    open_source: null, license: null, license_url: null,
    released_at: new Date(`${LING_RELEASED}T00:00:00Z`),
    input_type: [...LING_MODALITIES], output_type: ['text'],
    input_modalities: [...LING_MODALITIES], output_modalities: ['text'],
    ...modelCapabilities(ling, ['reasoning', 'tool-calling', 'vision']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(ling?.offical_link) ? {} : { offical_link: LING_MODEL_PAGE }),
    description: nonEmpty(ling?.description) ? appendEvidence(ling!.description, LING_FACTS) : LING_FACTS,
  }, LING_SLUG);

  const inklingModel = save('models', inkling, {
    slug: INKLING_SLUG, name: 'Inkling 2 Small', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((inkling?.provider_ids as number[] | undefined) ?? []), inklingOwner.id])],
    parameters: '594B', 'active parameters': '17B', context_window: INKLING_CONTEXT,
    open_source: false, license: null, license_url: null,
    released_at: new Date(`${INKLING_RELEASED}T00:00:00Z`),
    input_type: [...INKLING_MODALITIES], output_type: ['text'],
    input_modalities: [...INKLING_MODALITIES], output_modalities: ['text'],
    ...modelCapabilities(inkling, ['reasoning', 'vision']),
    pricing_unit: 'per_1m_tokens',
    ...(nonEmpty(inkling?.offical_link) ? {} : { offical_link: INKLING_NEWS }),
    description: nonEmpty(inkling?.description) ? appendEvidence(inkling!.description, INKLING_FACTS) : INKLING_FACTS,
  }, INKLING_SLUG);

  const lingChannels = ling && lingOwner.id > 0
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${ling.id} AND provider_id = ${lingOwner.id}` : [];
  save('api_channel_prices', one(lingChannels, `api_channel_prices/${LING_PROVIDER}/${LING_SLUG}`), retainLockedUnavailable({
    model_id: lingModel.id, provider_id: lingOwner.id,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: null,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: LING_CHANNEL_NOTES,
  }, one(lingChannels, `api_channel_prices/${LING_PROVIDER}/${LING_SLUG}`)), `${LING_PROVIDER}/${LING_SLUG}`);

  const inklingChannels = inkling && inklingOwner.id > 0
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${inkling.id} AND provider_id = ${inklingOwner.id}` : [];
  const inklingChannel = one(inklingChannels, `api_channel_prices/${INKLING_PROVIDER}/${INKLING_SLUG}`);
  save('api_channel_prices', inklingChannel, retainLockedUnavailable({
    model_id: inklingModel.id, provider_id: inklingOwner.id,
    input_price_per_1m: 0.3, output_price_per_1m: 1, cached_input_price_per_1m: 0.03,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: INKLING_CHANNEL_NOTES,
  }, inklingChannel), `${INKLING_PROVIDER}/${INKLING_SLUG}`);

  const usage = inkling && inklingOwner.id > 0
    ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${inkling.id} AND provider_id = ${inklingOwner.id}` : [];
  for (const rate of INKLING_TRAIN) {
    const existing = one(usage.filter(row => row.price_kind === rate.priceKind && row.unit === 'per_1m_tokens'), `usage_prices/${INKLING_SLUG}/${rate.priceKind}`);
    save('usage_prices', existing, retainLockedUnavailable({
      model_id: inklingModel.id, provider_id: inklingOwner.id, plan_id: existing?.plan_id ?? null,
      price_kind: rate.priceKind, unit: 'per_1m_tokens', price: rate.price, currency: 'USD',
      source_url: INKLING_MODELS_JSON, last_verified: VERIFIED_AT, is_available: true,
      constraints_json: { context: rate.context, context_tokens: rate.contextTokens, tinker_id: rate.tinkerId, unit: 'per_million_tokens' },
    }, existing), `${INKLING_SLUG}/${rate.priceKind}`);
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
