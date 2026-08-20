import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/products';

// The response varies by query string, so it cannot be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');

    return NextResponse.json(await getProducts({
      type: searchParams.get('type'),
      providerId: providerId ? parseInt(providerId) : null,
      featured: searchParams.get('featured') === 'true',
      includePlanCount: searchParams.get('include_plan_count') === 'true',
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
