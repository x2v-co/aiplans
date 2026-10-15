import { effectivePrice } from '@/lib/effective-price';
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
    const rawPrices = await sql<any[]>`
      SELECT
        cp.*,
        (to_jsonb(cp)->>'data_for_discount')::boolean AS data_for_discount,
        to_jsonb(cp)->>'data_for_discount_note' AS data_for_discount_note,
        to_jsonb(cp)->>'quota_unit' AS quota_unit,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', v.id,
            'variant_key', v.variant_key,
            'variant_name', v.variant_name,
            'variant_kind', v.variant_kind,
            'input_price_per_1m', v.input_price_per_1m,
            'output_price_per_1m', v.output_price_per_1m,
            'cached_input_price_per_1m', v.cached_input_price_per_1m,
            'currency', v.currency,
            'price_unit', v.price_unit,
            'is_headline', v.is_headline,
            'headline_reason', v.headline_reason,
            'constraints_json', v.constraints_json
          ) ORDER BY v.is_headline DESC, v.headline_rank ASC NULLS LAST, v.input_price_per_1m ASC NULLS LAST)
          FROM api_channel_price_variants v
          WHERE v.model_id = cp.model_id
            AND v.provider_id = cp.provider_id
            AND v.is_available = true
            AND v.is_public = true
        ), '[]'::jsonb) AS price_variants,
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
        AND EXISTS (SELECT 1 FROM models m WHERE m.id = cp.model_id
          AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date))
      ORDER BY cp.input_price_per_1m ASC NULLS LAST
    `;

    const now = new Date();
    const channelPrices = rawPrices.map(cp => effectivePrice(cp, now))
      .sort((a, b) => (a.input_price_per_1m ?? Infinity) - (b.input_price_per_1m ?? Infinity));

    // 计算价格对比数据
    const enrichedPrices = channelPrices.map((cp: any) => {
      const officialPrice = channelPrices.find(
        (p: any) => p.providers?.type === 'official' || p.providers?.type === 'producer'
      );
      const officialInputPrice = officialPrice?.input_price_per_1m || cp.input_price_per_1m;


      const savingsInput = officialPrice?.input_price_per_1m != null && cp.input_price_per_1m != null && officialInputPrice > 0
        ? ((officialInputPrice - cp.input_price_per_1m) / officialInputPrice) * 100
        : 0;

      // 估算费用 (轻度使用: 10万tokens, 中度: 100万, 重度: 1000万)
      const estimatedCost = cp.input_price_per_1m == null || cp.output_price_per_1m == null ? null : {
        light: cp.input_price_per_1m * 0.1 + cp.output_price_per_1m * 0.05,
        medium: cp.input_price_per_1m + cp.output_price_per_1m * 0.5,
        heavy: cp.input_price_per_1m * 10 + cp.output_price_per_1m * 5,
      };

      return {
        ...cp,
        savingsVsOfficial: savingsInput > 0 ? savingsInput.toFixed(1) : '0.0',
        isCheapest: cp.input_price_per_1m != null && channelPrices[0]?.id === cp.id,
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
