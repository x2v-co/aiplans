import type { Sql } from 'postgres';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { seedChanges } from './gemini-4-argon';
import { assertCacheWriteHeadlines } from '../utils/variant-headlines';

/**
 * DO NOT RE-RUN (2026-11-03). This seed was applied on 2026-11-02. Since then the scheduled
 * planprice scraper owns the openrouter/gpt-oss-120b channel row and its openrouter-auto
 * variant (fresher last_verified / notes / raw_json), so a re-run would roll those back to
 * this snapshot. The kimi-k3.1-pro @ moonshot-global standard headline that #299 briefly added
 * here was moved to its own narrow seed: `npm run seed:catalog-2026-11-03-kimi-headline`
 * (scripts/data/catalog-2026-11-03-kimi-headline.ts). Kept only as history and for tests.
 */
export const VERIFIED_AT = new Date('2026-11-02T00:00:00Z');
export const OPENROUTER_SOURCE = 'https://openrouter.ai/api/v1/models';
export const KIMI_SOURCE = 'https://platform.kimi.ai/docs/pricing/chat';
export const MINIMAX_SOURCE = 'https://platform.minimax.io/docs/guides/pricing';
export const HAILUO = catalogForKind('video-model').find(item => item.slug === 'hailuo-video')!;
export const WORLD_SLUG = 'tencent-hy-world-2-1';

/** Explicit identities from the audit snapshot. Aliases are alternatives, never
 * a reason to merge two existing model IDs. Ambiguity aborts before writes.
 */
export const KIMI_CHANNELS = [
  { id: 'kimi-k3.1-pro', slugs: ['moonshotai-kimi-k3-1-pro', 'kimi-k3.1-pro'], input: 2, output: 10, cache: 0.20 },
  { id: 'kimi-k3.1-pro-highspeed', slugs: ['kimi-k3.1-pro-highspeed', 'moonshotai-kimi-k3-1-pro-highspeed'], input: 4, output: 20, cache: 0.20 },
  { id: 'kimi-k3', slugs: ['kimi-k3', 'moonshotai-kimi-k3'], input: 3, output: 15, cache: 0.30 },
  { id: 'kimi-k2.7-code', slugs: ['kimi-k2.7-code', 'moonshotai-kimi-k2-7-code'], input: 0.95, output: 4, cache: 0.19 },
  { id: 'kimi-k2.7-code-highspeed', slugs: ['kimi-k2.7-code-highspeed', 'moonshotai-kimi-k2-7-code-highspeed'], input: 1.90, output: 8, cache: 0.38 },
  { id: 'kimi-k2.6', slugs: ['kimi-k2.6', 'moonshotai-kimi-k2-6'], input: 0.95, output: 4, cache: 0.16 },
] as const;

export function kimiChannel(spec: typeof KIMI_CHANNELS[number], providerId: number, modelId: number) {
  return {
    provider_id: providerId, model_id: modelId,
    input_price_per_1m: spec.input, output_price_per_1m: spec.output, cached_input_price_per_1m: spec.cache,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: `Official Kimi international API ${spec.id}: input/output/cache-hit USD per 1M tokens. ${spec.id === 'kimi-k3.1-pro' ? 'Cache write: 5m TTL $2/1M tokens; 1h TTL $4/1M tokens. ' : ''}Source: ${KIMI_SOURCE} (verified 2026-11-02).`,
  };
}

export function openRouterChannel(providerId: number, modelId: number) {
  return {
    provider_id: providerId, model_id: modelId, input_price_per_1m: 0.15, output_price_per_1m: 0.60,
    cached_input_price_per_1m: 0.075, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null,
    regular_cached_input_price_per_1m: null, last_verified: VERIFIED_AT,
    notes: `OpenRouter model-level default route price from /api/v1/models. Intel 2026-11-02: openai/gpt-oss-120b default $0.15/$0.60, cache $0.075 per 1M tokens. Endpoint floors remain separate non-headline variants. Source: ${OPENROUTER_SOURCE}.`,
  };
}

export const KIMI_CACHE_WRITES = [
  { key: 'cache-write-5m', ttl: '5m', seconds: 300, price: 2, headline: true },
  { key: 'cache-write-1h', ttl: '1h', seconds: 3600, price: 4, headline: false },
] as const;

export function kimiCacheWriteVariants(providerId: number, modelId: number) {
  const values = kimiChannel(KIMI_CHANNELS[0], providerId, modelId);
  const variants = KIMI_CACHE_WRITES.map(spec => ({
    ...values, variant_key: spec.key, variant_name: `Cache write (${spec.ttl} TTL)`, variant_kind: 'other',
    source_url: KIMI_SOURCE, cache_create_price_per_1m: spec.price,
    is_headline: spec.headline, is_public: true, is_self_service: true, is_partner_only: false,
    constraints_json: { cache_ttl_seconds: spec.seconds },
  }));
  assertCacheWriteHeadlines(variants, [values]);
  return variants;
}

export function catalog20261102SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || args.length > 1) {
    throw new Error('Usage: seed-catalog-2026-11-02.ts [--dry-run (offline) | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'models' | 'plans' | 'api_channel_prices' | 'api_channel_price_variants' | 'usage_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Diff-only writes; no deletes, no
 * provider creation, no production access from the offline CLI preview.
 */
export async function seedCatalog20261102(tx: Sql, apply = false): Promise<Step[]> {
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['openrouter', 'moonshot-global', 'minimax-china'])}`;
  const router = one(providers.filter(p => p.slug === 'openrouter'), 'providers/openrouter', true)!;
  const kimi = one(providers.filter(p => p.slug === 'moonshot-global'), 'providers/moonshot-global', true)!;
  const minimax = one(providers.filter(p => p.slug === 'minimax-china'), 'providers/minimax-china', true)!;
  if (!['official', 'producer'].includes(String(kimi.type)) || !['official', 'producer'].includes(String(minimax.type)) || router.type !== 'aggregator') {
    throw new Error('Unexpected provider types; nothing written.');
  }
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(['gpt-oss-120b', 'hailuo-video', WORLD_SLUG, ...KIMI_CHANNELS.flatMap(s => [...s.slugs])])}`;
  const oss = one(models.filter(m => m.slug === 'gpt-oss-120b'), 'models/gpt-oss-120b', true)!;
  const hailuo = one(models.filter(m => m.slug === 'hailuo-video'), 'models/hailuo-video', true)!;
  const world = one(models.filter(m => m.slug === WORLD_SLUG), `models/${WORLD_SLUG}`);
  const matchedKimi = KIMI_CHANNELS.map(spec => ({ spec, model: one(models.filter(m => (spec.slugs as readonly unknown[]).includes(m.slug)), `models/${spec.id}`) }));
  const routerPrice = one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${oss.id} AND provider_id = ${router.id}`, 'OpenRouter channel', true)!;
  const routerVariants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${oss.id} AND provider_id = ${router.id}`;
  const auto = one(routerVariants.filter(v => v.variant_key === 'openrouter-auto'), 'OpenRouter auto variant');
  const kimiRows = [];
  for (const match of matchedKimi) {
    const channels = match.model ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${match.model.id} AND provider_id = ${kimi.id}` : [];
    const variants = match.model ? await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${match.model.id} AND provider_id = ${kimi.id}` : [];
    const channel = one(channels, `Moonshot channel/${match.spec.id}`);
    for (const ttl of ['5m', '1h']) one(variants.filter(v => v.variant_key === `cache-write-${ttl}`), `Moonshot cache-write-${ttl}/${match.spec.id}`);
    if (match.spec.id === 'kimi-k3.1-pro') {
      const modelId = match.model?.id ?? -1;
      const generated = kimiCacheWriteVariants(kimi.id, modelId);
      const projected = [...variants.filter(v => !generated.some(g => g.variant_key === v.variant_key)), ...generated];
      assertCacheWriteHeadlines(projected, [kimiChannel(match.spec, kimi.id, modelId)]);
    }
    kimiRows.push({ ...match, channel, variants });
  }
  const usage = await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${hailuo.id} AND provider_id = ${minimax.id}`;
  const plan = one(await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${minimax.id} AND slug IN ${tx(['hailuo-video-official-pricing'])}`, 'Hailuo official reference plan');
  const hailuoPlanId = plan?.id ?? null;
  for (const rate of HAILUO.usageRates!) one(usage.filter(r => r.price_kind === rate.priceKind && r.unit === rate.unit && (r.plan_id ?? null) === hailuoPlanId), `Hailuo rate/${rate.priceKind}`);

  // All identity/uniqueness checks above finish before the first write.
  const steps: Step[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string): Promise<Row> => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id };
  };
  const routerValues = openRouterChannel(router.id, oss.id);
  await save('api_channel_prices', routerPrice, routerValues, 'openrouter/gpt-oss-120b');
  await save('api_channel_price_variants', auto, {
    model_id: oss.id, provider_id: router.id,
    input_price_per_1m: routerValues.input_price_per_1m, output_price_per_1m: routerValues.output_price_per_1m,
    cached_input_price_per_1m: routerValues.cached_input_price_per_1m,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: routerValues.notes, variant_key: 'openrouter-auto', variant_name: 'OpenRouter Auto / default route',
    variant_kind: 'default_route', source_url: OPENROUTER_SOURCE,
    is_headline: true, headline_rank: 0, is_public: true, is_self_service: true, is_partner_only: false,
    headline_reason: 'OpenRouter model-level default route price from /api/v1/models.',
    raw_json: { id: 'openai/gpt-oss-120b', audit: '2026-11-02', pricing: { prompt: '0.00000015', completion: '0.0000006', input_cache_read: '0.000000075' } },
  }, 'openrouter/gpt-oss-120b/openrouter-auto');
  for (const { spec, model, channel, variants } of kimiRows) {
    const saved = model ?? await save('models', null, {
      slug: spec.slugs[0], name: spec.id, type: 'llm', model_category: 'text', provider_ids: [kimi.id],
      offical_link: KIMI_SOURCE, pricing_unit: 'per_1m_tokens',
    }, spec.slugs[0]);
    const values = kimiChannel(spec, kimi.id, saved.id);
    await save('api_channel_prices', channel, values, `moonshot-global/${spec.id}`);
    if (spec.id === 'kimi-k3.1-pro') for (const variant of kimiCacheWriteVariants(kimi.id, saved.id)) {
      await save('api_channel_price_variants', variants.find(v => v.variant_key === variant.variant_key) ?? null,
        variant, `moonshot-global/${spec.id}/${variant.variant_key}`);
    }
  }
  if (world) await save('models', world, { pricing_unit: 'per_1m_tokens' }, WORLD_SLUG);
  await save('models', hailuo, { pricing_unit: 'per_second' }, 'hailuo-video');
  if (plan) await save('plans', plan, {
    price: null, currency: 'USD', price_unit: 'per_second', included_usage_unit: 'second',
    notes: `${HAILUO.pricing}\n${HAILUO.notes}\nSource: ${MINIMAX_SOURCE}`, last_verified: VERIFIED_AT,
  }, 'hailuo-video-official-pricing');
  // Retain historical IDs and references while removing obsolete quotes from
  // the public price table. No credit conversion is inferred from a /s rate.
  for (const row of usage) {
    const desired = HAILUO.usageRates!.some(rate => rate.priceKind === row.price_kind && rate.unit === row.unit);
    const obsolete = !desired && (['credit', 'generation', 'availability', 'video_second'].includes(String(row.price_kind)) ||
      row.unit === 'credit' || /h3[-_ ]max/i.test(`${row.price_kind} ${JSON.stringify(row.constraints_json)}`));
    if (obsolete) await save('usage_prices', row, { price: null, is_available: false }, `hailuo-video/obsolete/${row.id}`);
  }
  for (const rate of HAILUO.usageRates!) {
    const existing = usage.find(r => r.price_kind === rate.priceKind && r.unit === rate.unit && (r.plan_id ?? null) === hailuoPlanId) ?? null;
    await save('usage_prices', existing, {
      model_id: hailuo.id, provider_id: minimax.id, plan_id: hailuoPlanId, price_kind: rate.priceKind, unit: rate.unit,
      price: rate.price, currency: 'USD', is_available: true, source_url: MINIMAX_SOURCE, last_verified: VERIFIED_AT,
      constraints_json: { note: HAILUO.notes, publishedPricingText: HAILUO.pricing },
    }, `hailuo-video/${rate.priceKind}`);
  }
  return steps;
}
