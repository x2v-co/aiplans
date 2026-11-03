import type { Sql } from 'postgres';
import { KIMI_CHANNELS, KIMI_SOURCE, VERIFIED_AT } from './catalog-2026-11-02';
import { seedChanges, seedValuesEqual } from './gemini-4-argon';

/**
 * Planprice audit 2026-11-03 (critical variants.no_headline): the kimi-k3.1-pro @ moonshot-global
 * variant group only has the two cache-write tiers, so the v1 catalog is not published.
 *
 * Optional SRE seed, never part of deploy. It touches exactly one row: it upserts the
 * `standard` headline variant of that group at the official Kimi international list price
 * ($2 input / $10 output / $0.20 cache hit per 1M tokens, USD). Every other row, including the
 * channel price and the cache-write tiers, is only read for validation.
 *
 * Replaces the headline that #299 added to seed:catalog-2026-11-02, which can no longer be re-run
 * because the scheduled scraper has refreshed the OpenRouter rows it also writes.
 *
 * Default dry-run runs inside a READ ONLY serializable transaction against the database; --apply
 * writes in one serializable transaction. Repeatable: after apply the dry-run reports 0 changes.
 * Notes / last_verified / source_url / headline_reason are written on insert only, so a later
 * scraper refresh of those fields does not make the dry-run non-zero.
 */
export const KIMI_HEADLINE_TARGET = 'moonshot-global/kimi-k3.1-pro/standard';
const SPEC = KIMI_CHANNELS.find(spec => spec.id === 'kimi-k3.1-pro')!;
export const KIMI_HEADLINE_SLUGS: readonly string[] = SPEC.slugs;
export const KIMI_HEADLINE_PRICE = { input: SPEC.input, output: SPEC.output, cache: SPEC.cache } as const;

/** Fields compared on every run (and the only ones updated on an existing standard row). */
export function kimiHeadlineCore(providerId: number, modelId: number) {
  return {
    model_id: modelId, provider_id: providerId,
    variant_key: 'standard', variant_name: 'Standard', variant_kind: 'tier',
    input_price_per_1m: KIMI_HEADLINE_PRICE.input, output_price_per_1m: KIMI_HEADLINE_PRICE.output,
    cached_input_price_per_1m: KIMI_HEADLINE_PRICE.cache,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    is_public: true, is_self_service: true, is_partner_only: false,
    is_headline: true, headline_rank: 0,
  };
}

/** Full row written when the standard variant does not exist yet. */
export function kimiHeadlineInsert(providerId: number, modelId: number) {
  return {
    ...kimiHeadlineCore(providerId, modelId),
    source_url: KIMI_SOURCE,
    headline_reason: 'Official Kimi international list price (input/output/cache-hit).',
    constraints_json: { speed: 'standard' },
    last_verified: VERIFIED_AT,
    notes: `Official Kimi international API kimi-k3.1-pro standard price: input $${SPEC.input} / output $${SPEC.output} / cache hit $${SPEC.cache.toFixed(2)} per 1M tokens (cache-write tiers are separate non-headline variants). Source: ${KIMI_SOURCE} (verified 2026-11-02). Seeded 2026-11-03 to fix audit variants.no_headline.`,
  };
}

export function kimiHeadlineSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-03-kimi-headline.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Step { table: 'api_channel_price_variants'; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction (READ ONLY for dry-run). No deletes, no other tables written. */
export async function seedKimiHeadline20261103(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'moonshot-global'}`;
  if (providers.length !== 1) fail(`Expected one providers/moonshot-global, found ${providers.length}`);
  const provider = providers[0];
  if (!['official', 'producer'].includes(String(provider.type))) fail(`providers/moonshot-global has type ${String(provider.type)}`);
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...KIMI_HEADLINE_SLUGS])}`;
  if (models.length !== 1) fail(`Expected one kimi-k3.1-pro model among ${KIMI_HEADLINE_SLUGS.join(', ')}, found ${models.length}`);
  const model = models[0];
  const channels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
  if (channels.length !== 1) fail(`Expected one moonshot-global/kimi-k3.1-pro channel price, found ${channels.length}`);
  const channel = channels[0];
  // Audit requires the headline to equal the channel price; refuse to diverge from it.
  for (const [key, want] of [['input_price_per_1m', SPEC.input], ['output_price_per_1m', SPEC.output]] as const) {
    if (!seedValuesEqual(channel[key], want)) fail(`moonshot-global/kimi-k3.1-pro channel ${key} is ${String(channel[key])}, expected ${want}; review before seeding`);
  }
  if (channel.is_available === false) fail('moonshot-global/kimi-k3.1-pro channel price is unavailable; review before seeding');
  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
  const standard = variants.filter(v => v.variant_key === 'standard');
  if (standard.length > 1) fail(`Found ${standard.length} standard variants for moonshot-global/kimi-k3.1-pro`);
  const otherHeadlines = variants.filter(v => v.variant_key !== 'standard' && v.is_headline === true);
  if (otherHeadlines.length) fail(`Group already has headline ${otherHeadlines.map(v => v.variant_key).join(', ')}; adding standard would create variants.multiple_headline`);

  const existing = standard[0] ?? null;
  const values = existing ? kimiHeadlineCore(provider.id, model.id) : kimiHeadlineInsert(provider.id, model.id);
  const changes = seedChanges(existing, values);
  if (!Object.keys(changes).length) return [];
  const step: Step = { table: 'api_channel_price_variants', target: KIMI_HEADLINE_TARGET, action: existing ? 'update' : 'insert', changes };
  if (apply) {
    const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
    if (existing) await tx`UPDATE ${tx('api_channel_price_variants')} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
    else await tx`INSERT INTO ${tx('api_channel_price_variants')} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
  }
  return [step];
}
