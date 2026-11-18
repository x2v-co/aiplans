import { DataTrustLabel } from './data-trust-label';
import { usagePriceTrust } from '@/lib/data-trust';
import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { pricingLabel } from '@/lib/model-pricing-seo';
import { formatCurrencyAmount } from '@/lib/currency';
import type { ModelUsagePriceRow } from '@/lib/model-usage-prices';

const rangeMoney = (row: ModelUsagePriceRow) => formatCurrencyAmount(row.price!.toLocaleString('en-US', {
  useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 4,
}), row.currency);

/** `high` (from usagePriceHeadlineRange) turns the headline into a tier range such as $0.20–$0.60 / second. */
export function ModelUsagePriceHeadline({ row, high, locale, showTrust = false, now }: { row: ModelUsagePriceRow; high?: ModelUsagePriceRow; locale: string; showTrust?: boolean; now?: Date }) {
  const range = high != null && high.id !== row.id && high.price !== row.price;
  return <>
    <div className="text-3xl font-bold mt-1">
      {range ? `${rangeMoney(row)}–${rangeMoney(high)}` : pricingLabel(row.price, row.currency)}
      <span className="text-sm font-normal text-zinc-500"> / {labelNonLlmPriceKey(row.unit, locale)}</span>
    </div>
    <div className="mt-1 text-sm text-zinc-600">{range
      ? `${labelNonLlmPriceKey(row.price_kind, locale)} – ${labelNonLlmPriceKey(high.price_kind, locale)}`
      : labelNonLlmPriceKey(row.price_kind, locale)}</div>
    {showTrust && <DataTrustLabel showUnknownDate record={`usage:${row.id}`} fact={usagePriceTrust(row, locale, now)} locale={locale} />}
    {showTrust && range && <DataTrustLabel showUnknownDate record={`usage:${high.id}`} fact={usagePriceTrust(high, locale, now)} locale={locale} />}
  </>;
}

export default function ModelUsagePrices({ rows, locale, showTrust = false, now }: { rows: ModelUsagePriceRow[]; locale: string; showTrust?: boolean; now?: Date }) {
  if (rows.length === 0) return null;
  return <div className="space-y-2 text-sm">
    {rows.map(row => <div key={row.id}>
      <div>{labelNonLlmPriceKey(row.price_kind, locale)}: {pricingLabel(row.price, row.currency)} / {labelNonLlmPriceKey(row.unit, locale)}</div>
      {row.source_url && <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {locale === 'zh' ? '价格来源' : 'Price source'}
      </a>}
      {showTrust && <DataTrustLabel showUnknownDate record={`usage:${row.id}`} fact={usagePriceTrust(row, locale, now)} locale={locale} />}
    </div>)}
  </div>;
}
