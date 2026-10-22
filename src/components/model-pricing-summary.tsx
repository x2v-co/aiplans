import { ExternalLink } from 'lucide-react';
import { LimitedTimeOfferMark } from '@/components/limited-time-offer';
import { pricingDate, pricingLabel, type buildModelPricingSeo, type PricingChannel } from '@/lib/model-pricing-seo';

/** The channel name is the access point: a bare row label leaves the cheapest offer unreachable. */
function ChannelName({ row, locale }: { row: PricingChannel; locale: string }) {
  const name = row.providers?.name || (locale === 'zh' ? '渠道' : 'Channel');
  const website = row.providers?.website;
  if (!website) return <>{name}</>;
  return (
    <a
      href={website}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
      aria-label={locale === 'zh' ? `访问 ${name} 官网` : `Visit ${name} website`}
    >
      {name}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

export default function ModelPricingSummary({ pricing, locale, now }: {
  pricing: ReturnType<typeof buildModelPricingSeo>; locale: string; now: Date;
}) {
  const isZh = locale === 'zh';
  return (
    <section className="mb-6 rounded-lg border p-4" aria-label={isZh ? 'API 定价速览' : 'API pricing at a glance'}>
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        {pricing.updatedOn ? <>{isZh ? '更新于' : 'Updated on'} <time dateTime={pricing.updatedOn}>{pricing.updatedOn}</time></> : pricing.updateText}
        {' · '}{isZh ? '各币种原始报价 / 每百万 tokens；最低按输入价格排序' : 'Published currencies / per 1M tokens; cheapest ranked by input'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{isZh ? '官方与最低价渠道 API 定价' : 'Official and cheapest channel API pricing'}</caption>
          <thead><tr className="border-b">
            {[isZh ? '渠道' : 'Channel', isZh ? '输入 / 1M' : 'Input / 1M', isZh ? '输出 / 1M' : 'Output / 1M',
              isZh ? '缓存读取 / 1M' : 'Cache read / 1M', isZh ? '更新 / 核验日期' : 'Updated / verified on'].map(label =>
              <th key={label} scope="col" className="px-2 py-2">{label}</th>)}
          </tr></thead>
          <tbody>
            {pricing.official.length === 0 && <tr className="border-b"><th scope="row" className="px-2 py-2">{isZh ? '官方' : 'Official'}</th>
              <td colSpan={4} className="px-2 py-2">{isZh ? '暂无官方报价' : 'No official quote recorded'}</td></tr>}
            {pricing.tableChannels.map((row, index) => <tr key={row.id ?? index} className="border-b last:border-0">
              <th scope="row" className="px-2 py-2 font-medium">
                <ChannelName row={row} locale={locale} />
                {pricing.official.includes(row) && <span className="ml-2">{isZh ? '官方' : 'Official'}</span>}
                {row === pricing.cheapest && <span className="ml-2 text-green-700 dark:text-green-400">{isZh ? '最低输入价' : 'Lowest input'}</span>}
                <LimitedTimeOfferMark row={row} locale={locale} now={now} />
              </th>
              <td className="px-2 py-2 whitespace-nowrap">{pricingLabel(row.input_price_per_1m, row.currency)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{pricingLabel(row.output_price_per_1m, row.currency)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{pricingLabel(row.cached_input_price_per_1m, row.currency)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{pricingDate(row) || '—'}</td>
            </tr>)}
            {pricing.tableChannels.length === 0 && <tr><td colSpan={5} className="px-2 py-2">{isZh ? '暂无可用渠道报价' : 'No channel quotes available'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{isZh ? '— 表示价格或日期未记录。跨币种排名使用汇率换算。' : '— means the price or date is not recorded. Cross-currency ranking uses exchange rates.'}</p>
    </section>
  );
}
