import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Intel 2026-10-20 midday: Mercury 3 on Vercel AI Gateway with 50% off launch pricing.
 * Verified 2026-10-20:
 *   - https://vercel.com/changelog/mercury-3-now-available-on-ai-gateway (50% off launch, no end date)
 *   - https://ai-gateway.vercel.sh/v1/models/inception/mercury-3/endpoints: input $0.10, output $0.35,
 *     cache read $0.01 per 1M (per-token × 1e6), single endpoint served by Inception
 *   - https://docs.inceptionlabs.ai/get-started/models: regular $0.20 / $0.70 / cache $0.02
 * No end date is published, so promo_ends_at stays NULL and regular_* stay NULL: the display
 * only treats a row as a limited-time offer when promo_ends_at is set. Regular rates live in notes.
 */
export const MERCURY3_SLUG = 'inception-mercury-3';
export const MERCURY3_GATEWAY_ID = 'inception/mercury-3';
export const MERCURY3_CHANGELOG = 'https://vercel.com/changelog/mercury-3-now-available-on-ai-gateway';
export const MERCURY3_ENDPOINTS = 'https://ai-gateway.vercel.sh/v1/models/inception/mercury-3/endpoints';
export const MERCURY3_INCEPTION_PRICES = 'https://docs.inceptionlabs.ai/get-started/models';
export const MERCURY3_LAUNCH = { input: 0.1, output: 0.35, cache: 0.01 } as const;
export const MERCURY3_REGULAR = { input: 0.2, output: 0.7, cache: 0.02 } as const;
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'] as const;
const VERIFIED_AT = new Date('2026-10-20T00:00:00Z');

export const MERCURY3_NOTES = [
  `Gateway model id ${MERCURY3_GATEWAY_ID}; one endpoint, served by Inception. Gateway states no markup on provider pricing.`,
  `Launch price 50% off: input $${MERCURY3_LAUNCH.input} / output $${MERCURY3_LAUNCH.output} / cache read $${MERCURY3_LAUNCH.cache} per 1M (Gateway endpoints API, 2026-10-20).`,
  `Regular price $${MERCURY3_REGULAR.input} / $${MERCURY3_REGULAR.output} / $${MERCURY3_REGULAR.cache} per 1M (Inception docs). No end date published; promo_ends_at left empty.`,
  `Sources: ${MERCURY3_CHANGELOG} ; ${MERCURY3_ENDPOINTS} ; ${MERCURY3_INCEPTION_PRICES}`,
].join('\n');

export function vercelMercury3Options(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-vercel-mercury-3-2026-10-20.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Mercury3Step { table: 'api_channel_prices'; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Never creates models or providers: both must exist. */
export async function seedVercelMercury3(tx: Sql, apply = false): Promise<Mercury3Step[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE slug = ${MERCURY3_SLUG}`, `models/${MERCURY3_SLUG}`);
  if (!model) throw new Error(`Missing model ${MERCURY3_SLUG}; nothing written.`);
  const gateway = one(await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([...VERCEL_SLUGS])}`, 'providers/vercel');
  if (!gateway) throw new Error('Missing Vercel AI Gateway provider (run seed:vercel-deepseek-flash-1017 first); nothing written.');
  if (gateway.type != null && gateway.type !== 'aggregator') throw new Error('Expected Vercel aggregator provider; nothing written.');
  const existing = one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${gateway.id}`,
    `api_channel_prices/${MERCURY3_SLUG}/${String(gateway.slug)}`);
  const desired = {
    model_id: model.id, provider_id: gateway.id, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    input_price_per_1m: MERCURY3_LAUNCH.input, output_price_per_1m: MERCURY3_LAUNCH.output, cached_input_price_per_1m: MERCURY3_LAUNCH.cache,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    last_verified: VERIFIED_AT, notes: MERCURY3_NOTES,
  };
  const changes = seedChanges(existing, desired);
  if (!Object.keys(changes).length) return [];
  const step: Mercury3Step = { table: 'api_channel_prices', target: `${String(gateway.slug)}/${MERCURY3_SLUG}`, action: existing ? 'update' : 'insert', changes };
  if (apply) {
    const payload = { ...desired, updated_at: new Date() };
    if (existing) await tx`UPDATE ${tx('api_channel_prices')} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
    else await tx`INSERT INTO ${tx('api_channel_prices')} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
  }
  return [step];
}
