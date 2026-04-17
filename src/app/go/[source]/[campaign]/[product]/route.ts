import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { REFERRAL_LINKS } from '@/config/referral-links';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { onnotice: () => {} })
  : null;

type Params = { source: string; campaign: string; product: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { source, campaign, product } = await params;

  const dest = REFERRAL_LINKS[product];
  if (!dest) {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  if (sql) {
    try {
      await sql`
        INSERT INTO clicks (utm_source, utm_campaign, product)
        VALUES (${source}, ${campaign}, ${product})
      `;
    } catch (err) {
      console.error('[/go] click insert failed:', err);
    }
  }

  return NextResponse.redirect(dest, 302);
}
