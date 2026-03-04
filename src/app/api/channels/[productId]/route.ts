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

    const { data, error } = await supabase
      .from('channel_prices')
      .select(`
        *,
        channels:channel_id (
          id,
          name,
          slug,
          type,
          region,
          access_from_china,
          provider_id,
          providers:provider_id (
            logo_url
          )
        ),
        products:product_id (
          id,
          name,
          slug,
          providers:provider_id (
            id,
            name,
            slug,
            logo_url
          )
        )
      `)
      .eq('product_id', productIdNum)
      .eq('is_available', true)
      .order('input_price_per_1m', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching channel prices:', error);
    return NextResponse.json({ error: 'Failed to fetch channel prices' }, { status: 500 });
  }
}
