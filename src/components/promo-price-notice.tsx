import { LimitedTimeOfferMark } from '@/components/limited-time-offer';
import type { LimitedTimeOfferRow } from '@/lib/limited-time-offer';

/** Channel-level notice shared by official and same-price reseller rows. */
export function PromoPriceNotice({ row, locale, now = new Date() }: {
  row: LimitedTimeOfferRow; locale: string; now?: Date;
}) {
  return <LimitedTimeOfferMark row={row} locale={locale} now={now} />;
}
