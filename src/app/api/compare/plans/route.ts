import { NextRequest, NextResponse } from 'next/server';
import type { CurrencyCode } from '@/lib/currency';
import { getPlanComparison } from '@/lib/compare-plans';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelSlug = searchParams.get('model');
  const displayCurrency = (searchParams.get('currency') || 'USD') as CurrencyCode;

  if (!modelSlug) {
    return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
  }

  try {
    const comparison = await getPlanComparison(modelSlug, displayCurrency);

    if (!comparison) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const response = NextResponse.json(comparison);

    // Cache for 5 minutes (pricing data doesn't change frequently)
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return response;
  } catch (error) {
    console.error('Error fetching plan comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
