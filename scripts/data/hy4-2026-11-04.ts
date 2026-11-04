import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Tencent Hy4 (GA) — OpenRouter tencent/hy4, released 2026-11-04. Verified 2026-11-04 on
 * https://openrouter.ai/tencent/hy4 (single provider: Tencent Cloud):
 *   - list price per 1M tokens: input $0.834 / output $2.501 / cache read $0.042
 *   - shown "50% off": input $0.417 / output $1.251 / cache read $0.021; no end date on the page
 *   - context 1,048,576; max completion 65,536; input text + image, output text;
 *     tools / tool_choice, structured outputs (response_format JSON schema), reasoning parameter
 * Tencent Cloud's international price page (tencentcloud.com/zh/document/product/1300/78937) lists
 * only Hy4 Preview, so no official direct-channel price is written.
 *
 * Discount convention (as vercel-mercury-3-2026-10-20): no published end date, so the channel
 * carries the price buyers pay now, promo_ends_at and regular_* stay NULL (the UI only marks a
 * limited-time offer when promo_ends_at is set, and upsertChannelPrice nulls regular_* without
 * one), and the list price lives in notes.
 *
 * The slug is OpenRouter's generated slug (generateOpenRouterSlug('tencent/hy4') = 'tencent-hy4'):
 * scrapers never create models, so the nightly OpenRouter scrape attaches to this row by exact slug.
 */
export const HY4_SLUG = 'tencent-hy4';
export const HY4_PREVIEW_SLUG = 'tencent-hy4-preview';
export const HY4_OPENROUTER_ID = 'tencent/hy4';
export const HY4_SOURCE = 'https://openrouter.ai/tencent/hy4';
export const HY4_TENCENT_CLOUD_PRICES = 'https://www.tencentcloud.com/zh/document/product/1300/78937';
export const HY4_VERIFIED_AT = new Date('2026-11-04T00:00:00Z');
export const HY4_LIST = { input: 0.834, output: 2.501, cache: 0.042 } as const;
export const HY4_CURRENT = { input: 0.417, output: 1.251, cache: 0.021 } as const;

export const HY4_CHANNEL_NOTES = [
  `OpenRouter ${HY4_OPENROUTER_ID}, one upstream provider (Tencent Cloud).`,
  `Current price 50% off: input $${HY4_CURRENT.input} / output $${HY4_CURRENT.output} / cache read $${HY4_CURRENT.cache} per 1M tokens.`,
  `List price $${HY4_LIST.input} / $${HY4_LIST.output} / $${HY4_LIST.cache} per 1M. No end date published; promo_ends_at left empty.`,
  `Tencent Cloud international pricing lists only Hy4 Preview (${HY4_TENCENT_CLOUD_PRICES}); no official direct price recorded.`,
  `Source: ${HY4_SOURCE} (verified 2026-11-04).`,
].join('\n');

export function hy4SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-hy4-2026-11-04.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

export function hy4ModelRow(tencentId: number, existingProviderIds: unknown) {
  const ids = Array.isArray(existingProviderIds) ? existingProviderIds as number[] : [];
  return {
    name: 'Hy4', slug: HY4_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...ids, tencentId])],
    context_window: 1_048_576, max_output_tokens: 65_536,
    input_modalities: ['text', 'image'], output_modalities: ['text'],
    capabilities: ['reasoning', 'tool-calling', 'structured-outputs', 'vision'],
    pricing_unit: 'per_1m_tokens',
    released_at: HY4_VERIFIED_AT,
    offical_link: HY4_SOURCE,
    description: `Tencent Hy4, the official release after Hy4 Preview (${HY4_PREVIEW_SLUG}): stronger agentic and long-horizon productivity performance, and the first Hy4 with visual understanding (text and image input, text output). 1,048,576-token context, up to 65,536 completion tokens; tool calling and structured outputs. Source: ${HY4_SOURCE} (released 2026-11-04).`,
  };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'models' | 'api_channel_prices';
export interface Hy4Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

const same = (a: unknown, b: unknown) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-9;

/** Caller owns a serializable transaction (READ ONLY for preview). Never creates providers. */
export async function seedHy4(tx: Sql, apply = false): Promise<Hy4Step[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const tencent = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = 'tencent'`, 'providers/tencent');
  if (!tencent) throw new Error('Missing provider tencent; nothing written.');
  const openrouter = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = 'openrouter'`, 'providers/openrouter');
  if (!openrouter) throw new Error('Missing provider openrouter; nothing written.');
  if (openrouter.type != null && openrouter.type !== 'aggregator') throw new Error('Expected OpenRouter aggregator provider; nothing written.');
  // Refuse alternate identities rather than creating a second Hy4 row.
  const models = await tx<Row[]>`SELECT * FROM models WHERE lower(slug) IN ${tx([HY4_SLUG, 'hy4', 'tencent-hy-4', 'hunyuan-hy4'])}`;
  if (models.length > 1 || (models[0] && models[0].slug !== HY4_SLUG)) throw new Error('Ambiguous/noncanonical Hy4 model slug; nothing written.');
  const existingModel = models[0] ?? null;
  const existingChannel = existingModel ? one(await tx<Row[]>`
    SELECT * FROM api_channel_prices WHERE model_id = ${existingModel.id} AND provider_id = ${openrouter.id}`, 'api_channel_prices/hy4/openrouter') : null;

  const steps: Hy4Step[] = [];
  const pending: Array<{ table: Table; existing: Row | null; values: Record<string, unknown> }> = [];
  const save = (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values });
  };
  save('models', existingModel, hy4ModelRow(tencent.id, existingModel?.provider_ids), HY4_SLUG);
  // A later scrape at the same prices is fresher than this seed: leave it alone.
  const scraperFresh = existingChannel != null && existingChannel.last_verified != null
    && new Date(existingChannel.last_verified as string).getTime() > HY4_VERIFIED_AT.getTime()
    && same(existingChannel.input_price_per_1m, HY4_CURRENT.input) && same(existingChannel.output_price_per_1m, HY4_CURRENT.output);
  if (!scraperFresh) save('api_channel_prices', existingChannel, {
    model_id: existingModel?.id ?? -1, provider_id: openrouter.id, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    input_price_per_1m: HY4_CURRENT.input, output_price_per_1m: HY4_CURRENT.output, cached_input_price_per_1m: HY4_CURRENT.cache,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    last_verified: HY4_VERIFIED_AT, notes: HY4_CHANNEL_NOTES,
  }, `openrouter/${HY4_SLUG}`);

  if (apply) {
    let modelId = existingModel?.id ?? null;
    for (const { table, existing, values } of pending) {
      const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
      if (table === 'api_channel_prices') {
        if (modelId == null) throw new Error('Model insert did not return an ID.');
        payload.model_id = modelId;
      }
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        if (table === 'models') modelId = inserted.id;
      }
    }
  }
  return steps;
}
