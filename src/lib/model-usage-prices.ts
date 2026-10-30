import type { PricingChannel } from './model-pricing-seo';
import { isRealPrice } from './model-pricing-seo';
import { convertToUSD } from './currency-conversion';
import type { CurrencyCode } from './currency';

export interface ModelUsagePriceRow {
  id: number;
  model_id: number;
  provider_id: number | null;
  plan_id: number | null;
  price_kind: string;
  unit: string;
  price: number | null;
  currency: string | null;
  is_available: boolean | null;
  constraints_json: unknown;
  source_url: string | null;
  last_verified: string | null;
  provider_name: string | null;
  provider_slug: string | null;
  provider_type: string | null;
  plan_name: string | null;
  plan_slug: string | null;
}

/** Preserve billing dimensions; identical rows in the same scope appear once. */
export function availableUsagePrices(rows: ModelUsagePriceRow[], includeReferences = false): ModelUsagePriceRow[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (row.is_available === false || (!isRealPrice(row.price) && !(includeReferences && row.price == null))) return false;
    const key = JSON.stringify([row.provider_id, row.plan_id, row.price_kind, row.unit,
      row.price, row.currency || 'USD', row.constraints_json]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Plan-specific prices are never promoted to model-wide official quotes. */
export function officialUsageFallback(channels: PricingChannel[], rows: ModelUsagePriceRow[]): ModelUsagePriceRow[] {
  const hasOfficialQuote = channels.some(row => row.is_available !== false &&
    ['official', 'producer'].includes(row.providers?.type || '') &&
    [row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m].some(isRealPrice));
  return hasOfficialQuote ? [] : availableUsagePrices(rows).filter(row => row.plan_id == null &&
    ['official', 'producer'].includes(row.provider_type || ''));
}

/** Prefer input rates, and compare only matching billing dimensions and units. */
export function usagePriceHeadline(rows: ModelUsagePriceRow[]): ModelUsagePriceRow | undefined {
  const available = availableUsagePrices(rows);
  const primary = available.find(row => row.price_kind === 'input_tokens') || available[0];
  if (!primary) return undefined;
  return available.filter(row => row.price_kind === primary.price_kind && row.unit === primary.unit)
    .sort((a, b) => convertToUSD(a.price!, (a.currency || 'USD') as CurrencyCode) -
      convertToUSD(b.price!, (b.currency || 'USD') as CurrencyCode))[0];
}
