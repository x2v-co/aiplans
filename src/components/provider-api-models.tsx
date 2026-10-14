import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ChannelPrice, GroupedProduct } from '@/lib/grouped-products';
import { formatModelName } from '@/lib/model-names';
import { introductoryEndDate, isIntroductoryPriceActive } from '@/lib/effective-price';
import { providerModelPath, formatProviderApiPrice } from '@/lib/provider-page';

export async function ProviderApiModels({ products, locale }: { products: GroupedProduct[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'providerPage' });
  if (!products.length) return <p className="text-zinc-500">{t('noApiModels')}</p>;
  const price = (value: number | null | undefined, row: Pick<ChannelPrice, 'currency' | 'price_unit'>) =>
    formatProviderApiPrice(value, row.currency || 'USD', row.price_unit, locale);
  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-950">
      <table className="w-full text-sm">
        <caption className="p-4 text-left font-medium">{t('apiModels')}</caption>
        <thead className="border-y bg-zinc-50 text-left dark:bg-zinc-900">
          <tr>
            {[t('model'), t('inputPrice'), t('outputPrice'), t('cachedInputPrice')].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {products.flatMap(product => product.versions.map(row => (
            <tr key={row.id} className="border-b last:border-0">
              <th scope="row" className="p-3 text-left font-medium">
                <Link href={`/${locale}${providerModelPath(row.model_slug || product.slug, product.modelCategory)}`} className="text-blue-600 hover:underline">
                  {formatModelName(product.name)}{row.variant?.length ? ` (${row.variant.join(', ')})` : ''}
                </Link>
                {isIntroductoryPriceActive(row) && <p className="mt-1 text-xs font-normal text-zinc-500">{t('introductoryUntil', { date: introductoryEndDate(row.promo_ends_at!, locale) })}</p>}
                {!!row.price_variants?.length && (
                  <details className="mt-2 font-normal">
                    <summary className="cursor-pointer text-xs text-zinc-500">{t('priceVariants')}</summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {row.price_variants.map(variant => <li key={variant.id}>{variant.variant_name}: {t('inputPrice')} {price(variant.input_price_per_1m, variant)} · {t('outputPrice')} {price(variant.output_price_per_1m, variant)}</li>)}
                    </ul>
                  </details>
                )}
              </th>
              <td className="whitespace-nowrap p-3">{price(row.input_price_per_1m, row)}</td>
              <td className="whitespace-nowrap p-3">{price(row.output_price_per_1m, row)}</td>
              <td className="whitespace-nowrap p-3">{price(row.cached_input_price_per_1m, row)}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}
