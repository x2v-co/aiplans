import { sql } from '@/lib/db';
import type { RawChannelQuote } from '@/lib/citable-price-facts';

/** Read-only researched variants; no headline scope is inferred when variants are absent. */
export async function loadOfficialChannelRows(): Promise<RawChannelQuote[]> {
  return sql<RawChannelQuote[]>`
    SELECT m.slug AS model_slug,
           m.name AS model_name,
           p.slug AS provider_slug,
           p.name AS provider_name,
           p.type AS provider_type,
           p.pricing_url AS pricing_url,
           v.source_url AS source_url,
           v.currency AS currency,
           v.price_unit AS price_unit,
           v.input_price_per_1m AS input_price_per_1m,
           v.output_price_per_1m AS output_price_per_1m,
           v.cached_input_price_per_1m AS cached_input_price_per_1m,
           v.last_verified AS last_verified,
           v.is_available AS is_available,
           v.is_public AS is_public,
           v.is_self_service AS is_self_service,
           v.is_partner_only AS is_partner_only,
           v.variant_key AS variant_key,
           v.variant_kind AS variant_kind,
           v.constraints_json AS constraints_json,
           v.notes AS variant_notes,
           c.notes AS channel_notes,
           c.data_for_discount AS data_for_discount,
           m.replacement_model AS replacement_model,
           m.shutdown_date AS shutdown_date
    FROM api_channel_price_variants v
    JOIN api_channel_prices c ON c.model_id = v.model_id AND c.provider_id = v.provider_id
    JOIN models m ON m.id = v.model_id
    JOIN providers p ON p.id = v.provider_id
    WHERE c.is_available = true
      AND v.is_available = true
      AND p.type IN ('official', 'producer')
      AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
  `;
}
