import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Intel 2026-11-03 07:50 #1 #2. Optional SRE seed, never part of deploy. Default dry-run is a
 * READ ONLY transaction; --apply writes every change in one serializable transaction.
 *
 * 1. Gemini 2.5 Pro / Flash deprecation. Verified 2026-11-03 against the 2026-11-02 changelog
 *    entry and the pricing-page callouts: both are deprecated and no longer selectable in AI
 *    Studio; from 2026-12-01 every API request auto-routes to gemini-3.8-flash (2.5 Pro) /
 *    gemini-3.5-flash-lite (2.5 Flash) and bills at the target's rates. The endpoint is not
 *    shut down, so shutdown_date is NOT written (the deploy sweep would disable live channels,
 *    same reasoning as the undated Kimi K2 notice). Only deprecated_at / replacement_model /
 *    deprecation_source_url are recorded. The deprecations table still read "These models are
 *    not deprecated ... No shutdown date announced" on 2026-11-03; the newer changelog and
 *    pricing callouts win. The Batch SKU rows follow their base model string.
 *    An existing non-NULL shutdown_date is left untouched and reported.
 * 2. Meituan LongCat-2.5 (released 2026-11-02, LongCat API change log). Official pay-as-you-go
 *    limited-time discounted price per 1M tokens: input ¥2, cache hit ¥0.04, output ¥8
 *    (same page in USD: $0.30 / $0.006 / $1.20). No end date and no post-promotion price are
 *    published, so promo_ends_at / regular_* stay NULL. Stored in CNY (the platform's original
 *    currency; the USD table is noted). Model params page: context 1,048,576, max_tokens
 *    upper bound 262,144 (the Intel brief said 128K; the official page wins).
 *    Slug follows the OpenRouter generator (meituan/longcat-2.0 -> meituan-longcat-2-0), so a
 *    later OpenRouter listing attaches to this row instead of creating a duplicate.
 */
export const VERIFIED = '2026-11-03';
export const VERIFIED_AT = new Date('2026-11-03T00:00:00Z');
export const GEMINI_CHANGELOG = 'https://ai.google.dev/gemini-api/docs/changelog';
export const GEMINI_DEPRECATED_AT = '2026-11-02';
export const GEMINI_25: ReadonlyArray<{ slug: string; replacement: string }> = [
  { slug: 'gemini-2.5-pro', replacement: 'gemini-3.8-flash' },
  { slug: 'google-gemini-gemini-2-5-pro-batch', replacement: 'gemini-3.8-flash' },
  { slug: 'gemini-2.5-flash', replacement: 'gemini-3.5-flash-lite' },
  { slug: 'google-gemini-gemini-2-5-flash-batch', replacement: 'gemini-3.5-flash-lite' },
];

export const LONGCAT_SLUG = 'meituan-longcat-2-5';
/** Alternate identities that must not already exist under another slug. */
export const LONGCAT_ALIASES = [LONGCAT_SLUG, 'longcat-2.5', 'longcat-2-5', 'meituan-longcat-2.5', 'meituan-longcat2-5'];
export const LONGCAT_PRICE_SOURCE = 'https://longcat.chat/platform/docs/zh/pricing/longcat-2.5';
export const LONGCAT_PARAMS_SOURCE = 'https://longcat.chat/platform/docs/zh/api/model-params';
export const LONGCAT_CHANGELOG = 'https://longcat.chat/platform/docs/zh/change-log';
export const LONGCAT_PRICE = { input: 2, cached: 0.04, output: 8, usd: { input: 0.3, cached: 0.006, output: 1.2 } } as const;

export function meituanProviderRow() {
  return {
    name: 'Meituan LongCat', slug: 'meituan', type: 'official', region: 'china', currency: 'CNY',
    website: 'https://longcat.chat/platform', pricing_url: LONGCAT_PRICE_SOURCE,
    api_docs_url: 'https://longcat.chat/platform/docs/zh/api-docs', access_from_china: true,
    notes: `Meituan LongCat API Open Platform (api.longcat.chat), pay-as-you-go, prices published in CNY and USD. Source: ${LONGCAT_PRICE_SOURCE} (verified ${VERIFIED}).`,
  };
}

/** Existing provider: only fill fields that are still NULL; never overwrite curated values. */
export function meituanProviderFill(existing: Record<string, unknown>) {
  const want = meituanProviderRow();
  const fill: Record<string, unknown> = {};
  for (const key of ['website', 'pricing_url', 'api_docs_url'] as const) if (existing[key] == null) fill[key] = want[key];
  return fill;
}

export function longcatModelRow(providerId: number) {
  return {
    name: 'LongCat-2.5', slug: LONGCAT_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [providerId],
    context_window: 1_048_576, max_output_tokens: 262_144,
    released_at: new Date('2026-11-02T00:00:00Z'),
    offical_link: LONGCAT_CHANGELOG,
    input_modalities: ['text', 'image'], output_modalities: ['text'],
    capabilities: ['reasoning', 'tool-calling'],
    description: `Meituan LongCat-2.5, released 2026-11-02 on the LongCat API Open Platform: natively multimodal (vision understanding + agentic coding), long-horizon agent tasks, works with Claude Code / Codex / Hermes harnesses; OpenAI- and Anthropic-compatible endpoints. Context 1,048,576 tokens; max_tokens up to 262,144. Weights/licence not established by these sources. Sources: ${LONGCAT_CHANGELOG}, ${LONGCAT_PARAMS_SOURCE} (verified ${VERIFIED}).`,
  };
}

export function longcatChannelRow(providerId: number, modelId: number) {
  const { input, cached, output, usd } = LONGCAT_PRICE;
  return {
    model_id: modelId, provider_id: providerId,
    input_price_per_1m: input, output_price_per_1m: output, cached_input_price_per_1m: cached,
    currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true,
    // 限时折扣价，官方未给截止日，也未给原价。
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    last_verified: VERIFIED_AT,
    notes: `LongCat-2.5 官方按量付费，限时折扣价（平台初上线优惠，未标截止日，未公布原价；实际费用以结算为准）。每百万 token：输入（未命中缓存）¥${input}，输入（命中缓存）¥${cached}，输出 ¥${output}。同页美元价：$${usd.input} / $${usd.cached} / $${usd.output}。Limited-time launch discount, no end date published. Source: ${LONGCAT_PRICE_SOURCE} (verified ${VERIFIED}).`,
  };
}

export function catalog20261103SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-03.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update' | 'skip'; changes: ReturnType<typeof seedChanges>; reason?: string }

const day = (value: unknown) => value == null ? null : (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

/** Caller owns a serializable transaction (READ ONLY for dry-run). No deletes or schema changes. */
export async function seedCatalog20261103(tx: Sql, apply = false): Promise<Step[]> {
  const steps: Step[] = [];
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) throw new Error(`Expected at most one ${target}, found ${rows.length}; nothing written.`);
    return rows[0] ?? null;
  };

  // Validate the entire scope before any write.
  const gemini = await tx<Row[]>`SELECT id, slug, shutdown_date::text AS shutdown_date, deprecated_at::text AS deprecated_at,
    replacement_model, deprecation_source_url FROM models WHERE slug IN ${tx(GEMINI_25.map(g => g.slug))}`;
  for (const g of GEMINI_25) one(gemini.filter(r => r.slug === g.slug), `models/${g.slug}`);
  const provider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'meituan'}`, 'providers/meituan');
  if (provider && !['official', 'producer'].includes(String(provider.type))) throw new Error(`providers/meituan has type ${String(provider.type)}; nothing written.`);
  const aliases = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(LONGCAT_ALIASES)}`;
  if (aliases.some(r => r.slug !== LONGCAT_SLUG)) throw new Error(`Non-canonical LongCat-2.5 row exists (${aliases.map(r => r.slug).join(', ')}); review before seeding. Nothing written.`);
  const model = one(aliases, `models/${LONGCAT_SLUG}`);
  const channel = model && provider ? one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`, `api_channel_prices/meituan/${LONGCAT_SLUG}`) : null;

  let previewId = -1;
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
    return { ...existing, ...payload, id };
  };

  // 1) Gemini 2.5 deprecation fields (no shutdown_date).
  for (const g of GEMINI_25) {
    const row = gemini.find(r => r.slug === g.slug) ?? null;
    if (!row) { steps.push({ table: 'models', target: g.slug, action: 'skip', changes: {}, reason: 'model row not found; not created' }); continue; }
    if (row.shutdown_date != null) steps.push({ table: 'models', target: g.slug, action: 'skip', changes: {}, reason: `shutdown_date is ${String(row.shutdown_date)}; left unchanged for review (official: endpoint auto-routes, no shutdown)` });
    const current = { ...row, deprecated_at: day(row.deprecated_at) };
    await save('models', current, { deprecated_at: GEMINI_DEPRECATED_AT, replacement_model: g.replacement, deprecation_source_url: GEMINI_CHANGELOG }, g.slug);
  }

  // 2) LongCat-2.5: provider (insert, or fill NULL links), model, official CNY channel.
  const savedProvider = provider
    ? (Object.keys(meituanProviderFill(provider)).length ? await save('providers', provider, meituanProviderFill(provider), 'meituan') : provider)
    : await save('providers', null, meituanProviderRow(), 'meituan');
  const savedModel = await save('models', model, longcatModelRow(savedProvider.id), LONGCAT_SLUG);
  await save('api_channel_prices', channel, longcatChannelRow(savedProvider.id, savedModel.id), `meituan/${LONGCAT_SLUG}`);
  return steps;
}
