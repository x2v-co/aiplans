import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Manual FINAL PAYG seed. No preview, subscription, mapping, or usage_prices writes.
 * Evidence was verified by the coordinator, offline here: 2026-11-16 14:50 SGT.
 * The CLI executes real writes in runRehearsable, rolling back unless --apply.
 */
export const SLUG = 'qwen4-max';
export const VERIFIED_AT = new Date('2026-11-16T06:50:00Z');
export const SOURCES = {
  model: 'https://www.qwencloud.com/models/qwen4-max',
  details: 'https://docs.qwencloud.com/developer-guides/getting-started/latest-model',
  international: 'https://docs.qwencloud.com/developer-guides/getting-started/pricing',
  china: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  openrouter: 'https://openrouter.ai/qwen/qwen4-max',
  endpoints: 'https://openrouter.ai/api/v1/models/qwen/qwen4-max/endpoints',
  vercel: 'https://vercel.com/ai-gateway/models/qwen4-max',
} as const;

// Lookup guards only: an alias requires manual reconciliation, never a second model.
export const FINAL_ALIASES = [
  SLUG, 'qwen-qwen4-max', 'alibaba-qwen4-max', 'qwen/qwen4-max', 'alibaba/qwen4-max',
  'openrouter-qwen4-max', 'openrouter-qwen-qwen4-max',
  'vercel-qwen4-max', 'vercel-ai-gateway-qwen4-max', 'vercel-ai-gateway-alibaba-qwen4-max',
  'qwen4.0-max', 'qwen4-0-max', 'qwen-qwen4-0-max',
] as const;

const evidence = (text: string, urls: readonly string[]) =>
  `${text} Verified 2026-11-16 14:50 SGT. Sources: ${urls.join(' ; ')}`;
const appendEvidence = (before: unknown, note: string) => {
  const text = String(before ?? '').trim();
  return text.includes(note) ? text : [text, note].filter(Boolean).join('\n');
};

export const MODEL_NOTES = evidence(
  'Final Qwen4-Max PAYG: native text/image/video inputs, text output; context 1,000,000 tokens. '
  + 'Model-wide max_output_tokens is unknown: detailed docs quote non-thinking 131,072 and thinking+answer 262,144, '
  + 'while marketplace quotes 393K, OpenRouter endpoint 393,216, and Vercel 384,000; these are route/mode-specific conflicting caps. '
  + 'Parameters and license are unknown. open_source=false means no published weights were verified; it is not a verified proprietary license designation. '
  + 'Detailed docs do not support batch, fine-tuning, or model deployment. '
  + 'Token Plan final-model mappings are deferred: the pending older seed has preview-only selectors; plan prices, quotas, selectors and mappings are outside this seed.',
  [SOURCES.model, SOURCES.details, SOURCES.endpoints, SOURCES.vercel],
);

export const REGIONAL_PRICES = [
  {
    key: 'beijing-cny', name: 'China North 2 (Beijing) — CNY PAYG', currency: 'CNY',
    input: 10, output: 30, cache: 0.5, write5m: 12.5, write1h: 20,
    region: 'cn-beijing', scope: 'China North 2 (Beijing)', headline: true, source: SOURCES.china,
    note: 'Beijing CNY list price per 1M tokens: input 10, output (thinking+answer) 30, explicit/implicit cache read 0.5. '
      + 'Explicit cache creation: 5m 12.5, 1h 20; creation is not cache read. '
      + 'The Beijing-only 1M-token/90-day eligibility-based free quota is not a zero token rate or promotion.',
  },
  {
    key: 'singapore-international-usd', name: 'Singapore International — USD PAYG', currency: 'USD',
    input: 1.5, output: 4.5, cache: 0.075, write5m: 1.875, write1h: 3,
    region: 'ap-southeast-1', scope: 'Singapore International', headline: false, source: SOURCES.international,
    note: 'Singapore International USD list price per 1M tokens: input 1.5, output 4.5, explicit/implicit cache read 0.075. '
      + 'Explicit cache creation: 5m 1.875, 1h 3; creation is not cache read. '
      + 'These are Singapore service deployment prices, not a universal USD conversion of the Beijing CNY price.',
  },
] as const;

export const SEED_TABLES = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants', 'usage_prices', 'plans', 'model_plan_mapping'] as const;
type Table = (typeof SEED_TABLES)[number];
type WritableTable = 'models' | 'api_channel_prices' | 'api_channel_price_variants';
type Row = Record<string, unknown> & {
  id: number;
  is_available?: boolean | null;
  availability_locked?: boolean | null;
  notes?: string | null;
};
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update' | 'skip';
  changes: ReturnType<typeof seedChanges>;
  reason?: string;
}

/** Offline assumption, not a production dry-run: final model/aliases absent;
 * qwen (producer/official), openrouter and vercel-ai-gateway (aggregators) exist;
 * no final channels/variants; plans and their mappings are deferred.
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 1, update: 0 },
  api_channel_prices: { insert: 3, update: 0 },
  api_channel_price_variants: { insert: 2, update: 0 },
  usage_prices: { insert: 0, update: 0 },
  plans: { insert: 0, update: 0 },
  model_plan_mapping: { insert: 0, update: 0 },
} as const;

export function seedStepCounts(steps: Step[]) {
  return Object.fromEntries(SEED_TABLES.map(table => [table, {
    insert: steps.filter(s => s.table === table && s.action === 'insert').length,
    update: steps.filter(s => s.table === table && s.action === 'update').length,
  }])) as Record<Table, { insert: number; update: number }>;
}

export function catalog20261116Qwen4MaxSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-16-qwen4-max.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Integration-test guard only. Reject query overrides (including ?host=remote),
 * sockets and other protocols before importing/constructing a Postgres client.
 */
export function assertQwen4MaxLoopbackTestUrl(raw: string): void {
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.search !== '' || url.hash !== '') {
    throw new Error('Qwen4-Max integration test requires a loopback Postgres URL without query overrides');
  }
}

const newer = (row: Row | null) => row?.last_verified != null
  && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime();

export async function seedCatalog20261116Qwen4Max(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['qwen', 'openrouter', 'vercel-ai-gateway', 'vercel'])}`;
  const qwen = one(providers.filter(p => p.slug === 'qwen'), 'providers/qwen', true)!;
  const openrouter = one(providers.filter(p => p.slug === 'openrouter'), 'providers/openrouter', true)!;
  const vercel = one(providers.filter(p => ['vercel-ai-gateway', 'vercel'].includes(String(p.slug))), 'providers/vercel-ai-gateway', true)!;
  if (!['producer', 'official'].includes(String(qwen.type))) fail('Wrong owner type for providers/qwen');
  for (const row of [openrouter, vercel]) {
    if (row.type !== 'aggregator') fail(`Wrong provider type for ${row.slug}`);
  }
  const matches = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(FINAL_ALIASES)}`;
  const existing = one(matches, `final models/${SLUG}`);
  if (existing && existing.slug !== SLUG) fail(`Non-canonical final alias ${existing.slug}; reconcile manually`);
  if (existing) {
    const owners = existing.provider_ids;
    if (!Array.isArray(owners) || !owners.includes(qwen.id)
      || owners.some(id => ![qwen.id, openrouter.id, vercel.id].includes(id))) fail('Wrong or uncertain model owner');
    if (existing.type !== 'llm' || (existing.model_category != null && existing.model_category !== 'text')
      || String(existing.name).toLowerCase().replace(/[\s-]/g, '') !== 'qwen4max'
      || (existing.pricing_unit != null && existing.pricing_unit !== 'per_1m_tokens')
      || existing.shutdown_date != null || existing.deprecated_at != null || existing.replacement_model != null) {
      fail('Incompatible existing canonical final model');
    }
  }

  const steps: Step[] = [];
  const pending: { table: WritableTable; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const skip = (table: Table, target: string, reason: string) => steps.push({ table, target, action: 'skip', changes: {}, reason });
  const save = (table: WritableTable, row: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if (table !== 'models' && newer(row)) {
      skip(table, target, 'Newer verified record retained in full');
      return row!;
    }
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return row!;
    const id = row?.id ?? previewId--;
    steps.push({ table, target, action: row ? 'update' : 'insert', changes });
    // Update only fields that differ; preserve unmentioned columns and locks.
    const values = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.to]));
    pending.push({ table, existing: row, values, id });
    return { ...row, ...desired, id };
  };
  const model = save('models', existing, {
    slug: SLUG, name: 'Qwen4-Max', type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...((existing?.provider_ids as number[] | undefined) ?? []), qwen.id, openrouter.id, vercel.id])],
    context_window: 1_000_000, max_output_tokens: null, parameters: null, 'active parameters': null,
    open_source: false, license: null, license_url: null,
    input_type: ['text', 'image', 'video'], input_modalities: ['text', 'image', 'video'],
    output_type: ['text'], output_modalities: ['text'],
    capabilities: [...new Set([...((existing?.capabilities as string[] | undefined) ?? []), 'reasoning', 'tool-calling', 'structured-outputs'])],
    pricing_unit: 'per_1m_tokens', offical_link: SOURCES.model,
    description: appendEvidence(existing?.description, MODEL_NOTES),
  }, SLUG);

  const channels = new Map<number, Row | null>();
  for (const provider of [qwen, openrouter, vercel]) {
    const rows = existing
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${existing.id} AND provider_id = ${provider.id}` : [];
    channels.set(provider.id, one(rows, `api_channel_prices/${provider.slug}/${SLUG}`));
  }
  const variants = existing
    ? await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${existing.id} AND provider_id = ${qwen.id}` : [];
  for (const key of new Set(variants.map(row => String(row.variant_key)))) {
    one(variants.filter(row => row.variant_key === key), `qwen/${SLUG}/${key}`);
  }
  if (variants.some(row => row.is_headline === true && row.variant_key !== 'beijing-cny')) fail('Conflicting Qwen headline variant');
  for (const spec of REGIONAL_PRICES) {
    const row = variants.find(v => v.variant_key === spec.key);
    if (row && (row.currency !== spec.currency || row.variant_kind !== 'tier')) fail(`Incompatible regional variant ${spec.key}`);
  }

  const cn = REGIONAL_PRICES[0];
  const official = channels.get(qwen.id)!;
  // Preserve the entire official group when any member is newer: no headline drift.
  const keepOfficialGroup = newer(official) || variants.some(row => newer(row));
  const officialNotes = evidence(`ModelID ${SLUG}. ${cn.note} Thinking and non-thinking have the same rates, no input-length price tiers for 0 < tokens <= 1,000,000. `
    + 'Singapore International USD prices are a separate regional variant. Cache write charges have no channel column and are recorded here and on regional variants.', [SOURCES.china, SOURCES.international]);
  const channelRow = (providerId: number, input: number, output: number, cache: number | null, currency: string, notes: string) => ({
    model_id: model.id, provider_id: providerId,
    input_price_per_1m: input, output_price_per_1m: output, cached_input_price_per_1m: cache,
    regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    promo_ends_at: null, currency, price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: appendEvidence(channels.get(providerId)?.notes, notes),
  });
  if (keepOfficialGroup) {
    skip('api_channel_prices', `qwen/${SLUG}`, 'Official group retained: newer channel or variant evidence');
    for (const spec of REGIONAL_PRICES) skip('api_channel_price_variants', `qwen/${SLUG}/${spec.key}`, 'Official group retained: newer channel or variant evidence');
  } else {
    save('api_channel_prices', official, retainLockedUnavailable(channelRow(qwen.id, cn.input, cn.output, cn.cache, cn.currency, officialNotes), official), `qwen/${SLUG}`);
    for (const spec of REGIONAL_PRICES) {
      const row = variants.find(v => v.variant_key === spec.key) ?? null;
      save('api_channel_price_variants', row, retainLockedUnavailable(retainLockedUnavailable({
        model_id: model.id, provider_id: qwen.id, variant_key: spec.key, variant_name: spec.name,
        // Existing supported tier kind; deployment geography is explicit in name/constraints.
        variant_kind: 'tier', currency: spec.currency, price_unit: 'per_1m_tokens',
        input_price_per_1m: spec.input, output_price_per_1m: spec.output, cached_input_price_per_1m: spec.cache,
        cache_create_price_per_1m: spec.write5m,
        is_available: true, is_public: true, is_self_service: true, is_partner_only: false,
        is_headline: spec.headline, headline_rank: spec.headline ? 0 : 1,
        headline_reason: spec.headline ? 'Official Beijing CNY PAYG list price, matching the Qwen channel.' : null,
        constraints_json: {
          ...((row?.constraints_json as Record<string, unknown> | undefined) ?? {}),
          model_id: SLUG, deployment_region: spec.region, geographic_scope: spec.scope,
          currency: spec.currency, min_context_exclusive: 0, max_context_tokens: 1_000_000,
          thinking_and_non_thinking_same_price: true,
          cache_create_ttl_seconds: 300, cache_write_prices_per_1m: { '5m': spec.write5m, '1h': spec.write1h },
          cache_read: 'Explicit and implicit cache hits; cache creation is a separate charge.',
        },
        source_url: spec.source, last_verified: VERIFIED_AT,
        notes: appendEvidence(row?.notes, evidence(`ModelID ${SLUG}. ${spec.note} cache_create_price_per_1m is the 5m TTL only; 1h is in constraints. Same rates for thinking/non-thinking. Deployment geography does not imply customer supported_regions.`, [spec.source])),
      }, row), official), `qwen/${SLUG}/${spec.key}`);
    }
  }
  save('api_channel_prices', channels.get(openrouter.id)!, retainLockedUnavailable(channelRow(openrouter.id, 1.5, 4.5, 0.075, 'USD', evidence(
    'ModelID qwen/qwen4-max. USD per 1M input/output/cache read: 1.5/4.5/0.075. Explicit cache creation 5m: 1.875/M, not cache read. '
      + 'Endpoint Alibaba tag alibaba status 0, supports_implicit_caching=false; implicit caching is not guaranteed. Route cap 393,216 output; no model-wide output cap is inferred.',
    [SOURCES.openrouter, SOURCES.endpoints],
  )), channels.get(openrouter.id)), `openrouter/${SLUG}`);
  save('api_channel_prices', channels.get(vercel.id)!, retainLockedUnavailable(channelRow(vercel.id, 1.5, 4.5, null, 'USD', evidence(
    'ModelID alibaba/qwen4-max. USD per 1M input/output: 1.5/4.5. Cache rate not quoted, stored NULL. Vercel route output cap 384,000; not a universal model cap.',
    [SOURCES.vercel],
  )), channels.get(vercel.id)), `${vercel.slug}/${SLUG}`);

  // Every guard runs before the first write. Dependencies use temporary negative IDs.
  if (apply) {
    const ids = new Map<number, number>();
    for (const op of pending) {
      const payload: Record<string, unknown> = { ...op.values, updated_at: new Date() };
      if (typeof payload.model_id === 'number' && payload.model_id < 0) {
        const id = ids.get(payload.model_id);
        if (id == null) throw new Error('Unresolved model dependency');
        payload.model_id = id;
      }
      if (payload.constraints_json != null) payload.constraints_json = tx.json(payload.constraints_json as never);
      if (op.existing) {
        await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.existing.id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(op.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(op.id, inserted.id);
      }
    }
  }
  return steps;
}
