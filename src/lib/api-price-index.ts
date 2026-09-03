import { sql } from '@/lib/db';
import type { CurrencyCode } from '@/lib/currency';
import { convertToUSD } from '@/lib/currency-conversion';
import { isPrimaryModelVariant } from '@/lib/model-freshness';
import { formatModelName } from '@/lib/model-names';

type CurrentPriceRow = {
  model_id: number;
  model_name: string;
  model_slug: string;
  provider_name: string;
  provider_slug: string;
  input_price: number;
  output_price: number | null;
  currency: string | null;
};

type ChangeRow = {
  model_name: string;
  model_slug: string;
  provider_name: string;
  provider_slug: string;
  old_input_price: number | null;
  new_input_price: number | null;
  old_output_price: number | null;
  new_output_price: number | null;
  change_percent: number | null;
  currency: string | null;
  recorded_at: Date | string;
};

export type PriceIndexSnapshot = {
  modelCount: number;
  channelCount: number;
  providerCount: number;
  verifiedAt: Date | string | null;
  cheapestPaidModels: Array<{
    modelName: string;
    modelSlug: string;
    providerName: string;
    providerSlug: string;
    inputPrice: number;
    outputPrice: number | null;
    currency: CurrencyCode;
    inputUsd: number;
  }>;
  recentChanges: Array<{
    modelName: string;
    modelSlug: string;
    providerName: string;
    providerSlug: string;
    oldInputPrice: number | null;
    newInputPrice: number | null;
    oldOutputPrice: number | null;
    newOutputPrice: number | null;
    changePercent: number | null;
    currency: CurrencyCode;
    recordedAt: Date | string;
  }>;
};

export async function getPriceIndexSnapshot(): Promise<PriceIndexSnapshot> {
  const [statsRows, currentPrices, changes] = await Promise.all([
    sql<Array<{
      model_count: number;
      channel_count: number;
      provider_count: number;
      verified_at: Date | string | null;
    }>>`
      SELECT count(DISTINCT m.id)::int AS model_count,
             count(cp.id)::int AS channel_count,
             count(DISTINCT cp.provider_id)::int AS provider_count,
             max(cp.last_verified) AS verified_at
      FROM models m
      JOIN api_channel_prices cp ON cp.model_id = m.id
      WHERE m.type ILIKE '%llm%' AND cp.is_available = true
    `,
    sql<CurrentPriceRow[]>`
      SELECT m.id AS model_id, m.name AS model_name, m.slug AS model_slug,
             p.name AS provider_name, p.slug AS provider_slug,
             cp.input_price_per_1m AS input_price,
             cp.output_price_per_1m AS output_price, cp.currency
      FROM models m
      JOIN api_channel_prices cp ON cp.model_id = m.id AND cp.is_available = true
      JOIN providers p ON p.id = cp.provider_id
      WHERE m.type ILIKE '%llm%' AND cp.input_price_per_1m > 0
    `,
    sql<ChangeRow[]>`
      SELECT m.name AS model_name, m.slug AS model_slug,
             p.name AS provider_name, p.slug AS provider_slug,
             ph.old_input_price, ph.new_input_price,
             ph.old_output_price, ph.new_output_price,
             ph.change_percent, ph.currency, ph.recorded_at
      FROM price_history ph
      JOIN api_channel_prices cp ON cp.id = ph.channel_price_id
      JOIN models m ON m.id = cp.model_id
      JOIN providers p ON p.id = cp.provider_id
      WHERE m.type ILIKE '%llm%'
      ORDER BY ph.recorded_at DESC
      LIMIT 12
    `,
  ]);

  const cheapestByModel = new Map<number, CurrentPriceRow & { inputUsd: number }>();
  for (const row of currentPrices) {
    if (!isPrimaryModelVariant(row.model_slug)) continue;
    const currency = (row.currency || 'USD') as CurrencyCode;
    const inputUsd = convertToUSD(Number(row.input_price), currency);
    const current = cheapestByModel.get(row.model_id);
    if (!current || inputUsd < current.inputUsd) {
      cheapestByModel.set(row.model_id, { ...row, inputUsd });
    }
  }

  const stats = statsRows[0];
  return {
    modelCount: stats?.model_count ?? 0,
    channelCount: stats?.channel_count ?? 0,
    providerCount: stats?.provider_count ?? 0,
    verifiedAt: stats?.verified_at ?? null,
    cheapestPaidModels: [...cheapestByModel.values()]
      .sort((left, right) => left.inputUsd - right.inputUsd)
      .slice(0, 12)
      .map((row) => ({
        modelName: formatModelName(row.model_name || row.model_slug),
        modelSlug: row.model_slug,
        providerName: row.provider_name,
        providerSlug: row.provider_slug,
        inputPrice: Number(row.input_price),
        outputPrice: row.output_price == null ? null : Number(row.output_price),
        currency: (row.currency || 'USD') as CurrencyCode,
        inputUsd: row.inputUsd,
      })),
    recentChanges: changes.map((row) => ({
      modelName: formatModelName(row.model_name || row.model_slug),
      modelSlug: row.model_slug,
      providerName: row.provider_name,
      providerSlug: row.provider_slug,
      oldInputPrice: row.old_input_price == null ? null : Number(row.old_input_price),
      newInputPrice: row.new_input_price == null ? null : Number(row.new_input_price),
      oldOutputPrice: row.old_output_price == null ? null : Number(row.old_output_price),
      newOutputPrice: row.new_output_price == null ? null : Number(row.new_output_price),
      changePercent: row.change_percent == null ? null : Number(row.change_percent),
      currency: (row.currency || 'USD') as CurrencyCode,
      recordedAt: row.recorded_at,
    })),
  };
}
