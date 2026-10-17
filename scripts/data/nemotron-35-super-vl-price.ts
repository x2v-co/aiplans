import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * OpenRouter cut Nemotron 3.5 Super VL to $0.10/$0.40, cache read $0.08 (verified 2026-10-17,
 * https://openrouter.ai/nvidia/nemotron-3.5-super-vl). The page still showed the old $0.15/$0.50
 * next to the new price. This makes every OpenRouter headline-level row agree with the new price.
 * Upstream endpoints keep their own posted prices (Together/CoreWeave still list $0.15/$0.50 on
 * OpenRouter); an upstream variant OpenRouter no longer lists is marked unavailable, never deleted.
 */
/** DB slugs use hyphens, not dots (models#3689; the :free row is models#3690). */
export const NEMOTRON_SLUG = 'nvidia-nemotron-3-5-super-vl';
export const NEMOTRON_FREE_SLUG = `${NEMOTRON_SLUG}-free`;
export const SOURCE = 'https://openrouter.ai/nvidia/nemotron-3.5-super-vl';
const VERIFIED = new Date('2026-10-17T00:00:00Z');
export const NEW_PRICE = { input_price_per_1m: 0.1, output_price_per_1m: 0.4, cached_input_price_per_1m: 0.08 };
/** OpenRouter endpoint table, 2026-10-17. Keys are lower-cased provider names. */
export const UPSTREAM: Record<string, { input_price_per_1m: number; output_price_per_1m: number; cached_input_price_per_1m: number }> = {
  crusoe: NEW_PRICE,
  deepinfra: NEW_PRICE,
  together: { input_price_per_1m: 0.15, output_price_per_1m: 0.5, cached_input_price_per_1m: 0.02 },
  coreweave: { input_price_per_1m: 0.15, output_price_per_1m: 0.5, cached_input_price_per_1m: 0.02 },
  venice: { input_price_per_1m: 0.25, output_price_per_1m: 1.25, cached_input_price_per_1m: 0.125 },
};
type Row = Record<string, unknown> & { id: number };
export interface Step { target: string; action: 'update' | 'review'; changes: Record<string, unknown> }

function upstreamKey(v: Row): string | null {
  const name = String(v.source_group_name ?? v.variant_name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return Object.keys(UPSTREAM).find(k => name.includes(k)) ?? null;
}

/** Idempotent. With apply=false only reports; the CLI dry-run additionally rehearses the writes and rolls back. */
export async function seedNemotronPrice(tx: Sql, apply: boolean): Promise<Step[]> {
  const [model] = await tx<Row[]>`SELECT id FROM models WHERE slug = ${NEMOTRON_SLUG}`;
  const [provider] = await tx<Row[]>`SELECT id FROM providers WHERE slug = 'openrouter'`;
  if (!model) throw new Error(`model ${NEMOTRON_SLUG} missing`);
  if (!provider) throw new Error('provider openrouter missing');
  const steps: Step[] = [];
  const stamp = { last_verified: VERIFIED };

  const channels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id} AND is_available IS DISTINCT FROM false ORDER BY id`;
  for (const c of channels) {
    const desired = { ...NEW_PRICE, currency: 'USD', price_unit: 'per_1m_tokens', ...stamp };
    const changes = seedChanges(c, desired);
    if (!Object.keys(changes).length) continue;
    steps.push({ target: `api_channel_prices#${c.id}`, action: 'update', changes });
    if (apply) await tx`UPDATE api_channel_prices SET ${tx({ ...desired, updated_at: new Date() } as Record<string, unknown>)} WHERE id = ${c.id}`;
  }

  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${provider.id} ORDER BY id`;
  for (const v of variants) {
    let desired: Record<string, unknown> | null = null;
    if (v.variant_key === 'openrouter-auto' || v.variant_key === 'openrouter-cheapest-endpoint') desired = { ...NEW_PRICE, ...stamp };
    else if (v.variant_kind === 'upstream_provider') {
      const key = upstreamKey(v);
      desired = key ? { ...UPSTREAM[key], is_available: true, ...stamp } : { is_available: false };
    }
    if (!desired) continue;
    const changes = seedChanges(v, desired);
    if (!Object.keys(changes).length) continue;
    steps.push({ target: `variant#${v.id}:${v.variant_key}`, action: 'update', changes });
    if (apply) await tx`UPDATE api_channel_price_variants SET ${tx({ ...desired, updated_at: new Date() } as Record<string, unknown>)} WHERE id = ${v.id}`;
  }

  // Read-only: duplicate model rows or other channels still at the old price need a human decision.
  const lookalikes = await tx<Row[]>`SELECT id, slug FROM models WHERE slug ILIKE ${'%nemotron-3%5-super-vl%'} AND id <> ${model.id}`;
  for (const m of lookalikes) steps.push({ target: `models#${m.id}:${m.slug}`, action: 'review', changes: { reason: m.slug === NEMOTRON_FREE_SLUG ? ':free route stays $0; not modified' : 'possible duplicate row; not modified' } });
  const others = await tx<Row[]>`SELECT id, provider_id, input_price_per_1m, output_price_per_1m FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id <> ${provider.id} AND is_available IS DISTINCT FROM false`;
  for (const o of others) steps.push({ target: `api_channel_prices#${o.id}`, action: 'review', changes: { provider_id: o.provider_id, input: o.input_price_per_1m, output: o.output_price_per_1m, reason: 'non-OpenRouter channel; not modified' } });
  return steps;
}
