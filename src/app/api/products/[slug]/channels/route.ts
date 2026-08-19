import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPrimaryProvidersForModels } from '@/lib/schema-adapters';

// GET /api/products/[slug]/channels - 核心API: 同一模型各渠道价格对比
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const [product] = await sql<any[]>`
      SELECT * FROM models WHERE slug = ${slug} LIMIT 1
    `;
    if (!product) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const modelProviders = await getPrimaryProvidersForModels([product as any]);
    const productWithProvider = {
      ...product,
      providers: modelProviders.get(product.id) || null,
    };

    // 获取该模型在所有渠道的价格
    const channelPrices = await sql<any[]>`
      SELECT
        cp.*,
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'type', p.type,
          'logo', p.logo,
          'website', p.website,
          'region', p.region,
          'access_from_china', p.access_from_china,
          'description', p.description
        ) AS providers
      FROM api_channel_prices cp
      JOIN providers p ON p.id = cp.provider_id
      WHERE cp.model_id = ${product.id}
        AND cp.is_available = true
      ORDER BY cp.input_price_per_1m ASC NULLS LAST
    `;

    // 计算价格对比数据
    const enrichedPrices = channelPrices.map((cp: any) => {
      const officialPrice = channelPrices.find(
        (p: any) => p.providers?.type === 'official' || p.providers?.type === 'producer'
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
        isCheapest: channelPrices[0]?.id === cp.id,
        estimatedCost,
      };
    });

    return NextResponse.json({
      product: productWithProvider,
      channelPrices: enrichedPrices,
      cheapest: enrichedPrices[0],
      officialChannel: channelPrices.find((cp: any) => cp.providers?.type === 'official' || cp.providers?.type === 'producer'),
    });
  } catch (error) {
    console.error('Error fetching channel prices:', error);
    return NextResponse.json({ error: 'Failed to fetch channel prices' }, { status: 500 });
  }
}
