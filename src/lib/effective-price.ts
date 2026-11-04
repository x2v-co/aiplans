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
  price_variants?: Array<{
    input_price_per_1m?: number | null;
    output_price_per_1m?: number | null;
    cached_input_price_per_1m?: number | null;
    is_headline?: boolean;
    variant_kind?: string | null;
  }>;
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
  // The default-route variant mirrors its channel headline. Keep expanded
  // price tables consistent at expiry, even when no scraper has run yet.
  if (row.price_variants) result.price_variants = row.price_variants.map(variant =>
    variant.is_headline && variant.variant_kind === 'default_route'
      ? { ...variant, input_price_per_1m: result.input_price_per_1m,
        output_price_per_1m: result.output_price_per_1m,
        cached_input_price_per_1m: result.cached_input_price_per_1m }
      : variant);
  return result;
}

export function isIntroductoryPriceActive(row: PriceSchedule, now = new Date()): boolean {
  return row.promo_ends_at != null && now.getTime() < new Date(row.promo_ends_at).getTime();
}

export type PromoTimeZone = 'America/Los_Angeles' | 'Asia/Shanghai';

/** Provider identity a channel row may carry (joined `providers` object or flat slug). */
export interface PromoProviderRef {
  provider_slug?: string | null;
  providers?: { slug?: string | null; region?: string | null; [key: string]: unknown } | null;
}

/**
 * China-mainland providers (region 'china', plus Tencent whose provider row may be
 * global but whose promo source states Beijing time) publish cutoffs in Beijing time. Everything
 * else (Google, Mistral, aggregators mirroring a US promo) keeps Pacific time.
 */
const BEIJING_TIME_PROVIDERS = new Set(['tencent', 'tencent-cloud', 'hunyuan']);

export function promoTimeZone(row: PromoProviderRef | null | undefined): PromoTimeZone {
  const slug = (row?.provider_slug ?? row?.providers?.slug ?? '').toLowerCase();
  if (BEIJING_TIME_PROVIDERS.has(slug) || row?.providers?.region === 'china') return 'Asia/Shanghai';
  return 'America/Los_Angeles';
}

export function promoTimeZoneLabel(zone: PromoTimeZone, locale: string): string {
  const zh = locale === 'zh';
  if (zone === 'Asia/Shanghai') return zh ? '北京时间' : 'Beijing time';
  return zh ? '太平洋时间' : 'Pacific time';
}

/** Inclusive last promotional calendar date, in the source's zone (Pacific by default). */
export function introductoryEndDate(cutoff: Date | string, locale: string, timeZone: PromoTimeZone = 'America/Los_Angeles'): string {
  const lastInstant = new Date(new Date(cutoff).getTime() - 1);
  return new Intl.DateTimeFormat(locale === 'zh' ? 'sv-SE' : 'en-US', {
    timeZone, year: 'numeric',
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
