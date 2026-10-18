import type { Sql } from 'postgres';
import { DEEPSEEK_CN_SOURCE, DEEPSEEK_FLASH_CNY_PEAK, DEEPSEEK_PEAK_SCHEDULE, scaleDeepSeekRate } from '../../src/lib/deepseek-pricing';
import { seedChanges } from './gemini-4-argon';

/**
 * /models/deepseek-v4.1-flash showed "Official Price: N/A" because that model row only had
 * OpenCode/aggregator channels; DeepSeek's own channel lives on the legacy slug deepseek-v4-flash
 * (the scraper maps deepseek-flash there). This adds DeepSeek's official CNY list price to the
 * deepseek-v4.1-flash row. Prices: 北京时间工作日 9-12、14-18 高峰 ¥2 / ¥8 / 缓存命中 ¥0.04 per 1M;
 * other times half. Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing (checked 2026-10-18).
 */
export const V41_FLASH_SLUG = 'deepseek-v4.1-flash';
export const V41_FLASH_VERIFIED_AT = new Date('2026-10-18T00:00:00Z');
export const V41_FLASH_NOTE = `API ID: deepseek-flash (model version DeepSeek-V4.1-Flash-1017; legacy deepseek-v4-flash is served by it). Official CNY peak list price; off-peak = 50%. Peak: ${DEEPSEEK_PEAK_SCHEDULE}. Source: ${DEEPSEEK_CN_SOURCE} (checked 2026-10-18).`;

export function v41FlashSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-deepseek-v41-flash-cny-2026-10-18.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'api_channel_prices' | 'api_channel_price_variants';

/** Caller owns a serializable transaction. Throws (nothing written) unless provider and model are unique. */
export async function seedV41FlashCny(tx: Sql, apply = false) {
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug = 'deepseek'`;
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug = ${V41_FLASH_SLUG}`;
  if (providers.length !== 1 || models.length !== 1) {
    throw new Error(`Expected one deepseek provider and one ${V41_FLASH_SLUG} model, found ${providers.length}/${models.length}; nothing written.`);
  }
  const [provider] = providers; const [model] = models;
  const existing: Record<Table, Row[]> = {
    api_channel_prices: await tx<Row[]>`SELECT * FROM api_channel_prices WHERE provider_id = ${provider.id} AND model_id = ${model.id}`,
    api_channel_price_variants: await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE provider_id = ${provider.id} AND model_id = ${model.id}`,
  };
  if (existing.api_channel_prices.length > 1) throw new Error('Duplicate DeepSeek channel rows on deepseek-v4.1-flash; nothing written.');
  const steps: Array<{ table: Table; target: string; changes: ReturnType<typeof seedChanges> }> = [];
  async function save(table: Table, row: Row | undefined, values: Record<string, unknown>, target: string) {
    const changes = seedChanges(row ?? null, values);
    if (!Object.keys(changes).length) return;
    steps.push({ table, target, changes });
    if (!apply) return;
    const payload = { ...values, updated_at: new Date() };
    if (row) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${row.id}`;
    else await tx`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
  }
  const rate = (r: { input: number; output: number; cache: number | null | undefined }) => ({
    input_price_per_1m: r.input, output_price_per_1m: r.output, cached_input_price_per_1m: r.cache ?? null });
  const common = { model_id: model.id, provider_id: provider.id, currency: 'CNY', price_unit: 'per_1m_tokens',
    is_available: true, last_verified: V41_FLASH_VERIFIED_AT, notes: V41_FLASH_NOTE };
  await save('api_channel_prices', existing.api_channel_prices[0], {
    ...common, ...rate(DEEPSEEK_FLASH_CNY_PEAK), promo_ends_at: null,
    regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
  }, `deepseek/${V41_FLASH_SLUG}`);
  for (const row of existing.api_channel_price_variants.filter(v => v.is_headline && v.variant_key !== 'peak')) {
    await save('api_channel_price_variants', row, { is_headline: false }, `deepseek/${V41_FLASH_SLUG}/${row.variant_key}`);
  }
  for (const window of ['peak', 'off-peak'] as const) {
    await save('api_channel_price_variants', existing.api_channel_price_variants.find(v => v.variant_key === window), {
      ...common, ...rate(scaleDeepSeekRate(DEEPSEEK_FLASH_CNY_PEAK, window === 'peak' ? 1 : 0.5)),
      variant_key: window, variant_name: window === 'peak' ? 'Peak' : 'Off-peak', variant_kind: 'time_window',
      is_headline: window === 'peak', is_public: true, source_url: DEEPSEEK_CN_SOURCE,
      constraints_json: { time_window: window, peak_schedule: DEEPSEEK_PEAK_SCHEDULE },
    }, `deepseek/${V41_FLASH_SLUG}/${window}`);
  }
  return steps;
}
