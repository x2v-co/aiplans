import type { Sql } from 'postgres';

/**
 * 2026-10-20 Intel P0-5. The Azure OpenAI channel on openai-gpt-4 stored $2/$8
 * (cached $0.50), which is GPT-4.1 Global. Azure "Legacy Language Models" table,
 * checked 2026-10-20 (region East US, USD, per 1M tokens): GPT-4 8K $30 / $60,
 * GPT-4 32K $60 / $120. No cached-input price is listed for GPT-4.
 *
 * The Azure scraper only emits gpt-4.1 / gpt-4o / ... Global rows under their
 * own slugs and is not full-catalog, so it neither rewrites nor retires this row.
 */
export const AZURE_GPT4_SOURCE = 'https://azure.microsoft.com/en-us/pricing/details/azure-openai/';
export const AZURE_GPT4_VERIFIED = '2026-10-20';
export const AZURE_GPT4_SLUG = 'openai-gpt-4';
export const AZURE_PROVIDER_SLUG = 'azure-openai';

export const AZURE_GPT4_NOTE = `Azure OpenAI legacy GPT-4 list price (East US, USD, per 1M tokens). Displayed channel price is GPT-4 8K: $30 input / $60 output. GPT-4 32K ($60 / $120) is a separate 32K-context deployment, stored as a context_band variant. No cached-input price is published for GPT-4. The earlier $2/$8 was the GPT-4.1 Global price. Source: ${AZURE_GPT4_SOURCE} (verified ${AZURE_GPT4_VERIFIED}).`;

export interface AzureGpt4Band {
  key: string;
  name: string;
  input: number;
  output: number;
  headline: boolean;
  constraints: { context_window: number };
}

export const AZURE_GPT4_HEADLINE = { input: 30, output: 60, cached: null } as const;

export const AZURE_GPT4_BANDS: readonly AzureGpt4Band[] = [
  { key: 'context-8k', name: 'GPT-4 8K', input: 30, output: 60, headline: true, constraints: { context_window: 8_192 } },
  { key: 'context-32k', name: 'GPT-4 32K', input: 60, output: 120, headline: false, constraints: { context_window: 32_768 } },
];

export interface AzureChannel {
  id: number;
  input_price_per_1m: number | string | null;
  output_price_per_1m: number | string | null;
  cached_input_price_per_1m: number | string | null;
  currency: string | null;
  price_unit: string | null;
  notes: string | null;
}

export interface AzureVariant {
  id: number;
  variant_key: string;
  variant_name: string | null;
  variant_kind: string | null;
  input_price_per_1m: number | string | null;
  output_price_per_1m: number | string | null;
  currency: string | null;
  price_unit: string | null;
  is_headline: boolean | null;
  is_available: boolean | null;
  constraints_json: unknown;
  source_url: string | null;
  notes: string | null;
}

type Changes = Record<string, { from: unknown; to: unknown }>;

function numberSame(from: unknown, to: number | null): boolean {
  if (to == null) return from == null;
  const value = typeof from === 'number' ? from : typeof from === 'string' && from.trim() !== '' ? Number(from) : Number.NaN;
  return Number.isFinite(value) && Math.abs(value - to) < 1e-6;
}

function jsonSame(from: unknown, to: unknown): boolean {
  const stable = (value: unknown): string => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]));
    }
    return JSON.stringify(value ?? null);
  };
  return stable(from) === stable(to);
}

export interface AzureGpt4Plan {
  channel: { id: number; changes: Changes } | null;
  variantInserts: AzureGpt4Band[];
  variantUpdates: Array<{ id: number; key: string; changes: Changes }>;
}

/** Pure planner. Only touches the existing Azure channel; never creates one. */
export function planAzureGpt4(channel: AzureChannel, variants: readonly AzureVariant[]): AzureGpt4Plan {
  const changes: Changes = {};
  const h = AZURE_GPT4_HEADLINE;
  if (!numberSame(channel.input_price_per_1m, h.input)) changes.input_price_per_1m = { from: channel.input_price_per_1m, to: h.input };
  if (!numberSame(channel.output_price_per_1m, h.output)) changes.output_price_per_1m = { from: channel.output_price_per_1m, to: h.output };
  if (!numberSame(channel.cached_input_price_per_1m, h.cached)) changes.cached_input_price_per_1m = { from: channel.cached_input_price_per_1m, to: h.cached };
  if (channel.currency !== 'USD') changes.currency = { from: channel.currency, to: 'USD' };
  if (channel.price_unit !== 'per_1m_tokens') changes.price_unit = { from: channel.price_unit, to: 'per_1m_tokens' };
  if ((channel.notes ?? null) !== AZURE_GPT4_NOTE) changes.notes = { from: channel.notes, to: AZURE_GPT4_NOTE };

  const variantInserts: AzureGpt4Band[] = [];
  const variantUpdates: AzureGpt4Plan['variantUpdates'] = [];
  for (const band of AZURE_GPT4_BANDS) {
    const found = variants.filter(variant => variant.variant_key === band.key);
    if (found.length > 1) throw new Error(`Duplicate azure-openai/${AZURE_GPT4_SLUG}#${band.key}; nothing written.`);
    const row = found[0];
    if (!row) { variantInserts.push(band); continue; }
    const desired: Record<string, unknown> = {
      variant_name: band.name, variant_kind: 'context_band', currency: 'USD', price_unit: 'per_1m_tokens',
      is_headline: band.headline, is_available: true, source_url: AZURE_GPT4_SOURCE, notes: AZURE_GPT4_NOTE,
    };
    const vChanges: Changes = {};
    for (const [key, to] of Object.entries(desired)) {
      const from = row[key as keyof AzureVariant] ?? null;
      if (from !== to) vChanges[key] = { from, to };
    }
    if (!numberSame(row.input_price_per_1m, band.input)) vChanges.input_price_per_1m = { from: row.input_price_per_1m, to: band.input };
    if (!numberSame(row.output_price_per_1m, band.output)) vChanges.output_price_per_1m = { from: row.output_price_per_1m, to: band.output };
    if (!jsonSame(row.constraints_json, band.constraints)) vChanges.constraints_json = { from: row.constraints_json, to: band.constraints };
    if (Object.keys(vChanges).length) variantUpdates.push({ id: row.id, key: band.key, changes: vChanges });
  }
  return { channel: Object.keys(changes).length ? { id: channel.id, changes } : null, variantInserts, variantUpdates };
}

export function catalog20261020SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-10-20.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

export interface Catalog20261020Step { table: 'api_channel_prices' | 'api_channel_price_variants'; target: string; id: number | null; changes: Record<string, unknown> }

/** Caller owns a serializable transaction. Missing model/provider/channel is skipped; duplicates abort. */
export async function seedCatalog20261020(tx: Sql, apply = false): Promise<Catalog20261020Step[]> {
  const steps: Catalog20261020Step[] = [];
  const providers = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = ${AZURE_PROVIDER_SLUG}`;
  if (providers.length > 1) throw new Error(`Duplicate ${AZURE_PROVIDER_SLUG} provider; nothing written.`);
  const models = await tx<Array<{ id: number }>>`SELECT id FROM models WHERE slug = ${AZURE_GPT4_SLUG}`;
  if (models.length > 1) throw new Error(`Duplicate ${AZURE_GPT4_SLUG}; nothing written.`);
  if (!providers.length || !models.length) return steps;
  const providerId = providers[0].id;
  const modelId = models[0].id;
  const channels = await tx<AzureChannel[]>`
    SELECT id, input_price_per_1m, output_price_per_1m, cached_input_price_per_1m, currency, price_unit, notes
    FROM api_channel_prices WHERE provider_id = ${providerId} AND model_id = ${modelId}`;
  if (channels.length > 1) throw new Error(`Duplicate ${AZURE_PROVIDER_SLUG}/${AZURE_GPT4_SLUG} channels; nothing written.`);
  if (!channels.length) return steps;
  const variants = await tx<AzureVariant[]>`
    SELECT id, variant_key, variant_name, variant_kind, input_price_per_1m, output_price_per_1m, currency, price_unit,
      is_headline, is_available, constraints_json, source_url, notes
    FROM api_channel_price_variants WHERE provider_id = ${providerId} AND model_id = ${modelId}`;
  const plan = planAzureGpt4(channels[0], variants);
  const verified = new Date(`${AZURE_GPT4_VERIFIED}T00:00:00Z`);
  const target = `${AZURE_PROVIDER_SLUG}/${AZURE_GPT4_SLUG}`;
  if (plan.channel) {
    if (apply) {
      await tx`UPDATE api_channel_prices SET input_price_per_1m = ${AZURE_GPT4_HEADLINE.input}, output_price_per_1m = ${AZURE_GPT4_HEADLINE.output},
        cached_input_price_per_1m = NULL, currency = 'USD', price_unit = 'per_1m_tokens', notes = ${AZURE_GPT4_NOTE},
        last_verified = ${verified}, updated_at = ${new Date()} WHERE id = ${plan.channel.id}`;
    }
    steps.push({ table: 'api_channel_prices', target, id: plan.channel.id, changes: plan.channel.changes });
  }
  for (const band of plan.variantInserts) {
    let id: number | null = null;
    if (apply) {
      const inserted = await tx<Array<{ id: number }>>`
        INSERT INTO api_channel_price_variants (model_id, provider_id, variant_key, variant_name, variant_kind,
          input_price_per_1m, output_price_per_1m, currency, price_unit, is_available, is_public, is_headline,
          constraints_json, source_url, notes, last_verified, updated_at)
        VALUES (${modelId}, ${providerId}, ${band.key}, ${band.name}, 'context_band',
          ${band.input}, ${band.output}, 'USD', 'per_1m_tokens', true, true, ${band.headline},
          ${tx.json(band.constraints)}, ${AZURE_GPT4_SOURCE}, ${AZURE_GPT4_NOTE}, ${verified}, ${new Date()})
        RETURNING id`;
      id = inserted[0]?.id ?? null;
    }
    steps.push({ table: 'api_channel_price_variants', target: `${target}#${band.key}`, id, changes: { insert: band } });
  }
  for (const row of plan.variantUpdates) {
    const band = AZURE_GPT4_BANDS.find(item => item.key === row.key)!;
    if (apply) {
      await tx`UPDATE api_channel_price_variants SET variant_name = ${band.name}, variant_kind = 'context_band',
        input_price_per_1m = ${band.input}, output_price_per_1m = ${band.output}, currency = 'USD', price_unit = 'per_1m_tokens',
        is_headline = ${band.headline}, is_available = true, constraints_json = ${tx.json(band.constraints)},
        source_url = ${AZURE_GPT4_SOURCE}, notes = ${AZURE_GPT4_NOTE}, last_verified = ${verified}, updated_at = ${new Date()}
        WHERE id = ${row.id}`;
    }
    steps.push({ table: 'api_channel_price_variants', target: `${target}#${row.key}`, id: row.id, changes: row.changes });
  }
  return steps;
}
