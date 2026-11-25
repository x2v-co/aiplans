import { sql } from '@/lib/db';
import type { RawChannelQuote } from '@/lib/citable-price-facts';

/**
 * Read-only selection for the public citation file.
 * Internal ids, notes, invites, and non-official channels stay out of the query.
 */
export async function loadOfficialChannelRows(): Promise<RawChannelQuote[]> {
  return sql<RawChannelQuote[]>`
    SELECT m.slug AS model_slug,
           m.name AS model_name,
           p.slug AS provider_slug,
           p.name AS provider_name,
           p.type AS provider_type,
           p.pricing_url AS pricing_url,
           p.website AS website,
           c.currency AS currency,
           c.price_unit AS price_unit,
           c.input_price_per_1m AS input_price_per_1m,
           c.output_price_per_1m AS output_price_per_1m,
           c.cached_input_price_per_1m AS cached_input_price_per_1m,
           c.promo_ends_at AS promo_ends_at,
           c.regular_input_price_per_1m AS regular_input_price_per_1m,
           c.regular_output_price_per_1m AS regular_output_price_per_1m,
           c.regular_cached_input_price_per_1m AS regular_cached_input_price_per_1m,
           c.last_verified AS last_verified,
           c.is_available AS is_available,
           c.data_for_discount AS data_for_discount,
           m.replacement_model AS replacement_model
    FROM api_channel_prices c
    JOIN models m ON m.id = c.model_id
    JOIN providers p ON p.id = c.provider_id
    WHERE c.is_available = true
      AND p.type IN ('official', 'producer')
      AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
  `;
}
