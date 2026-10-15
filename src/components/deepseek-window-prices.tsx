import { useLocale, useTranslations } from 'next-intl';
import type { ChannelPriceVariant } from '@/lib/grouped-products';

/** Only display a published schedule; older / unseeded rows have no badge. */
export function DeepSeekWindowPrices({ variants }: { variants?: ChannelPriceVariant[] | null }) {
  const t = useTranslations('deepseekWindows');
  const locale = useLocale();
  if (!Array.isArray(variants)) return null;
  const find = (window: string) => variants.find(variant => variant.variant_kind === 'time_window' &&
    variant.constraints_json?.time_window === window && typeof variant.constraints_json?.peak_schedule === 'string');
  const peak = find('peak');
  const offPeak = find('off-peak');
  if (!peak || !offPeak) return null;
  const format = (value: number | null | undefined) => value == null || !Number.isFinite(Number(value)) ? '—' :
    new Intl.NumberFormat(locale, { style: 'currency', currency: peak.currency || 'USD', maximumFractionDigits: 6 }).format(Number(value));
  return (
    <div className="mt-1 whitespace-normal text-xs font-normal">
      <span className="cursor-help rounded border px-1.5 py-0.5" title={t('window')}>{t('label')}</span>
      <p className="mt-1 text-zinc-500">{t('list')}</p>
      {([['peak', peak], ['offPeak', offPeak]] as const).map(([key, row]) => (
        <p key={key} className="text-zinc-500">{t(key)}: {t('rates', {
          input: format(row.input_price_per_1m), cache: format(row.cached_input_price_per_1m), output: format(row.output_price_per_1m),
        })}</p>
      ))}
    </div>
  );
}
