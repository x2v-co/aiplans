import type { CurrencyCode, PriceUnit } from '@/lib/currency';
import { convertToUSD } from '@/lib/currency-conversion';

export interface ApiUsage {
  period: 'day' | 'month';
  requests: number;
  inputTokensPerRequest: number;
  outputTokensPerRequest: number;
  cacheHitRate: number;
  batchRate: number;
}

export interface CalculatorChannel {
  id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number | null;
  currency: CurrencyCode;
  price_unit: PriceUnit;
}

export interface CostEstimate {
  monthlyRequests: number;
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  uncachedInputCost: number;
  cachedInputCost: number;
  outputCost: number;
  batchSavings: number;
  monthlyCost: number;
  monthlyCostUsd: number;
}

const clampRate = (value: number) => Math.min(1, Math.max(0, value));
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

/** Normalise a stored token price to a per-million-token price. */
export function pricePerMillion(price: number, unit: PriceUnit): number {
  if (unit === 'per_1k_tokens') return price * 1000;
  return price;
}

/**
 * Estimate one channel's monthly bill. Batch is an explicit scenario
 * assumption: eligible tokens receive the caller-provided discount (50% in the
 * UI). Availability still needs to be confirmed with the provider.
 */
export function estimateApiCost(
  usage: ApiUsage,
  channel: CalculatorChannel,
  batchDiscount = 0.5,
): CostEstimate {
  const monthlyRequests = nonNegative(usage.requests) * (usage.period === 'day' ? 30 : 1);
  const monthlyInputTokens = monthlyRequests * nonNegative(usage.inputTokensPerRequest);
  const monthlyOutputTokens = monthlyRequests * nonNegative(usage.outputTokensPerRequest);
  const cacheHitRate = clampRate(usage.cacheHitRate);
  const batchRate = clampRate(usage.batchRate);

  const inputPrice = pricePerMillion(nonNegative(channel.input_price_per_1m), channel.price_unit);
  const outputPrice = pricePerMillion(nonNegative(channel.output_price_per_1m), channel.price_unit);
  const cachedInputPrice = channel.cached_input_price_per_1m == null
    ? inputPrice
    : pricePerMillion(nonNegative(channel.cached_input_price_per_1m), channel.price_unit);

  const cachedTokens = monthlyInputTokens * cacheHitRate;
  const uncachedTokens = monthlyInputTokens - cachedTokens;
  const uncachedInputCost = uncachedTokens * inputPrice / 1_000_000;
  const cachedInputCost = cachedTokens * cachedInputPrice / 1_000_000;
  const outputCost = monthlyOutputTokens * outputPrice / 1_000_000;
  const beforeBatch = uncachedInputCost + cachedInputCost + outputCost;
  const batchSavings = beforeBatch * batchRate * clampRate(batchDiscount);
  const monthlyCost = Math.max(0, beforeBatch - batchSavings);

  return {
    monthlyRequests,
    monthlyInputTokens,
    monthlyOutputTokens,
    uncachedInputCost,
    cachedInputCost,
    outputCost,
    batchSavings,
    monthlyCost,
    monthlyCostUsd: convertToUSD(monthlyCost, channel.currency),
  };
}
