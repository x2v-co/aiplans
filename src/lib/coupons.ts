import { sql } from '@/lib/db';
import type { CouponOffer } from '@/lib/coupon-format';

export type { CouponOffer };

/**
 * Community discount codes, newest and most trustworthy first.
 *
 * Extracted out of `app/api/coupons/route.ts` so /[locale]/coupons can render
 * them on the server instead of fetching from an effect — that left crawlers
 * with 32 characters and a spinner.
 */

export type CouponScope = 'plan' | 'api';

export interface Coupon {
  id: number;
  code: string;
  provider_id: number;
  description: string;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
  offer_url: string | null;
  scope: CouponScope;
  is_verified: boolean;
  providers: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    logo_url?: string | null;
    website?: string | null;
  };
}

/** Lightweight coupon payload carried to site-wide CTA badges (type in coupon-format). */

export async function getCoupons(): Promise<Coupon[]> {
  const rows = await sql<Coupon[]>`
    SELECT
      c.*,
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'logo', p.logo,
        'logo_url', p.logo_url,
        'website', p.website
      ) END AS providers
    FROM coupons c
    LEFT JOIN providers p ON p.id = c.provider_id
    ORDER BY c.is_verified DESC, c.discount_value DESC
  `;

  return [...rows];
}

/**
 * Active verified coupons for one surface class, grouped by provider slug.
 * Used by the coupon badges next to provider CTAs: 'plan' coupons
 * (subscription discounts) only on plan surfaces, 'api' coupons (token
 * credits/API discounts) only on token-pricing surfaces.
 *
 * NULL expires_at means "no published expiry", the same convention the
 * /coupons page uses. INNER JOIN: an orphaned coupon has no key and never
 * renders. Ordered strongest-first so badge label and popover order are
 * deterministic.
 */
export async function getActiveCouponMap(
  scope: CouponScope,
): Promise<Record<string, CouponOffer[]>> {
  const rows = await sql<CouponOffer[]>`
    SELECT
      c.id                                              AS id,
      c.code                                            AS code,
      c.provider_id                                     AS "providerId",
      p.slug                                            AS "providerSlug",
      c.description                                     AS description,
      c.discount_type                                   AS "discountType",
      c.discount_value                                  AS "discountValue",
      c.expires_at                                      AS "expiresAt",
      c.offer_url                                       AS "offerUrl",
      c.scope                                           AS scope
    FROM coupons c
    JOIN providers p ON p.id = c.provider_id
    WHERE c.scope = ${scope}
      AND c.is_verified = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
    ORDER BY c.discount_value DESC NULLS LAST, c.id ASC
  `;

  const map: Record<string, CouponOffer[]> = {};
  for (const row of rows) {
    (map[row.providerSlug] ??= []).push(row);
  }
  return map;
}
