import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Intel 2026-10-18 midday: DeepSeek V4.1 Flash 1017 on Vercel AI Gateway, plus
 * Gateway Session affinity as a channel-capability note. Prices verified from
 * https://ai-gateway.vercel.sh/v1/models (id deepseek/deepseek-v4.1-flash-1017)
 * on 2026-10-18; changelog announces availability but does not list $/1M rates.
 */
export const GATEWAY_CHANGELOG = 'https://vercel.com/changelog/deepseek-v4-1-flash-1017-now-available-on-ai-gateway';
export const SESSION_CHANGELOG = 'https://vercel.com/changelog/ai-gateway-logs-now-show-session-affinity';
export const GATEWAY_MODELS_API = 'https://ai-gateway.vercel.sh/v1/models';
export const GATEWAY_MODEL_ID = 'deepseek/deepseek-v4.1-flash-1017';
export const MODEL_SLUGS = ['deepseek-v4.1-flash', 'deepseek-v4-1-flash'] as const;
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'] as const;
const VERIFIED_AT = new Date('2026-10-18T00:00:00Z');

/** USD per 1M from Gateway API regional.us (per-token × 1e6). Cache differs slightly from DeepSeek official $0.006. */
export const GATEWAY_US_PEAK = { input: 0.3, output: 1.2, cache: 0.007 } as const;
export const GATEWAY_FAST = { input: 0.6, output: 2.4, cache: 0.014 } as const;

export const SESSION_AFFINITY_NOTE =
  'Channel capability: Session affinity (Logs → Sessions). Default routes later turns in a session to the prior provider to raise cache hits; group with sessionId / x-session-id. '
  + `Source: ${SESSION_CHANGELOG} (2026-10-17).`;

export const CHANNEL_NOTES = [
  `[needs-verification] Gateway model id ${GATEWAY_MODEL_ID}.`,
  'Rates from AI Gateway /v1/models regional.us fields (per-token × 1e6) on 2026-10-18: input $0.30 / output $1.20 / cache-read $0.007 per 1M.',
  'Gateway marks varies_by_provider=true and publishes peak_pricing.multiplier=2 with DeepSeek-style UTC peak windows; headline uses regional.us peak-equivalent rates.',
  'Cache-read $0.007/1M is Gateway-published (DeepSeek official peak cache-read is $0.006/1M). Changelog claims no markup / at provider pricing but does not list $/1M.',
  `Fast variant ${GATEWAY_MODEL_ID}-fast: $0.60 / $2.40 / $0.014 per 1M (Gateway API).`,
  `Sources: ${GATEWAY_MODELS_API} ; ${GATEWAY_CHANGELOG}`,
].join('\n');

export function vercelFlash1017Options(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-vercel-deepseek-flash-1017-2026-10-18.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'api_channel_prices' | 'api_channel_price_variants';
export interface VercelFlash1017Step {
  table: Table;
  target: string;
  action: 'insert' | 'update';
  changes: ReturnType<typeof seedChanges>;
}

function mergeNotes(existing: unknown, addition: string): string {
  const current = String(existing ?? '').trim();
  if (current.includes('Session affinity')) return current;
  return current ? `${current}\n${addition}` : addition;
}

/** Caller owns a serializable transaction. Default preview SELECT-only. Reuses Vercel provider; never creates models. */
export async function seedVercelDeepSeekFlash1017(tx: Sql, apply = false): Promise<VercelFlash1017Step[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted.`);
    return rows[0] ?? null;
  };
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...MODEL_SLUGS])}`, `models/${MODEL_SLUGS[0]}`);
  if (!model) throw new Error(`Missing catalog model ${MODEL_SLUGS[0]}; nothing written.`);
  const existingGateway = one(await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([...VERCEL_SLUGS])}`, 'providers/vercel');
  if (existingGateway?.type != null && existingGateway.type !== 'aggregator') {
    throw new Error('Expected Vercel aggregator provider; nothing written.');
  }

  const steps: VercelFlash1017Step[] = [];
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
    website: 'https://vercel.com', pricing_url: GATEWAY_CHANGELOG, currency: 'USD',
    region: null, access_from_china: null, notes: `${SESSION_AFFINITY_NOTE}\nSource: ${GATEWAY_CHANGELOG}`,
  }, 'vercel-ai-gateway');

  // Append session-affinity note to an existing Vercel provider without wiping prior notes.
  if (existingGateway) {
    await save('providers', existingGateway, {
      name: existingGateway.name ?? 'Vercel AI Gateway',
      slug: existingGateway.slug,
      type: 'aggregator',
      notes: mergeNotes(existingGateway.notes, SESSION_AFFINITY_NOTE),
    }, String(existingGateway.slug));
  }

  const existingChannel = one(
    await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${gateway.id}`,
    `api_channel_prices/${model.slug}/${gateway.slug}`,
  );
  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${gateway.id}`;
  for (const key of new Set(variants.map(row => row.variant_key))) {
    one(variants.filter(row => row.variant_key === key), `api_channel_price_variants/${key}`);
  }

  const common = {
    model_id: model.id, provider_id: gateway.id, currency: 'USD', price_unit: 'per_1m_tokens',
    is_available: true, last_verified: VERIFIED_AT,
  };
  await save('api_channel_prices', existingChannel, {
    ...common,
    input_price_per_1m: GATEWAY_US_PEAK.input,
    output_price_per_1m: GATEWAY_US_PEAK.output,
    cached_input_price_per_1m: GATEWAY_US_PEAK.cache,
    promo_ends_at: null,
    regular_input_price_per_1m: null,
    regular_output_price_per_1m: null,
    regular_cached_input_price_per_1m: null,
    notes: CHANNEL_NOTES,
  }, `${model.slug}/${gateway.slug}`);

  for (const row of variants.filter(row => row.is_headline === true && row.variant_key !== 'us-peak')) {
    await save('api_channel_price_variants', row, { is_headline: false }, String(row.variant_key));
  }
  await save('api_channel_price_variants', variants.find(row => row.variant_key === 'us-peak') ?? null, {
    ...common,
    variant_key: 'us-peak', variant_name: 'US regional (Gateway)', variant_kind: 'region',
    source_group_key: 'us', source_group_name: 'us', source_url: GATEWAY_MODELS_API,
    input_price_per_1m: GATEWAY_US_PEAK.input, output_price_per_1m: GATEWAY_US_PEAK.output,
    cached_input_price_per_1m: GATEWAY_US_PEAK.cache,
    is_public: true, is_self_service: true, is_partner_only: false, is_headline: true,
    headline_rank: 0, headline_reason: 'Gateway /v1/models regional.us rates for deepseek/deepseek-v4.1-flash-1017',
    constraints_json: { gateway_model_id: GATEWAY_MODEL_ID, region: 'us' },
    notes: CHANNEL_NOTES,
  }, `${model.slug}/us-peak`);
  await save('api_channel_price_variants', variants.find(row => row.variant_key === 'fast') ?? null, {
    ...common,
    variant_key: 'fast', variant_name: 'Fast', variant_kind: 'model_alias',
    source_group_key: 'fast', source_group_name: 'fast', source_url: GATEWAY_MODELS_API,
    input_price_per_1m: GATEWAY_FAST.input, output_price_per_1m: GATEWAY_FAST.output,
    cached_input_price_per_1m: GATEWAY_FAST.cache,
    is_public: true, is_self_service: true, is_partner_only: false, is_headline: false,
    headline_rank: 10, headline_reason: null,
    constraints_json: { gateway_model_id: `${GATEWAY_MODEL_ID}-fast` },
    notes: `Fast alias ${GATEWAY_MODEL_ID}-fast from Gateway /v1/models (verified 2026-10-18).\nSource: ${GATEWAY_MODELS_API}`,
  }, `${model.slug}/fast`);
  return steps;
}
