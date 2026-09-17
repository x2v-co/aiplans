import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPrimaryProvidersForModels, getProvidersByIds } from '@/lib/schema-adapters';

// GET /api/channels/[productId] - 某模型渠道价格
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const productIdNum = parseInt(productId);

    const data = await sql<any[]>`
      SELECT
        cp.*,
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
          'region', p.region,
          'access_from_china', p.access_from_china,
          'logo', p.logo
        ) AS providers,
        jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'slug', m.slug,
          'provider_ids', m.provider_ids
        ) AS models
      FROM api_channel_prices cp
      JOIN providers p ON p.id = cp.provider_id
      JOIN models m ON m.id = cp.model_id
      WHERE cp.model_id = ${productIdNum}
        AND cp.is_available = true
      ORDER BY cp.input_price_per_1m ASC NULLS LAST
    `;

    // If we have data, fetch the model's official providers separately
    if (data && data.length > 0 && data[0].models) {
      const primaryProviders = await getPrimaryProvidersForModels([data[0].models as any]);
      const providerIds = data[0].models.provider_ids || [];
      const providersById = await getProvidersByIds(providerIds);
      data[0].models.provider = primaryProviders.get(data[0].models.id) || null;
      data[0].models.providers = providerIds
        .map((id: number) => providersById.get(id))
        .filter(Boolean);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching channel prices:', error);
    return NextResponse.json({ error: 'Failed to fetch channel prices' }, { status: 500 });
  }
}
