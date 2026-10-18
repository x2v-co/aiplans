import type { Metadata } from 'next';
import { introductoryEndDate, isIntroductoryPriceActive, type PriceSchedule } from './effective-price';
import { SITE_URL } from './seo';

/**
 * Display-only view of an API channel's limited-time price.
 *
 * Columns live on `api_channel_prices` only: `promo_ends_at`,
 * `regular_input_price_per_1m`, `regular_output_price_per_1m`,
 * `regular_cached_input_price_per_1m`. `plans` has none of these, so
 * subscription rows are not treated as offers and no migration is added here.
 * This module does not rewrite stored or effective prices.
 */
export interface LimitedTimeOfferRow extends PriceSchedule {
  input_price_per_1m?: number | null;
  output_price_per_1m?: number | null;
  cached_input_price_per_1m?: number | null;
  currency?: string | null;
}

export interface LimitedTimeOfferLine {
  kind: 'input' | 'output' | 'cached';
  current: number;
  regular: number;
}

export interface LimitedTimeOffer {
  currency: string;
  /** Exclusive cutoff instant (`promo_ends_at`). */
  endsAt: string;
  /** Inclusive last promotional calendar date, Pacific time, same rule as other price copy. */
  endsOn: string;
  lines: LimitedTimeOfferLine[];
}

export interface LimitedTimeOfferModel {
  versions?: LimitedTimeOfferRow[] | null;
}

const PROMO_PARAM = 'promo';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Active only while the request time is strictly before `promo_ends_at` and a regular input or output price exists. */
export function limitedTimeOffer(row: LimitedTimeOfferRow, now = new Date(), locale = 'en'): LimitedTimeOffer | null {
  if (!isIntroductoryPriceActive(row, now) || row.promo_ends_at == null) return null;
  const lines: LimitedTimeOfferLine[] = [];
  const push = (kind: LimitedTimeOfferLine['kind'], current: unknown, regular: unknown) => {
    if (finite(current) && finite(regular)) lines.push({ kind, current, regular });
  };
  push('input', row.input_price_per_1m, row.regular_input_price_per_1m);
  push('output', row.output_price_per_1m, row.regular_output_price_per_1m);
  push('cached', row.cached_input_price_per_1m, row.regular_cached_input_price_per_1m);
  if (!lines.some(line => line.kind === 'input' || line.kind === 'output')) return null;
  return {
    currency: row.currency || 'USD',
    endsAt: new Date(row.promo_ends_at).toISOString(),
    endsOn: introductoryEndDate(row.promo_ends_at, locale),
    lines,
  };
}

export function modelHasLimitedTimeOffer(model: LimitedTimeOfferModel, now = new Date()): boolean {
  return (model.versions ?? []).some(row => limitedTimeOffer(row, now) != null);
}

/** Keep models that still have at least one unexpired channel offer at `now`. */
export function filterLimitedTimeOffers<T extends LimitedTimeOfferModel>(models: T[], now = new Date()): T[] {
  return models.filter(model => modelHasLimitedTimeOffer(model, now));
}

export function isPromoFilter(value: string | string[] | undefined | null): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1';
}

export function applyPromoFilter<T extends LimitedTimeOfferModel>(
  models: T[],
  promoParam: string | string[] | undefined | null,
  now = new Date(),
): { models: T[]; filtered: boolean } {
  const filtered = isPromoFilter(promoParam);
  return { models: filtered ? filterLimitedTimeOffers(models, now) : models, filtered };
}

/** Toggle `?promo=1` without dropping the page's other query parameters. */
export function promoFilterHref(
  locale: string,
  path: string,
  active: boolean,
  current: Record<string, string | undefined | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key === PROMO_PARAM || value == null || value === '') continue;
    params.set(key, value);
  }
  if (!active) params.set(PROMO_PARAM, '1');
  const query = params.toString();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}${query ? `?${query}` : ''}`;
}

/**
 * Robots + canonical for a filtered list URL.
 * Canonical always names the unfiltered page. Unfiltered calls return nothing
 * so a parent layout can keep the indexable metadata.
 */
export function filteredListMetadata(locale: string, path: string, filtered: boolean): Metadata {
  if (!filtered) return {};
  const loc = locale === 'zh' ? 'zh' : 'en';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return {
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    alternates: { canonical: `${SITE_URL}/${loc}${normalized}` },
  };
}

export function formatOfferMoney(value: number, currency: string, locale: string): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  try {
    return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(value);
  } catch {
    return `${code} ${value}`;
  }
}
