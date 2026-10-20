import type { Sql } from 'postgres';
import { shutdownReached } from '../../src/lib/model-shutdown';
import { seedChanges } from './gemini-4-argon';

/**
 * Intel 2026-10-20 midday (P0): Xiaomi MiMo deprecation + official pay-as-you-go prices.
 * Verified 2026-10-20 against:
 *   https://mimo.mi.com/docs/en-US/updates/deprecate
 *   https://mimo.mi.com/static/docs/price/pay-as-you-go.md
 *
 * - mimo-v2.5-pro and mimo-v2.5 are removed at 2026-10-21 10:00 UTC+8 (02:00 UTC, so the
 *   UTC shutdown day is 2026-10-21). Since 2026-10-14 requests are auto-routed to
 *   mimo-v2.6-pro / mimo-v2.6-flash and billed at the new model's price. (The deprecation
 *   table says system replacement 10:00 UTC+8; the note under it says routing started 18:00.)
 * - Official list prices per 1M tokens. China cluster bills CNY, overseas cluster bills USD,
 *   so each cluster is its own official provider (same convention as moonshot-china/-global).
 * - Batch API is exactly half price for v2.6-pro and v2.6-flash only; stored as a
 *   variant_kind 'batch' variant (same as claude-haiku-5.5). Ultraspeed, v2.5-pro and v2.5
 *   have no Batch API. Cache write is "limited-time free" (not stored as a price).
 */
export const MIMO_DEPRECATION_SOURCE = 'https://mimo.mi.com/docs/en-US/updates/deprecate';
export const MIMO_PRICE_SOURCE = 'https://mimo.mi.com/static/docs/price/pay-as-you-go.md';
export const MIMO_VERIFIED_AT = new Date('2026-10-20T00:00:00Z');
export const MIMO_SHUTDOWN_DATE = '2026-10-21';

export interface Rate { input: number; output: number; cache: number }
export type Cluster = 'china' | 'global';

export const MIMO_PROVIDERS: Record<Cluster, Record<string, unknown> & { slug: string }> = {
  china: {
    name: '小米 MiMo 开放平台', slug: 'xiaomi-mimo-china', type: 'official', region: 'china', currency: 'CNY',
    access_from_china: true, website: 'https://platform.xiaomimimo.com', pricing_url: MIMO_PRICE_SOURCE,
    logo_url: '/providers/xiaomi.ico', priority: 1,
    notes: `Xiaomi MiMo Open Platform, China cluster, pay-as-you-go, billed in CNY. Source: ${MIMO_PRICE_SOURCE} (verified 2026-10-20).`,
  },
  global: {
    name: 'Xiaomi MiMo (Global)', slug: 'xiaomi-mimo-global', type: 'official', region: 'global', currency: 'USD',
    access_from_china: false, website: 'https://platform.xiaomimimo.com', pricing_url: MIMO_PRICE_SOURCE,
    logo_url: '/providers/xiaomi.ico', priority: 1,
    notes: `Xiaomi MiMo Open Platform, overseas cluster, pay-as-you-go, billed in USD. Source: ${MIMO_PRICE_SOURCE} (verified 2026-10-20).`,
  },
};

/** Official real-time list prices, per 1M tokens. */
export const MIMO_REALTIME: Record<'pro' | 'flash' | 'ultraspeed', Record<Cluster, Rate>> = {
  pro: { china: { input: 3, output: 6, cache: 0.025 }, global: { input: 0.435, output: 0.87, cache: 0.0036 } },
  flash: { china: { input: 1, output: 2, cache: 0.02 }, global: { input: 0.14, output: 0.28, cache: 0.0028 } },
  ultraspeed: { china: { input: 30, output: 60, cache: 0.25 }, global: { input: 4.35, output: 8.7, cache: 0.036 } },
};

/** Official Batch API prices (exactly 50% of real-time), per 1M tokens. */
export const MIMO_BATCH: Partial<Record<'pro' | 'flash', Record<Cluster, Rate>>> = {
  pro: { china: { input: 1.5, output: 3, cache: 0.0125 }, global: { input: 0.2175, output: 0.435, cache: 0.0018 } },
  flash: { china: { input: 0.5, output: 1, cache: 0.01 }, global: { input: 0.07, output: 0.14, cache: 0.0014 } },
};

export interface MimoModel {
  slug: string;
  apiId: string;
  tier: 'pro' | 'flash' | 'ultraspeed';
  /** Set for deprecated models: they bill as this API id since auto-routing began. */
  routedTo?: string;
}

export const MIMO_MODELS: readonly MimoModel[] = [
  { slug: 'xiaomi-mimo-v2-6-pro', apiId: 'mimo-v2.6-pro', tier: 'pro' },
  { slug: 'xiaomi-mimo-v2-6-flash', apiId: 'mimo-v2.6-flash', tier: 'flash' },
  { slug: 'xiaomi-mimo-v2-6-pro-ultraspeed', apiId: 'mimo-v2.6-pro-ultraspeed', tier: 'ultraspeed' },
  { slug: 'xiaomi-mimo-v2-5-pro', apiId: 'mimo-v2.5-pro', tier: 'pro', routedTo: 'mimo-v2.6-pro' },
  { slug: 'xiaomi-mimo-v2-5', apiId: 'mimo-v2.5', tier: 'flash', routedTo: 'mimo-v2.6-flash' },
];

export const MIMO_SHUTDOWNS = MIMO_MODELS.filter(m => m.routedTo).map(m => ({
  slug: m.slug, shutdown_date: MIMO_SHUTDOWN_DATE, replacement_model: m.routedTo!, deprecation_source_url: MIMO_DEPRECATION_SOURCE,
}));

const money = (cluster: Cluster, v: number) => (cluster === 'china' ? `¥${v}` : `$${v}`);

export function mimoChannelNote(model: MimoModel, cluster: Cluster): string {
  const r = MIMO_REALTIME[model.tier][cluster];
  const b = model.routedTo ? undefined : MIMO_BATCH[model.tier as 'pro' | 'flash'];
  const lines = [
    `API ID: ${model.apiId}. Official ${cluster === 'china' ? 'China (CNY)' : 'overseas (USD)'} pay-as-you-go list price per 1M tokens: input ${money(cluster, r.input)}, output ${money(cluster, r.output)}, cache hit ${money(cluster, r.cache)}. Cache write is limited-time free.`,
  ];
  if (model.routedTo) {
    lines.push(`Deprecated: name removed ${MIMO_SHUTDOWN_DATE} 10:00 UTC+8. Since 2026-10-14 requests are auto-routed to ${model.routedTo} and billed at ${model.routedTo} prices (shown here). No Batch API. Deprecation: ${MIMO_DEPRECATION_SOURCE}`);
  } else if (b) {
    const batch = b[cluster];
    lines.push(`Batch API (50% off): input ${money(cluster, batch.input)}, output ${money(cluster, batch.output)}, cache hit ${money(cluster, batch.cache)}; see the batch variant.`);
  } else {
    lines.push('No Batch API for this model.');
  }
  lines.push(`Source: ${MIMO_PRICE_SOURCE} (verified 2026-10-20).`);
  return lines.join('\n');
}

export function mimoSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-mimo-2026-10-20.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'api_channel_price_variants';
export interface MimoStep { table: Table; target: string; action: 'insert' | 'update' | 'skip'; changes: ReturnType<typeof seedChanges>; reason?: string }

/**
 * Caller owns a serializable transaction. Dry-run is SELECT-only. Never creates model rows:
 * a missing MiMo model is reported as 'skip'. Duplicate rows abort (nothing written).
 * Official rows for an already-retired model (UTC day >= shutdown) are not inserted.
 */
export async function seedMimo20261020(tx: Sql, apply = false, now = new Date()): Promise<MimoStep[]> {
  const steps: MimoStep[] = [];
  let previewId = -1;
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string): Promise<Row> => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id } as Row;
  };

  // Validate before any write so a collision aborts with nothing written.
  const existingProviders = {} as Record<Cluster, Row | null>;
  for (const cluster of ['china', 'global'] as const) {
    const slug = MIMO_PROVIDERS[cluster].slug;
    const existing = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${slug}`, `providers/${slug}`);
    if (existing && existing.type !== 'official') throw new Error(`providers/${slug} exists with type ${String(existing.type)}; nothing written.`);
    existingProviders[cluster] = existing;
  }

  const slugs = MIMO_MODELS.map(m => m.slug);
  const modelRows = await tx<Row[]>`SELECT id, slug, shutdown_date::text AS shutdown_date, replacement_model, deprecation_source_url
    FROM models WHERE slug IN ${tx(slugs)} ORDER BY slug`;
  const models = new Map<string, Row>();
  for (const slug of slugs) {
    const row = one(modelRows.filter(r => r.slug === slug), `models/${slug}`);
    if (row) models.set(slug, row);
    else steps.push({ table: 'models', target: slug, action: 'skip', changes: {}, reason: 'model row not found; not created' });
  }

  // 1) Deprecation fields. Channel retirement after the date is done by the deploy sweep
  //    (seed-shutdown-availability) and the scraper; this seed does not disable channels.
  for (const s of MIMO_SHUTDOWNS) {
    const row = models.get(s.slug);
    if (!row) continue;
    const { slug: _slug, ...fields } = s;
    void _slug;
    const changes = seedChanges(row, fields);
    if (!Object.keys(changes).length) continue;
    steps.push({ table: 'models', target: s.slug, action: 'update', changes });
    if (apply) {
      await tx`UPDATE models SET shutdown_date = ${fields.shutdown_date}::date, replacement_model = ${fields.replacement_model},
        deprecation_source_url = ${fields.deprecation_source_url}, updated_at = ${new Date()} WHERE id = ${row.id}`;
    }
  }

  // 2) Official providers, one per billing cluster.
  const providers = {} as Record<Cluster, Row>;
  for (const cluster of ['china', 'global'] as const) {
    const desired = MIMO_PROVIDERS[cluster];
    providers[cluster] = await save('providers', existingProviders[cluster], desired, desired.slug);
  }

  // 3) Official channel rows + real-time / batch variants.
  for (const model of MIMO_MODELS) {
    const row = models.get(model.slug);
    if (!row) continue;
    const retired = model.routedTo != null && shutdownReached(MIMO_SHUTDOWN_DATE, now);
    for (const cluster of ['china', 'global'] as const) {
      const provider = providers[cluster];
      const target = `${provider.slug}/${model.slug}`;
      const channel = one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${row.id} AND provider_id = ${provider.id}`, `api_channel_prices/${target}`);
      if (retired && !channel) {
        steps.push({ table: 'api_channel_prices', target, action: 'skip', changes: {}, reason: `model retired on ${MIMO_SHUTDOWN_DATE}; no new official row` });
        continue;
      }
      if (retired) continue; // leave existing rows to the shutdown sweep
      const r = MIMO_REALTIME[model.tier][cluster];
      const currency = cluster === 'china' ? 'CNY' : 'USD';
      const notes = mimoChannelNote(model, cluster);
      const common = { model_id: row.id, provider_id: provider.id, currency, price_unit: 'per_1m_tokens', is_available: true, last_verified: MIMO_VERIFIED_AT };
      await save('api_channel_prices', channel, {
        ...common, input_price_per_1m: r.input, output_price_per_1m: r.output, cached_input_price_per_1m: r.cache,
        promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
        notes,
      }, target);

      const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${row.id} AND provider_id = ${provider.id}`;
      for (const key of new Set(variants.map(v => v.variant_key))) one(variants.filter(v => v.variant_key === key), `api_channel_price_variants/${target}/${String(key)}`);
      for (const v of variants.filter(v => v.is_headline === true && v.variant_key !== 'realtime')) {
        await save('api_channel_price_variants', v, { is_headline: false }, `${target}/${String(v.variant_key)}`);
      }
      const variantCommon = { ...common, source_url: MIMO_PRICE_SOURCE, is_public: true, is_self_service: true, is_partner_only: false };
      await save('api_channel_price_variants', variants.find(v => v.variant_key === 'realtime') ?? null, {
        ...variantCommon, variant_key: 'realtime', variant_name: 'Real-time API', variant_kind: 'processing',
        input_price_per_1m: r.input, output_price_per_1m: r.output, cached_input_price_per_1m: r.cache,
        is_headline: true, constraints_json: { processing: 'realtime', api_id: model.apiId, ...(model.routedTo ? { billed_as: model.routedTo } : {}) },
        notes,
      }, `${target}/realtime`);
      const batch = model.routedTo ? undefined : MIMO_BATCH[model.tier as 'pro' | 'flash']?.[cluster];
      if (batch) {
        await save('api_channel_price_variants', variants.find(v => v.variant_key === 'batch') ?? null, {
          ...variantCommon, variant_key: 'batch', variant_name: 'Batch API (50% off)', variant_kind: 'batch',
          input_price_per_1m: batch.input, output_price_per_1m: batch.output, cached_input_price_per_1m: batch.cache,
          is_headline: false, constraints_json: { processing: 'batch', api_id: model.apiId },
          notes: `Official Batch API price, half of real-time. Source: ${MIMO_PRICE_SOURCE} (verified 2026-10-20).`,
        }, `${target}/batch`);
      }
    }
  }
  return steps;
}
