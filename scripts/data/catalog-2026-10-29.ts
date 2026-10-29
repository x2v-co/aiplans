import type { Sql } from 'postgres';
import { VARIABLE_ROUTER_SENTINEL } from '../utils/manual-unavailable';

/**
 * 2026-10-29 Intel data audit. Original audit values were re-checked on the
 * official pages on 2026-10-29; the Kimi K3 correction below uses user-supplied
 * official evidence. Exact-slug matching only; missing rows are reported and
 * skipped, duplicates abort. Optional SRE seed, not on deploy.
 *
 *  1. context_window (P1-1): OpenAI model pages list GPT-6 Luna / Sol, GPT-6.1
 *     Sol / Terra at 1,050,000 and GPT-5 / 5 mini / 5 nano / 5.6-Cyber at 400,000.
 *     Production stored 128,000: the OpenAI API scraper passes a hard-coded
 *     128_000 when it creates a model row (fixed in a separate code PR). Only a
 *     NULL or 128000 value is replaced; any other value is reported, not changed.
 *  2. Kimi K2 (P1-2): Moonshot pricing page: K2 series closed to new sign-ups
 *     from 2026-10-31, all K2 models planned to go offline "end of December"
 *     with no exact day. shutdown_date / deprecated_at stay NULL (no invented
 *     date); only the source URL and the migration target (the notice links to
 *     the Kimi K3.1 Pro quickstart) are recorded, and only where still NULL.
 *  3. access_from_china (P1-4): Claude, ChatGPT and Gemini supported-country
 *     lists do not include mainland China. Team/Business/Ultra plans were true.
 *  4. gemini-2.5-flash-image (P1-5): deprecations page lists shutdown
 *     2027-03-15, replacement gemini-3.1-flash-lite-image; the pricing page still
 *     sells it. Production had shutdown 2026-10-02 (that is the release-date
 *     column) so the daily sweep disabled + locked its channels. This fixes the
 *     model row (also written by the static catalog) and re-enables only rows
 *     that sweep locked, in the same transaction so the sweep does not re-lock.
 *  5. Missing first-party channels (legacy P1): Z.ai international GLM-5.3-FlashX
 *     $0.37 / cached $0.075 / $1.25; MiniMax international MiniMax-M3.1-Flash
 *     $0.15 / cached $0.015 / $0.60 (USD per 1M tokens). Neither provider's API
 *     scraper writes these provider ids, so the rows are not overwritten.
 *  6. Kimi K3: user-supplied official quickstart + MoonshotAI/Kimi-K3 README
 *     state Context Length 1048576. max_completion_tokens default 131072 is
 *     an output limit, not context length. Repair only exact slug kimi-k3
 *     from NULL/128000; other K3 variants require separate verification.
 *     This single fix is also consumed by the manual vertical-models seed.
 */
export const VERIFIED = '2026-10-29';
export const OPENAI_MODELS_SOURCE = 'https://platform.openai.com/docs/models';
export const KIMI_SOURCE = 'https://platform.moonshot.cn/docs/pricing/chat';
export const KIMI_REPLACEMENT = 'kimi-k3.1-pro';
export const GEMINI_DEPRECATIONS = 'https://ai.google.dev/gemini-api/docs/deprecations';
export const ZAI_SOURCE = 'https://docs.z.ai/guides/overview/pricing';
export const MINIMAX_SOURCE = 'https://platform.minimax.io/docs/guides/pricing';
export const STALE_CONTEXT = 128_000;

export const KIMI_K3_CONTEXT_FIX = { slug: 'kimi-k3', contextWindow: 1_048_576 } as const;
export const KIMI_K3_CONTEXT_SOURCES = [
  'https://platform.kimi.ai/docs/guide/kimi-k3-quickstart',
  'https://github.com/MoonshotAI/Kimi-K3#readme',
] as const;

export const CONTEXT_FIXES: ReadonlyArray<{ slug: string; contextWindow: number }> = [
  ...['openai-gpt-6-luna', 'openai-gpt-6-luna-batch', 'openai-gpt-6-sol', 'openai-gpt-6-sol-batch',
    'openai-gpt-6-1-sol', 'openai-gpt-6-1-sol-batch', 'gpt-6.1-terra'].map(slug => ({ slug, contextWindow: 1_050_000 })),
  ...['gpt-5', 'openai-gpt-5-batch', 'gpt-5-mini', 'openai-gpt-5-mini-batch', 'gpt-5-nano', 'openai-gpt-5-nano-batch',
    'gpt-5.6-cyber'].map(slug => ({ slug, contextWindow: 400_000 })),
  KIMI_K3_CONTEXT_FIX,
];

export const KIMI_K2_SLUGS = ['kimi-k2.6', 'kimi-k2.6-fast', 'kimi-k2.7-code', 'kimi-k2.7-code-fast', 'kimi-k2.7-code-highspeed',
  'moonshotai-kimi-k2', 'moonshotai-kimi-k2-thinking', 'moonshotai-kimi-k2-5'] as const;

export const CHINA_PLANS: ReadonlyArray<{ provider: string; slug: string }> = [
  { provider: 'anthropic', slug: 'claude-team' },
  { provider: 'anthropic', slug: 'claude-team-premium' },
  { provider: 'openai', slug: 'chatgpt-business' },
  { provider: 'openai', slug: 'chatgpt-business-premium' },
  { provider: 'openai', slug: 'chatgpt-team' },
  { provider: 'google', slug: 'google-ai-ultra-20x' },
];

export const FLASH_IMAGE = {
  slug: 'gemini-2.5-flash-image', shutdown_date: '2027-03-15', replacement_model: 'gemini-3.1-flash-lite-image',
  deprecation_source_url: GEMINI_DEPRECATIONS, deprecated_at: null,
} as const;

export const CHANNELS: ReadonlyArray<{ provider: string; slug: string; input: number; cached: number; output: number; note: string }> = [
  { provider: 'zhipu-global', slug: 'z-ai-glm-5-3-flashx', input: 0.37, cached: 0.075, output: 1.25,
    note: `Z.ai international list price for GLM-5.3-FlashX, USD per 1M tokens. Cached-input storage is limited-time free and is not stored as a price. Source: ${ZAI_SOURCE} (verified ${VERIFIED}).` },
  { provider: 'minimax-global', slug: 'minimax-minimax-m3-1-flash', input: 0.15, cached: 0.015, output: 0.6,
    note: `MiniMax international (platform.minimax.io) list price for MiniMax-M3.1-Flash, USD per 1M tokens. Source: ${MINIMAX_SOURCE} (verified ${VERIFIED}).` },
];

export interface ModelRow {
  id: number; slug: string; context_window: number | null;
  shutdown_date: string | null; deprecated_at: string | null; replacement_model: string | null; deprecation_source_url: string | null;
}
export interface PlanRow { id: number; slug: string; provider: string; access_from_china: boolean | null }
export interface LockedRow { table: 'api_channel_prices' | 'api_channel_price_variants'; id: number; is_available: boolean | null; availability_locked: boolean | null; notes: string | null }
export interface ChannelRow { id: number; slug: string; provider: string; input_price_per_1m: number | string | null; output_price_per_1m: number | string | null; cached_input_price_per_1m: number | string | null; currency: string | null; is_available: boolean | null }

export type Change = Record<string, { from: unknown; to: unknown }>;
export interface Step { table: string; target: string; id: number | null; action: 'update' | 'insert' | 'skip'; changes?: Change; reason?: string }

const num = (value: number | string | null) => value == null ? null : Number(value);
const day = (value: string | Date | null) => value == null ? null : (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

function one<T extends { slug: string }>(rows: readonly T[], slug: string, extra?: (row: T) => boolean): T | null {
  const hits = rows.filter(row => row.slug === slug && (!extra || extra(row)));
  if (hits.length > 1) throw new Error(`Duplicate rows for ${slug}; nothing written.`);
  return hits[0] ?? null;
}

export function planContext(
  models: ReadonlyArray<Pick<ModelRow, 'id' | 'slug' | 'context_window'>>,
  fixes = CONTEXT_FIXES,
): Step[] {
  return fixes.flatMap(({ slug, contextWindow }): Step[] => {
    const row = one(models, slug);
    if (!row) return [{ table: 'models', target: slug, id: null, action: 'skip', reason: 'model row not found' }];
    const current = num(row.context_window);
    if (current === contextWindow) return [];
    if (current !== null && current !== STALE_CONTEXT) {
      return [{ table: 'models', target: slug, id: row.id, action: 'skip', reason: `context_window is ${current}, not NULL/${STALE_CONTEXT}; left for review` }];
    }
    return [{ table: 'models', target: slug, id: row.id, action: 'update', changes: { context_window: { from: current, to: contextWindow } } }];
  });
}

export function planKimi(models: readonly ModelRow[]): Step[] {
  return KIMI_K2_SLUGS.flatMap((slug): Step[] => {
    const row = one(models, slug);
    if (!row) return [{ table: 'models', target: slug, id: null, action: 'skip', reason: 'model row not found' }];
    const changes: Change = {};
    if (row.deprecation_source_url == null) changes.deprecation_source_url = { from: null, to: KIMI_SOURCE };
    if (row.replacement_model == null) changes.replacement_model = { from: null, to: KIMI_REPLACEMENT };
    return Object.keys(changes).length ? [{ table: 'models', target: slug, id: row.id, action: 'update', changes }] : [];
  });
}

export function planChinaAccess(plans: readonly PlanRow[]): Step[] {
  return CHINA_PLANS.flatMap(({ provider, slug }): Step[] => {
    const row = one(plans, slug, plan => plan.provider === provider);
    if (!row) return [{ table: 'plans', target: `${provider}/${slug}`, id: null, action: 'skip', reason: 'plan row not found' }];
    return row.access_from_china === false ? []
      : [{ table: 'plans', target: `${provider}/${slug}`, id: row.id, action: 'update', changes: { access_from_china: { from: row.access_from_china, to: false } } }];
  });
}

export function planFlashImage(models: readonly ModelRow[], locked: readonly LockedRow[]): Step[] {
  const row = one(models, FLASH_IMAGE.slug);
  if (!row) return [{ table: 'models', target: FLASH_IMAGE.slug, id: null, action: 'skip', reason: 'model row not found' }];
  const changes: Change = {};
  const current = { shutdown_date: day(row.shutdown_date), replacement_model: row.replacement_model, deprecation_source_url: row.deprecation_source_url, deprecated_at: day(row.deprecated_at) };
  for (const key of ['shutdown_date', 'replacement_model', 'deprecation_source_url', 'deprecated_at'] as const) {
    if (current[key] !== FLASH_IMAGE[key]) changes[key] = { from: current[key], to: FLASH_IMAGE[key] };
  }
  const steps: Step[] = Object.keys(changes).length ? [{ table: 'models', target: FLASH_IMAGE.slug, id: row.id, action: 'update', changes }] : [];
  for (const channel of locked) {
    if (channel.is_available !== false || channel.availability_locked !== true) continue;
    if (String(channel.notes ?? '').includes(VARIABLE_ROUTER_SENTINEL)) continue;
    steps.push({ table: channel.table, target: FLASH_IMAGE.slug, id: channel.id, action: 'update',
      changes: { is_available: { from: false, to: true }, availability_locked: { from: true, to: false } } });
  }
  return steps;
}

export function planChannels(channels: readonly ChannelRow[], models: ReadonlyArray<{ id: number; slug: string }>, providers: ReadonlyArray<{ id: number; slug: string }>): Step[] {
  return CHANNELS.flatMap((want): Step[] => {
    const target = `${want.provider}/${want.slug}`;
    const model = one(models, want.slug);
    const provider = providers.find(item => item.slug === want.provider);
    if (!model || !provider) return [{ table: 'api_channel_prices', target, id: null, action: 'skip', reason: !model ? 'model row not found' : 'provider not found' }];
    const row = one(channels, want.slug, channel => channel.provider === want.provider);
    const desired = { input_price_per_1m: want.input, output_price_per_1m: want.output, cached_input_price_per_1m: want.cached, currency: 'USD', is_available: true };
    if (!row) return [{ table: 'api_channel_prices', target, id: null, action: 'insert', changes: Object.fromEntries(Object.entries(desired).map(([k, v]) => [k, { from: null, to: v }])) }];
    const current = { input_price_per_1m: num(row.input_price_per_1m), output_price_per_1m: num(row.output_price_per_1m), cached_input_price_per_1m: num(row.cached_input_price_per_1m), currency: row.currency, is_available: row.is_available };
    const changes: Change = {};
    for (const [key, to] of Object.entries(desired)) {
      const from = current[key as keyof typeof current];
      if (from !== to) changes[key] = { from, to };
    }
    return Object.keys(changes).length ? [{ table: 'api_channel_prices', target, id: row.id, action: 'update', changes }] : [];
  });
}

export function catalog20261029SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-10-29.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Caller owns a serializable transaction (READ ONLY for dry-run). */
export async function seedCatalog20261029(tx: Sql, apply = false): Promise<Step[]> {
  const modelSlugs = [...new Set([...CONTEXT_FIXES.map(item => item.slug), ...KIMI_K2_SLUGS, FLASH_IMAGE.slug, ...CHANNELS.map(item => item.slug)])];
  const models = await tx<ModelRow[]>`SELECT id, slug, context_window, shutdown_date::text AS shutdown_date, deprecated_at::text AS deprecated_at,
    replacement_model, deprecation_source_url FROM models WHERE slug IN ${tx(modelSlugs)}`;
  const plans = await tx<PlanRow[]>`SELECT p.id, p.slug, pr.slug AS provider, p.access_from_china FROM plans p JOIN providers pr ON pr.id = p.provider_id
    WHERE p.slug IN ${tx(CHINA_PLANS.map(item => item.slug))}`;
  const flash = models.filter(model => model.slug === FLASH_IMAGE.slug);
  const locked: LockedRow[] = [];
  if (flash.length === 1) {
    const ids = [flash[0].id];
    locked.push(...(await tx<LockedRow[]>`SELECT 'api_channel_prices' AS "table", id, is_available, availability_locked, notes FROM api_channel_prices WHERE model_id IN ${tx(ids)} ORDER BY id`));
    locked.push(...(await tx<LockedRow[]>`SELECT 'api_channel_price_variants' AS "table", id, is_available, availability_locked, notes FROM api_channel_price_variants WHERE model_id IN ${tx(ids)} ORDER BY id`));
  }
  const providers = await tx<Array<{ id: number; slug: string }>>`SELECT id, slug FROM providers WHERE slug IN ${tx(CHANNELS.map(item => item.provider))}`;
  const channels = await tx<ChannelRow[]>`SELECT c.id, m.slug, pr.slug AS provider, c.input_price_per_1m, c.output_price_per_1m, c.cached_input_price_per_1m, c.currency, c.is_available
    FROM api_channel_prices c JOIN models m ON m.id = c.model_id JOIN providers pr ON pr.id = c.provider_id
    WHERE m.slug IN ${tx(CHANNELS.map(item => item.slug))} AND pr.slug IN ${tx(CHANNELS.map(item => item.provider))}`;

  const steps = [...planContext(models), ...planKimi(models), ...planChinaAccess(plans), ...planFlashImage(models, locked), ...planChannels(channels, models, providers)];
  if (!apply) return steps;
  const now = new Date();
  for (const step of steps) {
    if (step.action === 'skip' || !step.changes) continue;
    const values = Object.fromEntries(Object.entries(step.changes).map(([key, change]) => [key, change.to]));
    if (step.table === 'models') {
      await tx`UPDATE models SET ${tx(values)}, updated_at = ${now} WHERE id = ${step.id!}`;
    } else if (step.table === 'plans') {
      await tx`UPDATE plans SET ${tx(values)}, updated_at = ${now} WHERE id = ${step.id!}`;
    } else if (step.table === 'api_channel_price_variants') {
      await tx`UPDATE api_channel_price_variants SET ${tx(values)}, updated_at = ${now} WHERE id = ${step.id!}`;
    } else if (step.action === 'update' && step.target === FLASH_IMAGE.slug) {
      await tx`UPDATE api_channel_prices SET ${tx(values)}, updated_at = ${now} WHERE id = ${step.id!}`;
    } else {
      const want = CHANNELS.find(item => `${item.provider}/${item.slug}` === step.target)!;
      const extra = { price_unit: 'per_1m_tokens', notes: want.note, last_verified: new Date(`${VERIFIED}T00:00:00Z`), updated_at: now };
      if (step.action === 'insert') {
        const model = models.find(item => item.slug === want.slug)!;
        const provider = providers.find(item => item.slug === want.provider)!;
        await tx`INSERT INTO api_channel_prices ${tx({ model_id: model.id, provider_id: provider.id, ...values, ...extra })}`;
      } else {
        await tx`UPDATE api_channel_prices SET ${tx({ ...values, ...extra })} WHERE id = ${step.id!}`;
      }
    }
  }
  return steps;
}
