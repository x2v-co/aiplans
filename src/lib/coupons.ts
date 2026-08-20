import { sql } from '@/lib/db';

/**
 * Community discount codes, newest and most trustworthy first.
 *
 * Extracted out of `app/api/coupons/route.ts` so /[locale]/coupons can render
 * them on the server instead of fetching from an effect — that left crawlers
 * with 32 characters and a spinner.
 */

export interface Coupon {
  id: number;
  code: string;
  provider_id: number;
  description: string;
  discount_type: string;
  discount_value: number;
  expires_at: string;
  is_verified: boolean;
  providers: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    logo_url?: string;
  };
}

export async function getCoupons(): Promise<Coupon[]> {
  const rows = await sql<Coupon[]>`
    SELECT
      c.*,
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'logo', p.logo
      ) END AS providers
    FROM coupons c
    LEFT JOIN providers p ON p.id = c.provider_id
    ORDER BY c.is_verified DESC, c.discount_value DESC
  `;

  return [...rows];
}
