import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/plans';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');

    return NextResponse.json(await getPlans({
      tier: searchParams.get('tier'),
      pricingModel: searchParams.get('pricing_model'),
      providerId: providerId ? parseInt(providerId) : null,
      includeModels: searchParams.get('include_models') === 'true',
    }));
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
