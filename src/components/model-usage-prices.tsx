import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { pricingLabel } from '@/lib/model-pricing-seo';
import type { ModelUsagePriceRow } from '@/lib/model-usage-prices';

export function ModelUsagePriceHeadline({ row, locale }: { row: ModelUsagePriceRow; locale: string }) {
  return <>
    <div className="text-3xl font-bold mt-1">
      {pricingLabel(row.price, row.currency)}
      <span className="text-sm font-normal text-zinc-500"> / {labelNonLlmPriceKey(row.unit, locale)}</span>
    </div>
    <div className="mt-1 text-sm text-zinc-600">{labelNonLlmPriceKey(row.price_kind, locale)}</div>
  </>;
}

export default function ModelUsagePrices({ rows, locale }: { rows: ModelUsagePriceRow[]; locale: string }) {
  if (rows.length === 0) return null;
  return <div className="space-y-2 text-sm">
    {rows.map(row => <div key={row.id}>
      <div>{labelNonLlmPriceKey(row.price_kind, locale)}: {pricingLabel(row.price, row.currency)} / {labelNonLlmPriceKey(row.unit, locale)}</div>
      {row.source_url && <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {locale === 'zh' ? '价格来源' : 'Price source'}
      </a>}
    </div>)}
  </div>;
}
