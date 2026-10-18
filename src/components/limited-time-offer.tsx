import Link from 'next/link';
import {
  formatOfferMoney,
  limitedTimeOffer,
  promoFilterHref,
  type LimitedTimeOfferRow,
} from '@/lib/limited-time-offer';

const LINE_LABEL = {
  input: { zh: '输入', en: 'Input' },
  output: { zh: '输出', en: 'Output' },
  cached: { zh: '缓存读取', en: 'Cache read' },
} as const;

/**
 * Server-rendered limited-time offer mark. `now` is the request time from the
 * page so an expired `promo_ends_at` disappears on the next request. Callers
 * that render this must stay dynamic; a static/ISR cache would keep the mark
 * after the cutoff.
 */
export function LimitedTimeOfferMark({
  row,
  locale,
  now,
}: {
  row: LimitedTimeOfferRow;
  locale: string;
  now: Date;
}) {
  const offer = limitedTimeOffer(row, now, locale);
  if (!offer) return null;
  const isZh = locale === 'zh';
  return (
    <div className="mt-1 max-w-xs space-y-0.5 text-xs font-normal text-amber-800 dark:text-amber-200" data-limited-time-offer="active">
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        {isZh ? '限时优惠' : 'Limited-time offer'}
      </span>
      {offer.lines.map(line => (
        <p key={line.kind}>
          <span>{isZh ? LINE_LABEL[line.kind].zh : LINE_LABEL[line.kind].en} </span>
          <span>{isZh ? '现价' : 'now'} {formatOfferMoney(line.current, offer.currency, locale)}</span>
          {' '}
          <s>
            {isZh ? '原价' : 'was'} {formatOfferMoney(line.regular, offer.currency, locale)}
          </s>
        </p>
      ))}
      <p>
        {isZh ? '截止' : 'Ends'}{' '}
        <time dateTime={offer.endsAt}>{offer.endsOn}</time>
        {isZh ? '（太平洋时间）' : ' (Pacific time)'}
      </p>
    </div>
  );
}

/** Compact flag for a list card. Prices stay on the detail page. */
export function LimitedTimeOfferFlag({ locale }: { locale: string }) {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      {locale === 'zh' ? '限时优惠' : 'Limited-time offer'}
    </span>
  );
}

/** Link toggle. Navigation (not client state) so the filtered URL is what the server renders and noindexes. */
export function LimitedTimeOfferToggle({
  locale,
  path,
  active,
  preserve,
}: {
  locale: string;
  path: string;
  active: boolean;
  preserve?: Record<string, string | undefined | null>;
}) {
  const isZh = locale === 'zh';
  return (
    <Link
      href={promoFilterHref(locale, path, active, preserve)}
      aria-pressed={active}
      className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
        active
          ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200'
      }`}
    >
      {isZh ? '只看限时优惠' : 'Limited-time offers only'}
    </Link>
  );
}
