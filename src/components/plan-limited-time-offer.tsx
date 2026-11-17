import { planLimitedTimeOffer, type PlanOfferRow } from '@/lib/plan-limited-time-offer';
import { formatOfferMoney } from '@/lib/limited-time-offer';
import { promoTimeZoneLabel } from '@/lib/effective-price';

/** Server component: renders without JS at the supplied render time. Public
 * ISR300 HTML updates on successful revalidation; filtered routes are dynamic. */
export function PlanLimitedTimeOfferMark({ plan, locale, now, yearly = false }: {
  plan: PlanOfferRow; locale: string; now: Date; yearly?: boolean;
}) {
  const offer = planLimitedTimeOffer(plan, now, locale, yearly);
  if (!offer) return null;
  const zh = locale === 'zh';
  const period = offer.unit === 'per_year' ? (zh ? '年' : 'year') : (zh ? '月' : 'month');
  return <div className="mt-2 max-w-full space-y-1 text-xs text-amber-800 [overflow-wrap:anywhere] dark:text-amber-200" data-plan-limited-time-offer="active">
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium dark:bg-amber-950">{zh ? '限时优惠' : 'Limited-time offer'}</span>
    <p>{zh ? '现价' : 'Now'} {formatOfferMoney(offer.current, offer.currency, locale)} / {period}{' '}
      <s>{zh ? '原价' : 'Was'} {formatOfferMoney(offer.regular, offer.currency, locale)} / {period}</s></p>
    <p>{zh ? '截止' : 'Ends'} <time dateTime={offer.endsAt}>{offer.endsOn}</time>{' '}
      ({promoTimeZoneLabel(offer.timeZone, locale)})</p>
  </div>;
}
