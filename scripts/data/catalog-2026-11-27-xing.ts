import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { keepUnavailableForSeed } from '../utils/manual-unavailable';

/** Ordinary text LLM catalog seed, manual only. Caller owns the serializable
 * transaction; the CLI uses runRehearsable and rolls back unless --apply.
 * Validate the complete diff before writing. No deletes or vertical-catalog rows. */
export const VERIFIED = '2026-11-27';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const MODEL_ID = 'Xing/Xing4.1-Preview';
export const MODEL_SLUG = 'xing-xing4-1-preview';
export const VENDOR_SLUG = 'xing';
// Existing Model Studio offering channel; do not create a second Bailian provider.
export const CHANNEL_SLUG = 'qwen';
export const LOOKUP_SLUGS = [MODEL_SLUG, MODEL_ID, 'xing/xing4.1-preview', 'xing4.1-preview', 'xing4-1-preview'] as const;
export const MODEL_PAGE = 'https://help.aliyun.com/zh/model-studio/xing-4-1-preview-by-xing.md';
export const PRICING_PAGE = 'https://help.aliyun.com/zh/model-studio/model-pricing.md';
export const NEWLY_RELEASED_PAGE = 'https://help.aliyun.com/zh/model-studio/newly-released-models.md';
/** A listing date only, with no official release clock. Not written to a timestamp column. */
export const LISTED_ON = '2026-11-23';
export const REGION = 'cn-beijing';
export const PRICES_CNY = { input: 1.5, output: 6, cacheHit: 0.03 } as const;
export const PRICING_UNIT = 'per_1m_tokens';
export const CONTEXT = 1_048_576;
export const MAX_INPUT = 917_504;
export const MAX_OUTPUT = 131_072;
export const MAX_THINKING_CHAIN = 131_072;
export const CAPABILITIES = ['reasoning', 'tool-calling', 'structured-outputs', 'context-caching'] as const;

export const MODEL_FACTS = [
  `${MODEL_ID} is a Preview text LLM with inference supplied by 星辰大模型 (Xing), offered via 百炼 Model Studio. Text input and Text output only.`,
  '285B total parameters / 17B active; trained on the domestic Ascend compute ecosystem, for enterprise knowledge bases, document processing and data analysis.',
  `Context ${CONTEXT}; max input ${MAX_INPUT}; max output ${MAX_OUTPUT}; thinking-mode input/output have the same maxima; max thinking-chain length ${MAX_THINKING_CHAIN}.`,
  'Function Calling, structured output and context caching are supported. Batch inference, web search, prefix continuation, fine-tuning and model playground are unsupported.',
  `Listed on ${LISTED_ON} in the newly-released page; no precise release timestamp is published. This is a separate vendor/model identity from TeleAI Xing4.0.`,
  `Verified ${VERIFIED}. Sources: ${MODEL_PAGE} ; ${NEWLY_RELEASED_PAGE}`,
].join('\n');

export const CHANNEL_NOTES = [
  `百炼 Model Studio official list price for API id ${MODEL_ID}, 华北2（北京） only (${REGION}), CNY per million tokens: input 1.5 元; output 6 元 (思维链和回答); input cache hit 0.03 元.`,
  'Free quota: 无. The pricing table has only the Beijing tab and omits cache prices; the cache-hit rate is from the model page. No explicit-cache-create rate is published.',
  'Batch inference: 不支持; no Batch list price. No other-region or USD list prices are recorded.',
  'Beijing rate limits: RPM 300; TPM 1,000,000. No promotion or separate regular prices are recorded.',
  `Verified ${VERIFIED}. Sources: ${PRICING_PAGE} ; ${MODEL_PAGE}`,
].join('\n');

export const SEED_TABLES = ['providers', 'models', 'api_channel_prices'] as const;
/** Production-shaped expectation, NOT a measured production dry-run:
 * qwen exists, xing and this model/channel do not. If xing exists, provider
 * inserts are 0. No usage or variant rows are needed for this flat token price. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 1, update: 0 },
  api_channel_prices: { insert: 1, update: 0 },
} as const;

export function xingSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run', '--db'].includes(arg)) ||
      (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-27-xing.ts [--dry-run | --apply] [--db]');
  }
  return { apply: args.includes('--apply'), db: args.includes('--db') || args.includes('--apply') };
}

type Row = Record<string, unknown> & {
  id: number;
  is_available?: boolean | null;
  availability_locked?: boolean | null;
  notes?: string | null;
};
type Table = typeof SEED_TABLES[number];
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

export function seedStepCounts(steps: Step[]) {
  const counts = Object.fromEntries(SEED_TABLES.map(table => [table, { insert: 0, update: 0 }])) as Record<Table, { insert: number; update: number }>;
  for (const step of steps) counts[step.table][step.action]++;
  return counts;
}

export async function seedXing1127(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (message: string): never => { throw new Error(`${message}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target}`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([VENDOR_SLUG, CHANNEL_SLUG])}`;
  const vendor = one(providers.filter(row => row.slug === VENDOR_SLUG), `providers/${VENDOR_SLUG}`);
  const channel = one(providers.filter(row => row.slug === CHANNEL_SLUG), `providers/${CHANNEL_SLUG}`, true)!;
  if (vendor && (!['official', 'producer'].includes(String(vendor.type)) ||
      !['Xing', '星辰大模型'].includes(String(vendor.name)))) fail('Unexpected Xing vendor identity');
  if (!['official', 'producer', 'cloud'].includes(String(channel.type))) fail('Unexpected Model Studio channel type');
  const matches = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...LOOKUP_SLUGS])}`;
  if (matches.some(row => row.slug !== MODEL_SLUG)) fail(`Non-canonical row for ${MODEL_SLUG} exists`);
  const existing = one(matches, `models/${MODEL_SLUG}`);
  const providerIds = (existing?.provider_ids ?? []) as number[];
  if (providerIds.some(id => id !== vendor?.id)) fail('Unexpected model vendor ownership');
  if (existing && ((existing.type != null && existing.type !== 'llm') ||
      (existing.model_category != null && existing.model_category !== 'text'))) fail('Unexpected model taxonomy');
  const price = existing ? one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${existing.id} AND provider_id = ${channel.id}`,
    `api_channel_prices/${CHANNEL_SLUG}/${MODEL_SLUG}`) : null;

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, old: Row | null, values: Record<string, unknown>, target: string): Row => {
    const changes = seedChanges(old, values);
    if (!Object.keys(changes).length) return old!;
    const id = old?.id ?? previewId--;
    steps.push({ table, target, action: old ? 'update' : 'insert', changes });
    pending.push({ table, existing: old, values, id });
    return { ...old, ...values, id };
  };
  const owner = vendor ?? save('providers', null, {
    slug: VENDOR_SLUG, name: '星辰大模型', type: 'producer', currency: 'CNY',
    website: null, pricing_url: null, api_docs_url: null, region: null,
    access_from_china: null, supported_regions: null, regions_source_url: null, regions_verified_at: null,
    notes: `Inference supplier for ${MODEL_ID}: 星辰大模型 (Xing). Model Studio is the offering channel; no standalone vendor pricing or country list is asserted. Verified ${VERIFIED}. Source: ${MODEL_PAGE}`,
  }, VENDOR_SLUG);
  const description = String(existing?.description ?? '');
  const model = save('models', existing, {
    slug: MODEL_SLUG, name: MODEL_ID, type: 'llm', model_category: 'text',
    provider_ids: [...new Set([...providerIds, owner.id])],
    parameters: '285B', 'active parameters': '17B', context_window: CONTEXT, max_output_tokens: MAX_OUTPUT,
    input_type: ['text'], output_type: ['text'], input_modalities: ['text'], output_modalities: ['text'],
    ...modelCapabilities(existing, CAPABILITIES), pricing_unit: PRICING_UNIT,
    ...(existing?.offical_link ? {} : { offical_link: MODEL_PAGE }),
    description: description.includes(MODEL_FACTS) ? description : [description, MODEL_FACTS].filter(Boolean).join('\n'),
  }, MODEL_SLUG);
  // Never replace a later scrape's channel prices or verification evidence.
  if (!price?.last_verified || new Date(String(price.last_verified)).getTime() <= VERIFIED_AT.getTime()) {
    save('api_channel_prices', price, keepUnavailableForSeed({
      model_id: model.id, provider_id: channel.id, currency: 'CNY', price_unit: PRICING_UNIT,
      input_price_per_1m: PRICES_CNY.input, output_price_per_1m: PRICES_CNY.output,
      cached_input_price_per_1m: PRICES_CNY.cacheHit, rate_limit: 300,
      promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null,
      regular_cached_input_price_per_1m: null, is_available: true, last_verified: VERIFIED_AT,
      notes: CHANNEL_NOTES,
    }, price), `${CHANNEL_SLUG}/${MODEL_SLUG}/${REGION}`);
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id']) if (key in payload) payload[key] = resolveId(payload[key]);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolveId);
      if (operation.existing) await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(operation.id, inserted.id);
      }
    }
  }
  return steps;
}
