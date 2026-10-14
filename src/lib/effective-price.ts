/** The raw SQL shape shared by all API channel price reads. */
export interface PriceSchedule {
  promo_ends_at?: Date | string | null;
  regular_input_price_per_1m?: number | null;
  regular_output_price_per_1m?: number | null;
  regular_cached_input_price_per_1m?: number | null;
}

export interface ScheduledChannelPrice extends PriceSchedule {
  input_price_per_1m?: number | null;
  output_price_per_1m?: number | null;
  cached_input_price_per_1m?: number | null;
}

/** Resolve on every read, so a stopped scraper cannot freeze an introductory price. */
export function effectivePrice<T extends ScheduledChannelPrice>(row: T, now = new Date()): T {
  const cutoff = row.promo_ends_at == null ? NaN : new Date(row.promo_ends_at).getTime();
  if (!Number.isFinite(cutoff) || now.getTime() < cutoff) return row;
  const result = { ...row };
  for (const [current, regular] of [
    ['input_price_per_1m', 'regular_input_price_per_1m'],
    ['output_price_per_1m', 'regular_output_price_per_1m'],
    ['cached_input_price_per_1m', 'regular_cached_input_price_per_1m'],
  ] as const) {
    const value = row[regular];
    if (value != null && Number.isFinite(value)) result[current] = value;
  }
  return result;
}

export function isIntroductoryPriceActive(row: PriceSchedule, now = new Date()): boolean {
  return row.promo_ends_at != null && now.getTime() < new Date(row.promo_ends_at).getTime();
}

/** Inclusive last promotional calendar date, in the same zone as the parser. */
export function introductoryEndDate(cutoff: Date | string, locale: string): string {
  const lastInstant = new Date(new Date(cutoff).getTime() - 1);
  return new Intl.DateTimeFormat(locale === 'zh' ? 'sv-SE' : 'en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric',
    month: locale === 'zh' ? '2-digit' : 'short', day: locale === 'zh' ? '2-digit' : 'numeric',
  }).format(lastInstant);
}

/** Immutable catalogs must expire before any active introductory rate changes. */
export function priceSnapshotExpiresAt(rows: PriceSchedule[], nominalExpiry: Date, now = new Date()): string {
  let expiry = nominalExpiry.getTime();
  for (const row of rows) {
    if (isIntroductoryPriceActive(row, now)) expiry = Math.min(expiry, new Date(row.promo_ends_at!).getTime());
  }
  return new Date(expiry).toISOString();
}
