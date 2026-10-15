import { CURRENCY_INFO, type CurrencyCode } from '../currency';
import { effectivePrice, type PriceSchedule } from '../effective-price';
import { blendedPricePerMTok, type UsageMix } from './engine';

export type PaygMix = UsageMix & { id: string };
export const PAYG_MIXES: readonly PaygMix[] = [
  { id: 'coding-high-cache', cacheReadPct: 97, inputPct: 2.5, outputPct: 0.5 },
  { id: 'chat', cacheReadPct: 0, inputPct: 75, outputPct: 25 },
];

/** Joined api_channel_prices × providers × models; no plan purchase is required. */
export type PaygChannelPrice = PriceSchedule & {
  id: number;
  provider_slug: string;
  model_slug: string;
  input_price_per_1m: number | null;
  cached_input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  currency: string | null;
  price_unit: string | null;
  is_available: boolean | null;
  last_verified: Date | string | null;
  pricing_url: string | null;
  notes: string | null;
};

export type PaygRecord = {
  plan_id: null;
  plan_slug: string;
  served_model: string;
  window: 'monthly';
  est_tokens_low: string;
  est_tokens_high: string;
  usage_mix_id: string;
  confidence: 'high';
  verified_at: string;
  notes: string;
};

export type PaygResult = { status: 'skipped'; reason: string } | {
  status: 'ready'; blendedPriceUsdPerMTok: number; record: PaygRecord;
};

/**
 * Pure: the caller supplies the clock and the existing FX cache's rate snapshot.
 * The fixed token range represents a priced basket, never a monthly allowance.
 */
export function payAsYouGoEstimate(
  channel: PaygChannelPrice,
  mix: PaygMix,
  context: { asOf: Date; usdPerCurrencyUnit?: number },
): PaygResult {
  if (!Number.isFinite(context.asOf.getTime())) throw new RangeError('Invalid calculation date');
  // Validate the mix even for a channel that will be skipped.
  blendedPricePerMTok({ input: 0, cachedInput: 0, output: 0 }, mix);
  if (!mix.id) throw new RangeError('Mix id is required');
  const skip = (reason: string): PaygResult => ({ status: 'skipped', reason });
  if (!channel.is_available) return skip('channel unavailable');
  if (!channel.provider_slug || !channel.model_slug) return skip('missing provider/model slug');
  const unit = channel.price_unit;
  const unitFactor = unit === 'per_1m_tokens' ? 1 : unit === 'per_1k_tokens' ? 1000 : null;
  if (unitFactor === null) return skip(`unsupported price_unit: ${unit ?? 'null'}`);
  const currency = channel.currency;
  // getExchangeRateSync silently returns 1 for unknown currencies: reject them here.
  if (!currency || !Object.hasOwn(CURRENCY_INFO, currency)) return skip(`unsupported currency: ${currency ?? 'null'}`);
  const fx = currency === 'USD' ? 1 : context.usdPerCurrencyUnit;
  if (fx == null || !Number.isFinite(fx) || fx <= 0) return skip(`missing/invalid ${currency}/USD exchange rate`);
  const verifiedAt = channel.last_verified == null ? NaN : new Date(channel.last_verified).getTime();
  if (!Number.isFinite(verifiedAt) || verifiedAt > context.asOf.getTime()) return skip('missing/invalid/future source verification date');

  const cutoff = channel.promo_ends_at == null ? NaN : new Date(channel.promo_ends_at).getTime();
  if (channel.promo_ends_at != null && !Number.isFinite(cutoff)) return skip('invalid introductory price expiry');
  const expired = Number.isFinite(cutoff) && context.asOf.getTime() >= cutoff;
  if (expired && [channel.regular_input_price_per_1m, channel.regular_output_price_per_1m]
    .some(value => value == null || !Number.isFinite(value) || value < 0)) {
    return skip('expired introductory price has incomplete/invalid regular prices');
  }
  if (expired && channel.regular_cached_input_price_per_1m != null
    && (!Number.isFinite(channel.regular_cached_input_price_per_1m) || channel.regular_cached_input_price_per_1m < 0)) {
    return skip('invalid regular cache price');
  }
  // Do not let an old cached promotional rate survive a switch to regular prices.
  const price = effectivePrice(expired ? { ...channel, cached_input_price_per_1m: null } : channel, context.asOf);
  const input = price.input_price_per_1m;
  const output = price.output_price_per_1m;
  const cachedInput = price.cached_input_price_per_1m ?? input;
  if ([input, cachedInput, output].some(value => value == null || !Number.isFinite(value) || value < 0)) {
    return skip('missing/invalid token list prices');
  }
  // The checks above establish all three rates; zero prices are valid list prices.
  const originalPrices = { input: input!, cachedInput: cachedInput!, output: output! };
  const usdPrices = {
    input: originalPrices.input * unitFactor * fx,
    cachedInput: originalPrices.cachedInput * unitFactor * fx,
    output: originalPrices.output * unitFactor * fx,
  };
  if (Object.values(usdPrices).some(value => !Number.isFinite(value))) return skip('nonfinite converted prices');
  const blendedPrice = blendedPricePerMTok(usdPrices, mix);
  if (!Number.isFinite(blendedPrice)) return skip('nonfinite blended price');
  const sourceVerifiedAt = new Date(verifiedAt).toISOString();
  const notes = {
    kind: 'payg-list-price', version: 1,
    scope: 'No subscription required. monthly is a comparison dimension; 1000000 tokens is a priced reference basket, not an allowance or cap.',
    blended_price_usd_per_mtok: blendedPrice,
    formula: '(cached_input_usd_per_mtok * cache_read_pct + input_usd_per_mtok * input_pct + output_usd_per_mtok * output_pct) / 100',
    substitution: `(${usdPrices.cachedInput} * ${mix.cacheReadPct} + ${usdPrices.input} * ${mix.inputPct} + ${usdPrices.output} * ${mix.outputPct}) / 100 = ${blendedPrice} USD/MTok`,
    usage_mix: { id: mix.id, cache_read_pct: mix.cacheReadPct, input_pct: mix.inputPct, output_pct: mix.outputPct },
    original_currency: currency as CurrencyCode, original_price_unit: unit,
    original_prices: originalPrices, usd_prices_per_mtok: usdPrices,
    conversion: { usd_per_currency_unit: fx, unit_factor: unitFactor,
      method: currency === 'USD' ? 'USD; no currency conversion' : `existing getExchangeRateSync('${currency}', 'USD') snapshot; multiply by ${fx}` },
    cache_handling: price.cached_input_price_per_1m == null
      ? 'Cache-read list price missing: use ordinary input price, including the cached share.'
      : 'Use explicit cache-read list price (zero is valid).',
    cache_write_handling: 'Cache-write fees are not separately modeled in this three-category comparison.',
    confidence_basis: 'Official channel list prices stored in api_channel_prices; high describes the price calculation, not a measured workload or quota.',
    source: { api_channel_price_id: channel.id, url: channel.pricing_url, notes: channel.notes, verified_at: sourceVerifiedAt },
    schedule: { promo_ends_at: Number.isFinite(cutoff) ? new Date(cutoff).toISOString() : null,
      basis: !Number.isFinite(cutoff) ? 'current list prices' : context.asOf.getTime() < cutoff ? 'active introductory list prices' : 'regular list prices after expiry' },
  };
  return {
    status: 'ready', blendedPriceUsdPerMTok: blendedPrice,
    record: {
      plan_id: null, plan_slug: `payg:${channel.provider_slug}`, served_model: channel.model_slug,
      window: 'monthly', est_tokens_low: '1000000', est_tokens_high: '1000000',
      usage_mix_id: mix.id, confidence: 'high', verified_at: sourceVerifiedAt, notes: JSON.stringify(notes),
    },
  };
}
