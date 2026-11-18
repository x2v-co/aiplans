import { DataTrustLabel } from './data-trust-label';
import { channelListPriceTrust, variantPriceTrust, unknownFactTrust } from '@/lib/data-trust';
import { DeepSeekWindowPrices } from '@/components/deepseek-window-prices';
import { ModelLifecycleBadge } from '@/components/model-lifecycle-badge';
import Link from 'next/link';
import { ChannelTermsBadges } from '@/components/channel-terms-badges';
import { getTranslations } from 'next-intl/server';
import type { ChannelPrice, GroupedProduct } from '@/lib/grouped-products';
import { formatModelName } from '@/lib/model-names';
import { LimitedTimeOfferMark } from '@/components/limited-time-offer';
import { providerModelPath, formatProviderApiPrice } from '@/lib/provider-page';

export async function ProviderApiModels({ products, locale, now, showTrust = false }: { products: GroupedProduct[]; locale: string; now: Date; showTrust?: boolean }) {
  const t = await getTranslations({ locale, namespace: 'providerPage' });
  if (!products.length) return <p className="text-zinc-500">{t('noApiModels')}</p>;
  const price = (value: number | null | undefined, row: Pick<ChannelPrice, 'currency' | 'price_unit'>) =>
    formatProviderApiPrice(value, row.currency || 'USD', row.price_unit, locale);
  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-950">
      <table className="w-full text-sm">
        <caption className="p-4 text-left font-medium">{t('apiModels')}
          {showTrust && <p className="mt-1 text-xs font-normal">API 按所列单位计费；token 报价按每百万 tokens 区分输入、输出与缓存，高峰 / 低谷等条件见各变体。API 代表价不能确认订阅价格或所有 API 数据已核验。</p>}
        </caption>
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
                {(row.member_shutdown_date ?? product.shutdown_date) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-normal">
                    <ModelLifecycleBadge shutdownDate={row.member_shutdown_date ?? product.shutdown_date} replacement={product.replacement_model} />
                  </div>
                )}
                <ChannelTermsBadges terms={row} />
                          <DeepSeekWindowPrices variants={row.price_variants} />
                <LimitedTimeOfferMark row={row} locale={locale} now={now} />
                {showTrust && <><DataTrustLabel showUnknownDate record={`channel:${row.id}:price`} fact={channelListPriceTrust(row, locale, now)} locale={locale} />
                  <DataTrustLabel showUnknownDate record={`channel:${row.id}:terms`} locale={locale}
                    fact={unknownFactTrust(locale, '本渠道数据使用条件、额度单位及适用限制：未记录独立核验', now)} /></>}
                {!!row.price_variants?.length && (
                  <details className="mt-2 font-normal">
                    <summary className="cursor-pointer text-xs text-zinc-500">{t('priceVariants')}</summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {row.price_variants.map(variant => <li key={variant.id}>{variant.variant_name}: {t('inputPrice')} {price(variant.input_price_per_1m, variant)} · {t('outputPrice')} {price(variant.output_price_per_1m, variant)}
                        {showTrust && <DataTrustLabel showUnknownDate record={`variant:${variant.id}:price`} fact={variantPriceTrust(variant, row, locale, now)} locale={locale} />}
                      </li>)}
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
