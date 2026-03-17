import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/channels/[productId] - 某模型渠道价格
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const productIdNum = parseInt(productId);

    // First, get channel prices with provider info
    const { data, error } = await supabase
      .from('api_channel_prices')
      .select(`
        *,
        providers:provider_id (
          id,
          name,
          slug,
          type,
          region,
          access_from_china,
          logo
        ),
        models:model_id (
          id,
          name,
          slug,
          provider_ids
        )
      `)
      .eq('model_id', productIdNum)
      .eq('is_available', true)
      .not('provider_id', 'is', null)
      .order('input_price_per_1m', { ascending: true });

    if (error) throw error;

    // If we have data, fetch the model's official providers separately
    if (data && data.length > 0 && data[0].models?.provider_ids?.length > 0) {
      const providerIds = data[0].models.provider_ids;
      const { data: officialProviders } = await supabase
        .from('providers')
        .select('id, name, slug, logo')
        .in('id', providerIds);

      // Attach official providers to the model
      if (officialProviders) {
        data[0].models.providers = officialProviders;
      }
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching channel prices:', error);
    return NextResponse.json({ error: 'Failed to fetch channel prices' }, { status: 500 });
  }
}
