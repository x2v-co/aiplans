import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const data = await sql`
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

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}
