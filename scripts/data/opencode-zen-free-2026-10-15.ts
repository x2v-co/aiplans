import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Verified 2026-10-15 against https://opencode.ai/docs/zen/ (Pricing + Free models) and
// https://x.com/opencode/status/2110635747648909472 ("DeepSeek V4.1 Flash is now free in OpenCode", 2026-10-15 15:35 SGT).
export const ZEN_SOURCE = 'https://opencode.ai/docs/zen/';
export const ZEN_ANNOUNCEMENT = 'https://x.com/opencode/status/2110635747648909472';
export const ZEN_PROVIDER_SLUG = 'opencode-zen';
export const DSV41_SLUGS = ['deepseek-v4.1-flash', 'deepseek-v4-1-flash'];
export const ZEN_ENDPOINT = 'deepseek-v4.1-flash-free';
const VERIFIED_AT = new Date('2026-10-15T00:00:00Z');
// Zen paid list price for the non-free deepseek-v4.1-flash endpoint (same docs table).
const REGULAR = { input: 0.3, output: 1.2, cached: 0.006 };
export const ZEN_FREE_NOTE = '[free] DeepSeek V4.1 Flash Free (model id deepseek-v4.1-flash-free) is free on OpenCode for a limited time. '
  + 'End date: not published. Context limit for the free endpoint: not published by OpenCode (left null). '
  + 'Provider follows zero-retention and does not train on data. Paid endpoint deepseek-v4.1-flash stays $0.30/$1.20/$0.006 per 1M.';

export function zenSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-opencode-zen-free-2026-10-15.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface ZenSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Default preview issues SELECT only. */
export async function seedOpenCodeZenFree(tx: Sql, apply = false): Promise<ZenSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const existingProvider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([ZEN_PROVIDER_SLUG])}`, `providers/${ZEN_PROVIDER_SLUG}`);
  const existingModel = one(await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(DSV41_SLUGS)}`, `models/${DSV41_SLUGS[0]}`);
  const existingChannel = one(existingModel && existingProvider
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${existingModel.id} AND provider_id = ${existingProvider.id}`
    : [], `api_channel_prices/${DSV41_SLUGS[0]}/${ZEN_PROVIDER_SLUG}`);

  const steps: ZenSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
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

  const provider = existingProvider ?? await save('providers', null, {
    name: 'OpenCode Zen', slug: ZEN_PROVIDER_SLUG, website: 'https://opencode.ai', pricing_url: ZEN_SOURCE,
    type: 'aggregator', currency: 'USD', region: null, access_from_china: null,
    notes: `OpenCode pay-as-you-go gateway (Console credits, at-cost pricing + card fees). Models hosted in US/EU. Source: ${ZEN_SOURCE}`,
  }, ZEN_PROVIDER_SLUG);
  // Reuse the catalog model (also used by OpenCode Go); never overwrite producer metadata.
  const model = existingModel ?? await save('models', null, {
    slug: DSV41_SLUGS[0], name: 'DeepSeek V4.1 Flash', type: 'llm', model_category: 'text',
    provider_ids: [], context_window: null, max_output_tokens: null, open_source: null, offical_link: ZEN_SOURCE,
    description: `Listed on OpenCode Zen; OpenCode docs state no context window. Source: ${ZEN_SOURCE}`,
  }, DSV41_SLUGS[0]);
  await save('api_channel_prices', existingChannel, {
    model_id: model.id, provider_id: provider.id,
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: 0,
    regular_input_price_per_1m: REGULAR.input, regular_output_price_per_1m: REGULAR.output,
    regular_cached_input_price_per_1m: REGULAR.cached, promo_ends_at: null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    data_for_discount: null, data_for_discount_note: null, last_verified: VERIFIED_AT,
    notes: `${ZEN_FREE_NOTE}\nSources: ${ZEN_SOURCE} ; ${ZEN_ANNOUNCEMENT}`,
  }, `${DSV41_SLUGS[0]}/${ZEN_PROVIDER_SLUG}`);
  return steps;
}
