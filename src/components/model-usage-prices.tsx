import { labelNonLlmPriceKey } from '@/lib/non-llm-price-labels';
import { pricingLabel } from '@/lib/model-pricing-seo';
import type { ModelUsagePriceRow } from '@/lib/model-usage-prices';

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
