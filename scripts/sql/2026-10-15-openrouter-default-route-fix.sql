-- Audit #5 / /tmp/apw/or_diff.txt (2026-10-15): all nine default-route mismatches.
-- Run after npm run migrate. Default rolls back after displaying before/after rows.
-- To apply, replace the final ROLLBACK with COMMIT (never execute both).
-- Prices are USD / 1M tokens. Default-route cache prices were not verified by
-- this audit: NULL + needs-verification note, never a floor endpoint's cache.
BEGIN;

CREATE TEMP TABLE audited_or_defaults (
  model_slug text PRIMARY KEY, openrouter_id text NOT NULL,
  input_price real NOT NULL, output_price real NOT NULL
) ON COMMIT DROP;
INSERT INTO audited_or_defaults VALUES
  ('~google-gemini-pro-latest', '~google/gemini-pro-latest', 2.0, 10.0),
  ('~z-ai-glm-latest', '~z-ai/glm-latest', 0.06, 4.4),
  ('glm-5.2', 'z-ai/glm-5.2', 0.037, 7.0),
  ('gpt-oss-120b', 'openai/gpt-oss-120b', 0.15, 0.6),
  ('~moonshotai-kimi-latest', '~moonshotai/kimi-latest', 0.32, 14.0),
  ('kimi-k3', 'moonshotai/kimi-k3', 0.45, 15.0),
  ('mistral-large-batch', 'mistralai/mistral-large', 2.0, 6.0),
  ('qwen-qwen3-6-35b-a3b', 'qwen/qwen3.6-35b-a3b', 0.15, 1.0),
  ('qwen-qwen3-8-27b', 'qwen/qwen3.8-27b', 0.24, 2.2);

-- Fail closed on missing/duplicate matches; no provider IDs are hardcoded.
DO $$
BEGIN
  IF EXISTS (
    SELECT a.model_slug FROM audited_or_defaults a
    LEFT JOIN models m ON m.slug = a.model_slug
    LEFT JOIN api_channel_prices cp ON cp.model_id = m.id
      AND cp.provider_id IN (SELECT id FROM providers WHERE slug = 'openrouter')
    GROUP BY a.model_slug HAVING count(cp.id) <> 1
  ) THEN
    RAISE EXCEPTION 'Expected exactly one OpenRouter channel for each of the nine audited slugs; nothing committed';
  END IF;
END $$;

SELECT m.slug, cp.input_price_per_1m AS old_input, cp.output_price_per_1m AS old_output,
       a.input_price AS default_input, a.output_price AS default_output
FROM audited_or_defaults a JOIN models m ON m.slug = a.model_slug
JOIN api_channel_prices cp ON cp.model_id = m.id
JOIN providers p ON p.id = cp.provider_id AND p.slug = 'openrouter'
ORDER BY m.slug;

UPDATE api_channel_prices cp
SET input_price_per_1m = a.input_price, output_price_per_1m = a.output_price,
    cached_input_price_per_1m = NULL, currency = 'USD', price_unit = 'per_1m_tokens',
    notes = 'OpenRouter model-level default route price from /api/v1/models. Audit 2026-10-15: '
      || a.openrouter_id || '. Default-route cache price needs-verification (NULL); next scrape reads the API. Cheapest endpoints are separate variants.',
    updated_at = now()
FROM audited_or_defaults a, models m, providers p
WHERE m.slug = a.model_slug AND cp.model_id = m.id
  AND p.id = cp.provider_id AND p.slug = 'openrouter'
  AND (cp.input_price_per_1m IS DISTINCT FROM a.input_price
    OR cp.output_price_per_1m IS DISTINCT FROM a.output_price
    OR cp.cached_input_price_per_1m IS NOT NULL
    OR cp.currency IS DISTINCT FROM 'USD' OR cp.price_unit IS DISTINCT FROM 'per_1m_tokens'
    OR cp.notes NOT LIKE '%Audit 2026-10-15:%' OR cp.notes IS NULL);

UPDATE api_channel_price_variants v
SET input_price_per_1m = a.input_price, output_price_per_1m = a.output_price,
    cached_input_price_per_1m = NULL, currency = 'USD', price_unit = 'per_1m_tokens',
    variant_kind = 'default_route', source_url = 'https://openrouter.ai/api/v1/models',
    headline_reason = 'OpenRouter model-level default route price from /api/v1/models.',
    raw_json = jsonb_build_object('id', a.openrouter_id, 'audit', '2026-10-15',
      'input_per_1m', a.input_price, 'output_per_1m', a.output_price),
    notes = 'Audit 2026-10-15 default route correction. Default-route cache price needs-verification (NULL).',
    updated_at = now()
FROM audited_or_defaults a, models m, providers p
WHERE m.slug = a.model_slug AND v.model_id = m.id
  AND p.id = v.provider_id AND p.slug = 'openrouter' AND v.variant_key = 'openrouter-auto'
  AND (v.input_price_per_1m IS DISTINCT FROM a.input_price
    OR v.output_price_per_1m IS DISTINCT FROM a.output_price
    OR v.cached_input_price_per_1m IS NOT NULL
    OR v.headline_reason IS DISTINCT FROM 'OpenRouter model-level default route price from /api/v1/models.'
    OR v.source_url IS DISTINCT FROM 'https://openrouter.ai/api/v1/models');

SELECT m.slug, cp.input_price_per_1m, cp.output_price_per_1m, cp.cached_input_price_per_1m, cp.notes
FROM audited_or_defaults a JOIN models m ON m.slug = a.model_slug
JOIN api_channel_prices cp ON cp.model_id = m.id
JOIN providers p ON p.id = cp.provider_id AND p.slug = 'openrouter'
ORDER BY m.slug;

-- Default dry-run choice:
ROLLBACK;
-- Apply choice (replace ROLLBACK above):
-- COMMIT;
