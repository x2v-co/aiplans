/**
 * Pure coupon display helpers shared by the /coupons page and the site-wide
 * CouponBadge. Client-safe: no server imports.
 */

type DiscountLike = {
  discount_type?: string | null;
  discountType?: string | null;
  discount_value?: number | null;
  discountValue?: number | null;
};

// Mirrors the return of useTranslations('coupons') from @/lib/translations.
type TFn = (key: string, params?: Record<string, string | number>) => string;

export function compactTokenCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    notation: 'compact',
  }).format(value);
}

export function formatCouponDiscount(
  coupon: DiscountLike,
  locale: string,
  t: TFn,
  tokenKey: 'tokenCredit' | 'badgeToken' = 'tokenCredit',
): string {
  const type = coupon.discount_type ?? coupon.discountType;
  const value = coupon.discount_value ?? coupon.discountValue ?? 0;
  if (type === 'percentage') return t('percentOff', { value });
  if (type === 'fixed') return t('creditAmount', { value });
  if (type === 'trial') {
    return t(tokenKey, { value: compactTokenCount(value, locale) });
  }
  return `${value}`;
}

type CopyTargetLike = DiscountLike & {
  code: string;
  offer_url?: string | null;
  offerUrl?: string | null;
};

/**
 * Trial coupons with an offer URL are redeemed by registering through that
 * link (the opaque code is not enterable at checkout), so copy copies the
 * link; everything else copies the code.
 */
export function couponCopyTarget(coupon: CopyTargetLike): string {
  const type = coupon.discount_type ?? coupon.discountType;
  const url = coupon.offer_url ?? coupon.offerUrl ?? null;
  return type === 'trial' && url ? url : coupon.code;
}

/** Compact "host/path" label for a link-only coupon; the full URL stays in href/title/clipboard. */
export function couponLinkLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/** NULL expiry means "no published expiry", not "expired in 1970". */
export function isCouponExpired(
  expiresAt: string | Date | null,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < nowMs;
}

/** Lightweight coupon payload carried to site-wide CTA badges. */
export interface CouponOffer {
  id: number;
  code: string;
  providerId: number;
  providerSlug: string;
  description: string;
  discountType: string;
  discountValue: number;
  expiresAt: string | null;
  offerUrl: string | null;
  scope: 'plan' | 'api';
}

/**
 * Merge coupons for several provider slugs (e.g. a table row combining the CN
 * and global official channels), de-duped by coupon id. Pure so client
 * islands can import it without pulling in the postgres client.
 */
export function couponsFor(
  map: Record<string, CouponOffer[]>,
  ...slugs: Array<string | null | undefined>
): CouponOffer[] {
  const seen = new Set<number>();
  const out: CouponOffer[] = [];
  for (const slug of slugs) {
    if (!slug) continue;
    for (const offer of map[slug] ?? []) {
      if (seen.has(offer.id)) continue;
      seen.add(offer.id);
      out.push(offer);
    }
  }
  return out;
}
