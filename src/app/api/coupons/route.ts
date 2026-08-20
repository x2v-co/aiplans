import { NextResponse } from 'next/server';
import { getCoupons } from '@/lib/coupons';

export async function GET() {
  try {
    return NextResponse.json(await getCoupons());
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}
