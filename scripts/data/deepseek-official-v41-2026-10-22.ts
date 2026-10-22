import type { Sql } from 'postgres';
import { DEEPSEEK_PEAK_SCHEDULE, DEEPSEEK_SOURCE } from '../../src/lib/deepseek-pricing';
import { seedChanges } from './gemini-4-argon';

/**
 * /models/deepseek-v4.1-flash showed "官方 暂无官方报价" while the official USD
 * row sat on the retired deepseek-v4-flash slug. DeepSeek's API id `deepseek-flash`
 * now serves DeepSeek-V4.1-Flash-1017, so the official channel belongs on
 * deepseek-v4.1-flash (same row aggregators already use).
 *
 * Root cause: the DeepSeek scraper mapped `deepseek-flash` -> `deepseek-v4-flash`,
 * then retireUnseenChannelPrices() disabled the CNY stopgap row seeded on the
 * canonical model. Fix: scraper maps to deepseek-v4.1-flash (this change), and
 * this seed moves the live official row onto that model before the next scrape.
 *
 * The canonical row is the retired CNY row (id 15708 on 2026-10-22): it already
 * owns the peak/off-peak variant slots on the canonical model, so converting it
 * keeps one channel row + two variants, no deletes, and no unique-key conflict.
 * Verified 2026-10-22: USD peak $0.30 in / $1.20 out / $0.006 cache hit,
 * off-peak 50%, source https://api-docs.deepseek.com/quick_start/pricing
 */
export const DEEPSEEK_V41_SLUG = 'deepseek-v4.1-flash';
export const DEEPSEEK_LEGACY_SLUG = 'deepseek-v4-flash';
export const DEEPSEEK_OFFICIAL_VERIFIED_AT = new Date('2026-10-22T00:00:00Z');
export const DEEPSEEK_OFFICIAL_PEAK = { input: 0.3, output: 1.2, cache: 0.006 } as const;
export const DEEPSEEK_OFFICIAL_NOTE =
  `API ID: deepseek-flash (model version DeepSeek-V4.1-Flash-1017). USD peak list price; off-peak = 50%. Peak: ${DEEPSEEK_PEAK_SCHEDULE}. Source: ${DEEPSEEK_SOURCE} (checked 2026-10-22).`;
export const DEEPSEEK_LEGACY_SUPERSEDED_NOTE =
  'Superseded 2026-10-22: DeepSeek API id deepseek-flash is served by DeepSeek-V4.1-Flash-1017, so the official channel moved to models/deepseek-v4.1-flash. Retained for audit history; this page now tracks third-party hosts of the retired 0731 model.';

export function deepseekOfficialSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-deepseek-official-v41-2026-10-22.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'api_channel_prices' | 'api_channel_price_variants';

/** Caller owns a serializable transaction. Throws before writing on ambiguous identity. */
export async function seedDeepSeekOfficialV41(tx: Sql, apply = false) {
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'deepseek'}`;
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([DEEPSEEK_V41_SLUG, DEEPSEEK_LEGACY_SLUG])}`;
  const canonical = models.filter(row => row.slug === DEEPSEEK_V41_SLUG);
  const legacy = models.filter(row => row.slug === DEEPSEEK_LEGACY_SLUG);
  if (providers.length !== 1 || canonical.length !== 1 || legacy.length !== 1) {
    throw new Error(
      `Expected one deepseek provider and one model per slug, found provider ${providers.length}, ` +
      `${DEEPSEEK_V41_SLUG} ${canonical.length}, ${DEEPSEEK_LEGACY_SLUG} ${legacy.length}; nothing written.`,
    );
  }
  const [provider] = providers;
  const [canonicalModel] = canonical;
  const [legacyModel] = legacy;

  const rows: Record<Table, Row[]> = {
    api_channel_prices: await tx<Row[]>`SELECT * FROM api_channel_prices WHERE provider_id = ${provider.id} AND model_id IN ${tx([canonicalModel.id, legacyModel.id])}`,
    api_channel_price_variants: await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE provider_id = ${provider.id} AND model_id IN ${tx([canonicalModel.id, legacyModel.id])}`,
  };
  const onCanonical = rows.api_channel_prices.filter(row => row.model_id === canonicalModel.id);
  const onLegacy = rows.api_channel_prices.filter(row => row.model_id === legacyModel.id);
  if (onCanonical.length > 1 || onLegacy.length > 1) {
    throw new Error('Duplicate DeepSeek channel rows; review before retrying. Nothing written.');
  }
  const current = onCanonical[0];
  const source = onLegacy[0];
  const currentIsOfficial = current != null && current.currency === 'USD' &&
    current.is_available === true && current.input_price_per_1m === DEEPSEEK_OFFICIAL_PEAK.input &&
    current.output_price_per_1m === DEEPSEEK_OFFICIAL_PEAK.output;
  if (!currentIsOfficial && source == null) {
    throw new Error(
      `No DeepSeek channel row on ${DEEPSEEK_LEGACY_SLUG} to move and none usable on ${DEEPSEEK_V41_SLUG}; nothing written.`,
    );
  }

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

  const channelValues = {
    model_id: canonicalModel.id,
    provider_id: provider.id,
    currency: 'USD',
    price_unit: 'per_1m_tokens',
    input_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.input,
    output_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.output,
    cached_input_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.cache,
    is_available: true,
    availability_locked: false,
    promo_ends_at: null,
    regular_input_price_per_1m: null,
    regular_output_price_per_1m: null,
    regular_cached_input_price_per_1m: null,
    last_verified: DEEPSEEK_OFFICIAL_VERIFIED_AT,
    notes: DEEPSEEK_OFFICIAL_NOTE,
  };
  await save('api_channel_prices', current, channelValues, `deepseek/${DEEPSEEK_V41_SLUG}`);

  const canonicalVariants = rows.api_channel_price_variants.filter(row => row.model_id === canonicalModel.id);
  const variantCommon = {
    provider_id: provider.id,
    currency: 'USD',
    price_unit: 'per_1m_tokens',
    is_available: true,
    is_public: true,
    source_url: DEEPSEEK_SOURCE,
    last_verified: DEEPSEEK_OFFICIAL_VERIFIED_AT,
    notes: DEEPSEEK_OFFICIAL_NOTE,
  };
  for (const window of ['peak', 'off-peak'] as const) {
    const factor = window === 'peak' ? 1 : 0.5;
    const variant = canonicalVariants.find(row => row.variant_key === window);
    await save('api_channel_price_variants', variant, {
      ...variantCommon,
      model_id: canonicalModel.id,
      input_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.input * factor,
      output_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.output * factor,
      cached_input_price_per_1m: DEEPSEEK_OFFICIAL_PEAK.cache * factor,
      variant_key: window,
      variant_name: window === 'peak' ? 'Peak' : 'Off-peak',
      variant_kind: 'time_window',
      is_headline: window === 'peak',
      constraints_json: { time_window: window, peak_schedule: DEEPSEEK_PEAK_SCHEDULE },
    }, `deepseek/${DEEPSEEK_V41_SLUG}/${window}`);
  }

  // The retired 0731 row must not keep a second official quote on the old page.
  if (source) {
    await save('api_channel_prices', source, {
      is_available: false,
      promo_ends_at: null,
      regular_input_price_per_1m: null,
      regular_output_price_per_1m: null,
      regular_cached_input_price_per_1m: null,
      notes: DEEPSEEK_LEGACY_SUPERSEDED_NOTE,
    }, `deepseek/${DEEPSEEK_LEGACY_SLUG}`);
  }
  for (const variant of rows.api_channel_price_variants.filter(row => row.model_id === legacyModel.id)) {
    await save('api_channel_price_variants', variant, { is_available: false },
      `deepseek/${DEEPSEEK_LEGACY_SLUG}/${variant.variant_key}`);
  }

  return steps;
}
