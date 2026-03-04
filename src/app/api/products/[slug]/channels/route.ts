import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/products/[slug]/channels - 核心API: 同一模型各渠道价格对比
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 获取产品信息
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();

    if (productError) throw productError;

    // 获取该产品在所有渠道的价格
    const { data: channelPrices, error: pricesError } = await supabase
      .from('channel_prices')
      .select(`
        *,
        channels:channel_id (
          id,
          name,
          slug,
          type,
          logo,
          website,
          region,
          access_from_china,
          description
        )
      `)
      .eq('product_id', product.id)
      .eq('is_available', true)
      .order('input_price_per_1m', { ascending: true });

    if (pricesError) throw pricesError;

    // 计算价格对比数据
    const enrichedPrices = channelPrices?.map((cp: any) => {
      const officialPrice = channelPrices?.find(
        (p: any) => p.channels.type === 'official'
      );
      const officialInputPrice = officialPrice?.input_price_per_1m || cp.input_price_per_1m;
      const officialOutputPrice = officialPrice?.output_price_per_1m || cp.output_price_per_1m;

      const savingsInput = officialPrice
        ? ((officialInputPrice - cp.input_price_per_1m) / officialInputPrice) * 100
        : 0;

      // 估算费用 (轻度使用: 10万tokens, 中度: 100万, 重度: 1000万)
      const estimatedCost = {
        light: (cp.input_price_per_1m * 0.1 + cp.output_price_per_1m * 0.05) / 100,
        medium: (cp.input_price_per_1m * 1 + cp.output_price_per_1m * 0.5) / 100,
        heavy: (cp.input_price_per_1m * 10 + cp.output_price_per_1m * 5) / 100,
      };

      return {
        ...cp,
        savingsVsOfficial: savingsInput > 0 ? savingsInput.toFixed(1) : '0.0',
        isCheapest: channelPrices && channelPrices[0]?.id === cp.id,
        estimatedCost,
      };
    });

    return NextResponse.json({
      product,
      channelPrices: enrichedPrices,
      cheapest: enrichedPrices?.[0],
      officialChannel: channelPrices?.find((cp: any) => cp.channels.type === 'official'),
    });
  } catch (error) {
    console.error('Error fetching channel prices:', error);
    return NextResponse.json({ error: 'Failed to fetch channel prices' }, { status: 500 });
  }
}
