import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

export const BEAM_SOURCE = 'https://vercel.com/changelog/reflection-ai-beam-now-available-on-ai-gateway-for-free';
export const BEAM_ENDPOINTS = 'https://ai-gateway.vercel.sh/v1/models/reflection/beam/endpoints';
export const BEAM_MODEL_SLUGS = [
  // OpenRouter reflection/beam-1.0-501b-a23b normalizes to the first slug.
  'reflection-beam-1-0-501b-a23b', 'reflection-beam-1-0', 'reflection-beam', 'reflection/beam',
];
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'];
const VERIFIED_AT = new Date('2026-10-17T00:00:00Z');
const PROMO_NOTE = 'Limited-time free only when explicitly selecting provider reflection for reflection/beam. After the offer ends this model ID switches to paid pricing; no end date or future rates published. Other upstream providers are paid.';
const FREE_NOTE = 'reflection/beam-free is free for a limited time and stops serving when the offer ends; it does not switch to paid pricing. No end date published. Cache-read price unverified.';

// Verified USD per 1M input / output / cache-read tokens, 2026-10-17.
export const BEAM_UPSTREAM_RATES = [
  { provider: 'reflection', input: 0, output: 0, cache: 0 },
  { provider: 'nebius', input: 0.25, output: 1, cache: null },
  { provider: 'togetherai', input: 0.4, output: 1.2, cache: 0.04 },
  { provider: 'baseten', input: 1.3, output: 4.3, cache: 0.13 },
] as const;

export function beamSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-reflection-beam-2026-10-17.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'api_channel_prices' | 'api_channel_price_variants';
export interface BeamSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Default preview issues SELECT only.
 * Reuse the existing Beam catalog identity; upstreams and the free alias are
 * variants of the Vercel channel, never new producer channels or base models.
 */
export async function seedReflectionBeam(tx: Sql, apply = false): Promise<BeamSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(BEAM_MODEL_SLUGS)}`, 'models/reflection-beam');
  if (!model) throw new Error('Missing existing Reflection Beam catalog model; nothing written.');
  const existingGateway = one(await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(VERCEL_SLUGS)}`, 'providers/vercel');
  if (existingGateway?.type != null && existingGateway.type !== 'aggregator') {
    throw new Error('Expected Vercel aggregator provider; nothing written.');
  }
  const existingChannel = one(existingGateway
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${existingGateway.id}`
    : [], 'api_channel_prices/beam/vercel');
  const variants = existingGateway
    ? await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${existingGateway.id}`
    : [];
  // Preflight all variants before any writes, including ambiguous stale rows.
  for (const key of new Set(variants.map(row => row.variant_key))) {
    one(variants.filter(row => row.variant_key === key), `api_channel_price_variants/${key}`);
  }

  const steps: BeamSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, updated_at: new Date() };
    const write = Object.fromEntries(Object.entries(payload).map(([key, value]) =>
      [key, key === 'constraints_json' && value !== null ? tx.json(value as never) : value]));
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(write, ...Object.keys(write))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(write, ...Object.keys(write))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id };
  };

  const gateway = existingGateway ?? await save('providers', null, {
    name: 'Vercel AI Gateway', slug: 'vercel-ai-gateway', type: 'aggregator',
    website: 'https://vercel.com', pricing_url: BEAM_SOURCE, currency: 'USD',
    region: null, access_from_china: null, notes: `Source: ${BEAM_SOURCE}`,
  }, 'vercel-ai-gateway');
  const common = {
    model_id: model.id, provider_id: gateway.id, currency: 'USD', price_unit: 'per_1m_tokens',
    is_available: true, last_verified: VERIFIED_AT,
  };
  const sourceNote = `Verified 2026-10-17. Sources: ${BEAM_ENDPOINTS} ; ${BEAM_SOURCE}`;
  await save('api_channel_prices', existingChannel, {
    ...common, input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: 0,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null,
    regular_cached_input_price_per_1m: null,
    notes: `[free] ${PROMO_NOTE}\n${FREE_NOTE}\n${sourceNote}`,
  }, `${model.slug}/${gateway.slug}`);

  // As in OpenRouter, there is exactly one headline matching the channel row.
  // It is explicitly provider-selected, not an assertion about default routing.
  const ownedKeys = new Set<string>([...BEAM_UPSTREAM_RATES.map(rate => `upstream-${rate.provider}`), 'vercel-beam-free']);
  for (const row of variants.filter(row => row.is_headline === true && !ownedKeys.has(String(row.variant_key)))) {
    await save('api_channel_price_variants', row, { is_headline: false }, String(row.variant_key));
  }
  for (const rate of BEAM_UPSTREAM_RATES) {
    const key = `upstream-${rate.provider}`;
    const free = rate.provider === 'reflection';
    await save('api_channel_price_variants', variants.find(row => row.variant_key === key) ?? null, {
      ...common, variant_key: key, variant_name: `${rate.provider} | reflection/beam`, variant_kind: 'upstream_provider',
      source_group_key: rate.provider, source_group_name: rate.provider, source_url: BEAM_ENDPOINTS,
      input_price_per_1m: rate.input, output_price_per_1m: rate.output, cached_input_price_per_1m: rate.cache,
      is_public: true, is_self_service: true, is_partner_only: false, is_headline: free, headline_rank: free ? 0 : 10,
      headline_reason: free ? 'Limited-time free with explicit provider reflection; paid upstream alternatives in variants.' : null,
      constraints_json: { gateway_model_id: 'reflection/beam', upstream_provider: rate.provider,
        ...(free ? { limited_time_free: true, promo_ends_at: null, after_promo: 'paid' } : {}) },
      notes: `${free ? `[free] ${PROMO_NOTE}` : `Select upstream provider ${rate.provider} explicitly. ${rate.cache === null ? 'Cache-read price not published.' : ''}`}\n${sourceNote}`,
    }, `${model.slug}/${key}`);
  }
  const freeKey = 'vercel-beam-free';
  await save('api_channel_price_variants', variants.find(row => row.variant_key === freeKey) ?? null, {
    ...common, variant_key: freeKey, variant_name: 'reflection/beam-free (stops after free offer)', variant_kind: 'model_alias',
    source_group_key: 'reflection/beam-free', source_group_name: 'reflection/beam-free', source_url: BEAM_SOURCE,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: null,
    is_public: true, is_self_service: true, is_partner_only: false, is_headline: false, headline_rank: 5, headline_reason: null,
    constraints_json: { gateway_model_id: 'reflection/beam-free', limited_time_free: true, promo_ends_at: null, after_promo: 'unavailable' },
    notes: `[free] ${FREE_NOTE}\nSource: ${BEAM_SOURCE} (verified 2026-10-17).`,
  }, `${model.slug}/${freeKey}`);
  return steps;
}
