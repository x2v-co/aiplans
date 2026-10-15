import type { Sql } from 'postgres';
import { DEEPSEEK_MODELS, DEEPSEEK_PEAK_SCHEDULE, DEEPSEEK_SOURCE, scaleDeepSeekRate } from '../../src/lib/deepseek-pricing';
import { seedChanges } from './gemini-4-argon';

export function deepseekSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-deepseek-windows.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'api_channel_price_variants';

/** Caller supplies a serializable transaction. Preview executes SELECT only. */
export async function seedDeepSeekWindows(tx: Sql, apply = false) {
  const rows: Record<Table, Row[]> = {
    providers: await tx<Row[]>`SELECT * FROM providers WHERE slug = 'deepseek'`,
    models: await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(DEEPSEEK_MODELS.map(model => model.slug))}`,
    api_channel_prices: [], api_channel_price_variants: [],
  };
  const one = (candidates: Row[]) => {
    if (candidates.length > 1) throw new Error('Ambiguous DeepSeek seed identity; review duplicates before retrying.');
    return candidates[0] ?? null;
  };
  const existingProvider = one(rows.providers);
  if (existingProvider) {
    for (const table of ['api_channel_prices', 'api_channel_price_variants'] as const) {
      rows[table] = await tx<Row[]>`SELECT * FROM ${tx(table)} WHERE provider_id = ${existingProvider.id}`;
    }
  }
  const steps: Array<{ table: Table; target: string; changes: ReturnType<typeof seedChanges> }> = [];
  let previewId = -1;
  async function save(table: Table, existing: Row | null, values: Record<string, unknown>, target: string) {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, changes });
    const payload = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    const row = { ...existing, ...payload, id };
    if (existing) Object.assign(existing, row);
    else rows[table].push(row);
    return row;
  }
  const provider = existingProvider ?? await save('providers', null, {
    name: 'DeepSeek', slug: 'deepseek', type: 'official', currency: 'USD', pricing_url: DEEPSEEK_SOURCE,
  }, 'deepseek');
  for (const model of DEEPSEEK_MODELS) {
    const existing = one(rows.models.filter(row => row.slug === model.slug));
    const product = await save('models', existing, {
      ...(!existing ? { slug: model.slug, type: 'llm', model_category: 'text', provider_ids: [provider.id] } : {}),
      name: model.name, context_window: 1_000_000, max_output_tokens: 384_000,
    }, model.slug);
    const common = { model_id: product.id, provider_id: provider.id, currency: 'USD', price_unit: 'per_1m_tokens',
      is_available: true, last_verified: new Date('2026-10-15T00:00:00Z'),
      notes: `API ID: ${model.apiId}. Peak list price; off-peak = 50%. Peak: ${DEEPSEEK_PEAK_SCHEDULE}. All other times off-peak. Source: ${DEEPSEEK_SOURCE}` };
    const values = (rate: typeof model.peak | ReturnType<typeof scaleDeepSeekRate>) => ({
      input_price_per_1m: rate.input, output_price_per_1m: rate.output, cached_input_price_per_1m: rate.cache,
    });
    await save('api_channel_prices', one(rows.api_channel_prices.filter(row => row.model_id === product.id)), {
      ...common, ...values(model.peak), promo_ends_at: null, regular_input_price_per_1m: null,
      regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    }, model.slug);
    // Clear an older headline before setting peak (one-headline partial unique index).
    for (const row of rows.api_channel_price_variants.filter(row => row.model_id === product.id && row.is_headline && row.variant_key !== 'peak')) {
      await save('api_channel_price_variants', row, { is_headline: false }, `${model.slug}/${row.variant_key}`);
    }
    for (const window of ['peak', 'off-peak'] as const) {
      const variant = one(rows.api_channel_price_variants.filter(row => row.model_id === product.id && row.variant_key === window));
      await save('api_channel_price_variants', variant, {
        ...common, ...values(scaleDeepSeekRate(model.peak, window === 'peak' ? 1 : 0.5)),
        variant_key: window, variant_name: window === 'peak' ? 'Peak' : 'Off-peak', variant_kind: 'time_window',
        is_headline: window === 'peak', is_public: true, source_url: DEEPSEEK_SOURCE,
        constraints_json: { time_window: window, peak_schedule: DEEPSEEK_PEAK_SCHEDULE },
      }, `${model.slug}/${window}`);
    }
  }
  return steps;
}
