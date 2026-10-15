import { introductoryEndDate, isIntroductoryPriceActive, type PriceSchedule } from '@/lib/effective-price';

/** Channel-level notice shared by official and same-price reseller rows. */
export function PromoPriceNotice({ row, locale, now = new Date() }: {
  row: PriceSchedule; locale: string; now?: Date;
}) {
  if (!isIntroductoryPriceActive(row, now) || row.regular_input_price_per_1m == null || row.regular_output_price_per_1m == null) return null;
  const date = introductoryEndDate(row.promo_ends_at!, locale);
  return <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
    {locale === 'zh'
      ? `首发优惠至 ${date}（太平洋时间），之后输入 $${row.regular_input_price_per_1m} / 输出 $${row.regular_output_price_per_1m} 每百万 token`
      : `Introductory through ${date} (Pacific time), then $${row.regular_input_price_per_1m} input / $${row.regular_output_price_per_1m} output per 1M`}
  </p>;
}
