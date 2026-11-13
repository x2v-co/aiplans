/**
 * Coupon conversion events: outbound offer clicks and copy-to-clipboard.
 *
 * Event names are coupon_click / coupon_copy. Parameters stay low-cardinality:
 * numeric coupon id only, never the redeem code. Sent through
 * trackAnalyticsEvent, so they follow the same consent gate as outbound_click.
 */

import { trackAnalyticsEvent } from '@/lib/analytics';
import {
  ANALYTICS_NOT_SET,
  outboundChannelDataset,
  pageGroup,
  sanitizeAnalyticsSlug,
} from '@/lib/funnel-analytics';

export const COUPON_PLACEMENTS = [
  'plans',
  'model',
  'provider',
  'api-pricing',
  'compare',
  'coupons',
] as const;

export type CouponPlacement = (typeof COUPON_PLACEMENTS)[number];

export type CouponAnalyticsAction = 'outbound' | 'copy';

const PLACEMENTS = new Set<string>(COUPON_PLACEMENTS);
const COUPON_ID = /^[1-9][0-9]{0,9}$/;
const LOCALES = new Set(['en', 'zh']);

export type CouponEventInput = {
  couponId?: number | string | null;
  providerSlug?: string | null;
  channelSlug?: string | null;
  channelType?: string | null;
  modelSlug?: string | null;
  placement?: string | null;
  locale?: string | null;
  pathname?: string | null;
  action: CouponAnalyticsAction;
};

export type CouponEventParams = {
  provider_slug: string;
  channel_slug: string;
  coupon_id: string;
  placement: string;
  page_family: string;
  locale: string;
  action: CouponAnalyticsAction;
};

/** Numeric coupon primary key only. Rejects redeem codes and other tokens. */
export function sanitizeCouponId(value: number | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  return COUPON_ID.test(raw) ? raw : null;
}

export function sanitizeCouponPlacement(value: string | null | undefined): string {
  if (!value) return ANALYTICS_NOT_SET;
  return PLACEMENTS.has(value) ? value : ANALYTICS_NOT_SET;
}

export function localeFromPath(pathname: string | null | undefined): string {
  const match = pathname?.match(/^\/(en|zh)(?=\/|$)/);
  return match ? match[1] : ANALYTICS_NOT_SET;
}

export function sanitizeLocale(value: string | null | undefined): string {
  if (!value) return ANALYTICS_NOT_SET;
  const locale = value.trim().toLowerCase();
  return LOCALES.has(locale) ? locale : ANALYTICS_NOT_SET;
}

/**
 * Page family for coupon events. Same tokens as funnel page_group, with
 * /coupons and /plans named instead of falling through to `other`.
 */
export function couponPageFamily(pathname: string | null | undefined): string {
  if (!pathname) return ANALYTICS_NOT_SET;
  const group = pageGroup(pathname);
  if (group !== 'other') return group;
  const rest = pathname.split('?')[0].replace(/\/+$/, '').replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
  if (rest === '/coupons' || rest.startsWith('/coupons/')) return 'coupons';
  if (rest === '/plans' || rest.startsWith('/plans/')) return 'plans';
  return group;
}

export function couponEventParams(input: CouponEventInput): CouponEventParams {
  const provider = sanitizeAnalyticsSlug(input.providerSlug) ?? ANALYTICS_NOT_SET;
  const channel = sanitizeAnalyticsSlug(input.channelSlug) ?? provider;
  const locale = sanitizeLocale(input.locale);
  return {
    provider_slug: provider,
    channel_slug: channel,
    coupon_id: sanitizeCouponId(input.couponId) ?? ANALYTICS_NOT_SET,
    placement: sanitizeCouponPlacement(input.placement),
    page_family: couponPageFamily(input.pathname),
    locale: locale !== ANALYTICS_NOT_SET ? locale : localeFromPath(input.pathname),
    action: input.action === 'copy' ? 'copy' : 'outbound',
  };
}

/** data-* attrs for coupon offer <a> tags, including outbound channel tags. */
export function couponOutboundDataset(input: Omit<CouponEventInput, 'action'>): Record<string, string> {
  const attrs = outboundChannelDataset({
    channelSlug: input.channelSlug ?? input.providerSlug,
    channelType: input.channelType,
    modelSlug: input.modelSlug,
  });
  const couponId = sanitizeCouponId(input.couponId);
  const placement = sanitizeCouponPlacement(input.placement);
  const provider = sanitizeAnalyticsSlug(input.providerSlug);
  attrs['data-link-source'] = 'coupon';
  if (couponId) attrs['data-coupon-id'] = couponId;
  if (placement !== ANALYTICS_NOT_SET) attrs['data-coupon-placement'] = placement;
  if (provider) attrs['data-provider-slug'] = provider;
  return attrs;
}

export function readCouponOutbound(dataset: {
  linkSource?: string;
  couponId?: string;
  couponPlacement?: string;
  providerSlug?: string;
  channelSlug?: string;
}): {
  isCoupon: boolean;
  coupon_id: string;
  placement: string;
  provider_slug: string;
  channel_slug: string;
} {
  const couponId = sanitizeCouponId(dataset.couponId);
  const isCoupon = dataset.linkSource === 'coupon' || couponId != null;
  const provider = sanitizeAnalyticsSlug(dataset.providerSlug) ?? ANALYTICS_NOT_SET;
  return {
    isCoupon,
    coupon_id: couponId ?? ANALYTICS_NOT_SET,
    placement: sanitizeCouponPlacement(dataset.couponPlacement),
    provider_slug: provider,
    channel_slug: sanitizeAnalyticsSlug(dataset.channelSlug) ?? provider,
  };
}

function paramsForBrowser(input: Omit<CouponEventInput, 'action'> & { action: CouponAnalyticsAction }): CouponEventParams {
  const pathname = input.pathname
    ?? (typeof window !== 'undefined' ? window.location.pathname : null);
  return couponEventParams({ ...input, pathname });
}

export function trackCouponClick(input: Omit<CouponEventInput, 'action'>): void {
  trackAnalyticsEvent('coupon_click', paramsForBrowser({ ...input, action: 'outbound' }));
}

export function trackCouponCopy(input: Omit<CouponEventInput, 'action'>): void {
  trackAnalyticsEvent('coupon_copy', paramsForBrowser({ ...input, action: 'copy' }));
}
