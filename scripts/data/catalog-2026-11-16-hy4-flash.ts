import type { Sql } from 'postgres';
import { alignSeedNumeric, canonicalSeedValue, seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Independent manual seed. Caller owns the transaction; planning never writes.
 * CLI rehearses real writes then rolls back by default. No provider creation,
 * OpenRouter mapping, variants, GA changes, or global Preview retirement writes.
 */
export const FLASH_SLUG = 'tencent-hy4-flash';
export const FLASH_API_ID = 'hy4-flash';
export const PREVIEW_SLUG = 'tencent-hy4-preview';
export const INTERNATIONAL_PRICES = 'https://www.tencentcloud.com/document/product/1300/78937';
export const CHINA_PRICES = 'https://cloud.tencent.com/document/product/1823/130055';
export const CHINA_MODELS = 'https://cloud.tencent.com/document/product/1823/130051';
// End of the supplied independent verification window, not either page's local update time.
export const VERIFIED_AT = new Date('2026-11-16T09:58:00Z');
export const PROMO_ENDS_AT = new Date('2026-11-30T04:00:00Z');
export const USD_LIST = { input: 0.07, output: 0.281, cacheRead: 0.003 } as const;
export const USD_CURRENT = { input: 0.035, output: 0.1405, cacheRead: 0.0015 } as const;
export const LOOKUP_SLUGS = [
  FLASH_SLUG, FLASH_API_ID, 'tencent/hy4-flash', 'hunyuan-hy4-flash',
  'tencent-hunyuan-hy4-flash', 'tencent/hunyuan-hy4-flash', 'tencent-hy-4-flash',
] as const;

export const FLASH_FACTS = [
  `Hy4 Flash, Tencent API model ID ${FLASH_API_ID}; separate from Hy4 GA and Hy4 Preview.`,
  'China official model list: context 1M (catalogue: 1,000,000 tokens), max input 960k, max output 64k. The K convention is not unambiguous; no exact max_output_tokens is inferred from 64k.',
  'Text and image input, text output; image understanding, deep thinking, structured outputs, FunctionCalling, and cache. No video input verified.',
  'Open weights are planned, not verified released; no downloadable weights or license verified.',
  `Model specifications: ${CHINA_MODELS}. Open-weights plan: official indexed research result https://hy.tencent.ai/research/hy4-flash (page body blank during verification). Verified 2026-11-16 17:55–17:58 SGT.`,
].join('\n');

export const CHANNEL_NOTES = [
  `Tencent Cloud official international PAYG, API ${FLASH_API_ID}; Singapore, Guangzhou, and Silicon Valley tables.`,
  'USD directory/list prices per 1M tokens: input 0.07, output 0.281, cache HIT/read 0.003. Cache WRITE (5m/1h) is shown as dashes: no verified price, not free and not cache read.',
  'Only actual usage during the notice period is settled at 50% of list. Derived current USD prices: input 0.035, output 0.1405, cache read 0.0015; these are computed, not separately published numerical rates.',
  'Notice runs from publication (precise start instant unknown) until 2026-11-30 12:00:00 Beijing time (UTC+8), exactly 2026-11-30T04:00:00Z; list prices apply at/after cutoff via regular_* fields.',
  `Mainland China / Guangzhou postpaid ONLY, CNY per 1M tokens: list input 0.5, output 2, cache HIT/read 0.02; derived 50% current input 0.25, output 1, cache read 0.01 for actual usage in the same notice period, ending 2026-11-30T04:00:00Z, then list. Source: ${CHINA_PRICES}. No currency conversion.`,
  'CNY rates are scoped notes only: api_channel_price_variants has no promo/regular fields, so an expiring half-price cannot safely be stored as a permanent numeric variant. No CNY variant or duplicate currency producer is created. No cache-write price is seeded.',
  `Sources: ${INTERNATIONAL_PRICES} ; ${CHINA_PRICES}. Independently verified 2026-11-16 17:55–17:58 SGT; page-local update times have unspecified zones.`,
].join('\n');

export const PREVIEW_NOTICE = [
  'Tencent Cloud international route notice (verified 2026-11-16): the international pricing page labels Hy4 preview / hy4-preview “To Be Discontinued”, without a dated international cutoff.',
  `Separately, the mainland China model list explicitly says “Hy4 preview（2026-12-07下线）”. That mainland date is not assumed universal or assigned an exact time. This shared model, including OpenRouter, receives no global shutdown date, deprecation, replacement, availability, or price change from this route-scoped notice. Sources: ${INTERNATIONAL_PRICES} ; ${CHINA_MODELS}.`,
].join('\n');

export function appendNotice(existing: unknown, note: string): string {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : previous + (previous ? '\n\n' : '') + note;
}

export function hy4FlashSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-16-hy4-flash.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

export function flashModelRow(tencentId: number) {
  return {
    name: 'Hy4 Flash', slug: FLASH_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [tencentId], context_window: 1_000_000, max_output_tokens: null,
    input_type: ['text', 'image'], output_type: ['text'],
    input_modalities: ['text', 'image'], output_modalities: ['text'],
    capabilities: ['reasoning', 'tool-calling', 'structured-outputs', 'vision'],
    open_source: null, license: null, license_url: null,
    pricing_unit: 'per_1m_tokens', offical_link: CHINA_MODELS, description: FLASH_FACTS,
  };
}

export function flashChannelRow(modelId: number, tencentId: number) {
  return {
    model_id: modelId, provider_id: tencentId, currency: 'USD', price_unit: 'per_1m_tokens',
    input_price_per_1m: USD_CURRENT.input, output_price_per_1m: USD_CURRENT.output,
    cached_input_price_per_1m: USD_CURRENT.cacheRead,
    regular_input_price_per_1m: USD_LIST.input, regular_output_price_per_1m: USD_LIST.output,
    regular_cached_input_price_per_1m: USD_LIST.cacheRead,
    promo_ends_at: PROMO_ENDS_AT, last_verified: VERIFIED_AT, is_available: true, notes: CHANNEL_NOTES,
  };
}

type Row = Record<string, unknown> & {
  id: number;
  is_available?: boolean | null;
  availability_locked?: boolean | null;
  notes?: string | null;
};
export interface FlashStep {
  table: 'models' | 'api_channel_prices';
  target: string;
  action: 'insert' | 'update';
  changes: ReturnType<typeof seedChanges>;
}

// Only these columns use PostgreSQL real (float4). Compare at storage precision
// while retaining the exact source decimals in the planned/written payload.
const REAL_PRICE_KEYS = new Set([
  'input_price_per_1m', 'output_price_per_1m', 'cached_input_price_per_1m',
  'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m',
]);
function changesFor(existing: Row | null, desired: Record<string, unknown>) {
  const changes = seedChanges(existing, desired);
  if (existing) for (const [key, change] of Object.entries(changes)) {
    const before = canonicalSeedValue(alignSeedNumeric(change.from, change.to));
    if (REAL_PRICE_KEYS.has(key) && typeof before === 'number' && typeof change.to === 'number'
      && Number.isFinite(before) && Math.fround(before) === Math.fround(change.to)) delete changes[key];
  }
  return changes;
}

/** All identity/ownership/channel guards finish before any INSERT or UPDATE. */
export async function seedHy4Flash(tx: Sql, apply = false): Promise<FlashStep[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  // Independent normalization catches slash/case/separator aliases, even if the
  // canonical slug is absent. Name matching also catches a differently slugged duplicate.
  const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const identities = new Set<string>(LOOKUP_SLUGS.map(normalize));
  const providers = await tx<Row[]>`SELECT * FROM ${tx('providers')}`;
  const tencent = one(providers.filter(row => normalize(row.slug) === 'tencent'), 'providers/tencent', true)!;
  if (tencent.slug !== 'tencent' || !['official', 'producer'].includes(String(tencent.type))) fail('Expected official/producer providers/tencent');
  const models = await tx<Row[]>`SELECT * FROM ${tx('models')}`;
  const existing = one(models.filter(row => identities.has(normalize(row.slug)) || identities.has(normalize(row.name))), 'Hy4 Flash aliases');
  if (existing && existing.slug !== FLASH_SLUG) fail('Noncanonical Hy4 Flash alias');
  const preview = one(models.filter(row => row.slug === PREVIEW_SLUG), `models/${PREVIEW_SLUG}`, true)!;
  for (const model of [existing, preview]) {
    if (!model) continue;
    if (model.type !== 'llm' || model.model_category !== 'text') fail(`Wrong model type/category for ${model.slug}`);
    const ids = Array.isArray(model.provider_ids) ? model.provider_ids : fail(`Wrong producer ownership for ${model.slug}`);
    if (!ids.includes(tencent.id)) fail(`Wrong producer ownership for ${model.slug}`);
    for (const id of ids) {
      const provider = providers.find(row => row.id === id);
      if (!provider || (id !== tencent.id && !['aggregator', 'cloud', 'reseller'].includes(String(provider.type)))) {
        fail(`Wrong producer ownership for ${model.slug}`);
      }
    }
  }
  const channels = existing
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${existing.id} AND provider_id = ${tencent.id}`
    : [];
  const channel = one(channels, 'Hy4 Flash official USD channel');
  if (channel && (channel.currency !== 'USD' || channel.price_unit !== 'per_1m_tokens')) fail('Unexpected official Flash currency/unit');
  const verified = channel?.last_verified == null ? null
    : channel.last_verified instanceof Date ? channel.last_verified.getTime() : new Date(String(channel.last_verified)).getTime();
  if (verified !== null && !Number.isFinite(verified)) fail('Invalid official Flash last_verified');

  const steps: FlashStep[] = [];
  const pending: { table: FlashStep['table']; existing: Row | null; payload: Record<string, unknown> }[] = [];
  const save = (table: FlashStep['table'], current: Row | null, desired: Record<string, unknown>, target: string) => {
    const changes = changesFor(current, desired);
    if (!Object.keys(changes).length) return;
    steps.push({ table, target, action: current ? 'update' : 'insert', changes });
    pending.push({ table, existing: current, payload: current
      ? Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.to])) : desired });
  };
  const modelValues: Record<string, unknown> = flashModelRow(tencent.id);
  if (existing) {
    // Existing license/release/output-limit evidence and unrelated metadata are
    // not ours to replace. Keep extra capabilities and provider memberships.
    for (const key of ['provider_ids', 'open_source', 'license', 'license_url', 'max_output_tokens', 'offical_link']) delete modelValues[key];
    modelValues.capabilities = [...new Set([...(Array.isArray(existing.capabilities) ? existing.capabilities : []), ...flashModelRow(tencent.id).capabilities])];
    modelValues.description = appendNotice(existing.description, FLASH_FACTS);
  }
  save('models', existing, modelValues, FLASH_SLUG);
  // Protect the entire fresher USD row, not just matching prices or last_verified.
  if (verified === null || verified <= VERIFIED_AT.getTime()) {
    const desired = retainLockedUnavailable(flashChannelRow(existing?.id ?? -1, tencent.id), channel);
    // Availability of any existing unavailable row remains a reviewer decision.
    if (channel?.is_available === false) desired.is_available = false;
    desired.notes = appendNotice(channel?.notes, CHANNEL_NOTES);
    save('api_channel_prices', channel, desired, `tencent/${FLASH_SLUG}`);
  }
  // Exact description-only patch, including preservation of updated_at.
  save('models', preview, { description: appendNotice(preview.description, PREVIEW_NOTICE) }, PREVIEW_SLUG);

  if (apply) {
    let modelId = existing?.id ?? null;
    for (const operation of pending) {
      const payload = { ...operation.payload };
      if (operation.table === 'api_channel_prices' && 'model_id' in payload) {
        if (modelId === null) throw new Error('Flash model insert did not return an ID');
        payload.model_id = modelId;
      }
      if (operation.existing) {
        await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        if (operation.table === 'models') modelId = inserted.id;
      }
    }
  }
  return steps;
}
