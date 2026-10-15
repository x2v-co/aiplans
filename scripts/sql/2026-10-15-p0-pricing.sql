-- Audit A2 #2-#4. Review SELECT results; default ROLLBACK. No invented base prices.
-- Run with psql -X -v ON_ERROR_STOP=1 -f ... . Change ONLY final ROLLBACK to COMMIT to apply.
BEGIN;

-- Fail before touching anything if required official catalog identities are absent/ambiguous.
DO $$ BEGIN
  IF (SELECT count(*) FROM providers WHERE slug = 'google' AND type IN ('official','producer')) <> 1
     OR (SELECT count(*) FROM providers WHERE slug = 'anthropic' AND type IN ('official','producer')) <> 1 THEN
    RAISE EXCEPTION 'Expected unique official google and anthropic providers; nothing applied';
  END IF;
END $$;

-- Mini is only mentioned as sitemap evidence; do not assign its family's date.
UPDATE models SET description = concat_ws(E'\n', description,
  '[needs-verification] Codex Mini shutdown date is not established by the 2026-10-15 audit; verify official deprecations.')
WHERE slug = 'gpt-5.1-codex-mini' AND COALESCE(description, '') NOT LIKE '%[needs-verification] Codex Mini shutdown date%';

-- SubQ Snap is an API, not a monthly subscription. No access/release specs inferred.
INSERT INTO providers (name, slug, website, pricing_url, type, region, currency, access_from_china, notes)
VALUES ('SubQ', 'subq', 'https://subq.ai', 'https://subq.ai/introducing-subq-snap', 'official', NULL, 'USD', NULL,
        'Public Preview. Source: https://subq.ai/introducing-subq-snap')
ON CONFLICT (slug) DO UPDATE SET website = EXCLUDED.website, pricing_url = EXCLUDED.pricing_url,
  type = EXCLUDED.type, notes = EXCLUDED.notes;

INSERT INTO models (name, slug, type, model_category, context_window, provider_ids, offical_link, description)
SELECT 'SubQ Snap', 'subq-snap', 'llm', 'text', 384000, ARRAY[id],
       'https://subq.ai/introducing-subq-snap', 'Public Preview; API input $0.05/M, output free.'
FROM providers WHERE slug = 'subq'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, model_category = EXCLUDED.model_category, context_window = EXCLUDED.context_window,
  provider_ids = EXCLUDED.provider_ids, offical_link = EXCLUDED.offical_link, description = EXCLUDED.description;

DELETE FROM model_plan_mapping WHERE plan_id IN
  (SELECT p.id FROM plans p JOIN providers pr ON pr.id = p.provider_id WHERE pr.slug = 'subq' AND p.slug = 'subq-snap');
UPDATE usage_prices SET plan_id = NULL WHERE plan_id IN
  (SELECT p.id FROM plans p JOIN providers pr ON pr.id = p.provider_id WHERE pr.slug = 'subq' AND p.slug = 'subq-snap');
DELETE FROM plans p USING providers pr WHERE p.provider_id = pr.id AND pr.slug = 'subq' AND p.slug = 'subq-snap';

-- Guard legacy schemas without channel uniqueness constraints; never hide duplicates.
DO $$ BEGIN
  IF EXISTS (SELECT cp.model_id, cp.provider_id FROM api_channel_prices cp
    JOIN models m ON m.id = cp.model_id JOIN providers p ON p.id = cp.provider_id
    WHERE (m.slug = 'subq-snap' AND p.slug = 'subq') OR (m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic')
    GROUP BY cp.model_id, cp.provider_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate target channels; review before applying';
  END IF;
END $$;
UPDATE api_channel_prices cp SET input_price_per_1m = 0.05, output_price_per_1m = 0,
  currency = 'USD', price_unit = 'per_1m_tokens', is_available = true,
  notes = 'Public Preview. Source: https://subq.ai/introducing-subq-snap', last_verified = '2026-10-15'
FROM models m, providers p WHERE cp.model_id = m.id AND cp.provider_id = p.id AND m.slug = 'subq-snap' AND p.slug = 'subq';
INSERT INTO api_channel_prices (model_id, provider_id, input_price_per_1m, output_price_per_1m, currency, price_unit, is_available, notes, last_verified)
SELECT m.id, p.id, 0.05, 0, 'USD', 'per_1m_tokens', true,
       'Public Preview. Source: https://subq.ai/introducing-subq-snap', '2026-10-15'
FROM models m, providers p WHERE m.slug = 'subq-snap' AND p.slug = 'subq'
  AND NOT EXISTS (SELECT 1 FROM api_channel_prices cp WHERE cp.model_id = m.id AND cp.provider_id = p.id);

-- Google: replace the legacy Ultra row with 5x, preserve its mappings, add 20x.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM plans p JOIN providers pr ON pr.id = p.provider_id
    WHERE pr.slug = 'google' AND p.slug IN ('google-ai-ultra','google-ai-ultra-5x')
    GROUP BY p.provider_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Both old and canonical Ultra rows exist; review mappings first';
  END IF;
END $$;
UPDATE plans SET slug = 'google-ai-ultra-5x' WHERE slug = 'google-ai-ultra'
  AND provider_id = (SELECT id FROM providers WHERE slug = 'google');
UPDATE plans SET price = NULL, annual_price = NULL, price_yearly_monthly = NULL, currency = NULL,
  region = 'needs-verification', last_verified = NULL, is_contact_sales = false,
  notes = '[needs-verification] Region/currency for Plus $6.98 / Pro $28.99 unverified; prices withheld. Source: https://gemini.google/subscriptions/'
WHERE provider_id = (SELECT id FROM providers WHERE slug = 'google')
  AND slug IN ('google-ai-plus', 'gemini-advanced', 'google-ai-pro');

INSERT INTO plans (provider_id, name, slug, pricing_model, price, currency, region, price_unit,
  tier, plan_kind, plan_category, plan_line, tier_rank, is_official, is_contact_sales, source, notes, last_verified)
SELECT p.id, v.name, v.slug, 'subscription', v.price, 'USD', 'US', 'per_month',
  'pro', 'chat', 'chatbot', 'google-one', v.rank, true, false, 'manual',
  'US consumer tier. Source: https://gemini.google/subscriptions/', '2026-10-15'
FROM providers p CROSS JOIN (VALUES ('Google AI Ultra (5x)', 'google-ai-ultra-5x', 99.99, 3),
  ('Google AI Ultra (20x)', 'google-ai-ultra-20x', 199.99, 4)) v(name, slug, price, rank)
WHERE p.slug = 'google' AND NOT EXISTS (SELECT 1 FROM plans pl WHERE pl.provider_id = p.id AND pl.slug = v.slug);
UPDATE plans pl SET name = v.name, price = v.price, annual_price = NULL, price_yearly_monthly = NULL,
  currency = 'USD', region = 'US', tier = 'pro', is_contact_sales = false, source = 'manual',
  plan_kind = 'chat', plan_category = 'chatbot', plan_line = 'google-one', tier_rank = v.rank,
  notes = 'US consumer tier. Source: https://gemini.google/subscriptions/', last_verified = '2026-10-15'
FROM providers p, (VALUES ('Google AI Ultra (5x)', 'google-ai-ultra-5x', 99.99, 3),
  ('Google AI Ultra (20x)', 'google-ai-ultra-20x', 199.99, 4)) v(name, slug, price, rank)
WHERE pl.provider_id = p.id AND p.slug = 'google' AND pl.slug = v.slug;
-- Retain the same selector for both Ultra rungs; do not invent model entitlements.
UPDATE plans p20 SET model_selector = p5.model_selector
FROM plans p5 WHERE p20.provider_id = p5.provider_id
  AND p20.provider_id = (SELECT id FROM providers WHERE slug = 'google')
  AND p20.slug = 'google-ai-ultra-20x' AND p5.slug = 'google-ai-ultra-5x';

-- Haiku: exact canonical slug only. No OR prices reused as official <=100K prices.
INSERT INTO models (name, slug, type, model_category, provider_ids, offical_link)
SELECT 'Claude Haiku 5.5', 'claude-haiku-5.5', 'llm', 'text', ARRAY[id],
  'https://platform.claude.com/docs/en/about-claude/pricing' FROM providers WHERE slug = 'anthropic'
ON CONFLICT (slug) DO NOTHING;
UPDATE api_channel_prices cp SET input_price_per_1m = NULL, output_price_per_1m = NULL,
  cached_input_price_per_1m = NULL, currency = 'USD', price_unit = 'per_1m_tokens', is_available = true,
  notes = '[needs-verification] Official <=100K prompt input/output not stated in audit. >100K: $0.50/$2.50; batch >100K: $0.25/$1.25 per 1M. Source: https://platform.claude.com/docs/en/about-claude/pricing',
  last_verified = NULL
FROM models m, providers p WHERE cp.model_id = m.id AND cp.provider_id = p.id AND m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic';
INSERT INTO api_channel_prices (model_id, provider_id, input_price_per_1m, output_price_per_1m, currency, price_unit, is_available, notes)
SELECT m.id, p.id, NULL, NULL, 'USD', 'per_1m_tokens', true,
  '[needs-verification] Official <=100K prompt input/output not stated in audit. >100K: $0.50/$2.50; batch >100K: $0.25/$1.25 per 1M. Source: https://platform.claude.com/docs/en/about-claude/pricing'
FROM models m, providers p WHERE m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic'
  AND NOT EXISTS (SELECT 1 FROM api_channel_prices cp WHERE cp.model_id = m.id AND cp.provider_id = p.id);

INSERT INTO api_channel_price_variants (model_id, provider_id, variant_key, variant_name, variant_kind,
  input_price_per_1m, output_price_per_1m, currency, price_unit, is_available, is_public, is_headline,
  constraints_json, source_url, last_verified)
SELECT m.id, p.id, v.key, v.name, v.kind, v.input, v.output, 'USD', 'per_1m_tokens', true, true, false,
  jsonb_build_object('prompt_tokens_gt', 100000, 'processing', v.processing),
  'https://platform.claude.com/docs/en/about-claude/pricing', '2026-10-15'
FROM models m, providers p CROSS JOIN (VALUES
  ('prompt-gt-100k', '>100K prompt', 'context_band', 0.50, 2.50, 'standard'),
  ('batch-prompt-gt-100k', 'Batch >100K prompt', 'batch', 0.25, 1.25, 'batch')) v(key, name, kind, input, output, processing)
WHERE m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic'
ON CONFLICT (model_id, provider_id, variant_key) DO UPDATE SET
  variant_name = EXCLUDED.variant_name, variant_kind = EXCLUDED.variant_kind,
  input_price_per_1m = EXCLUDED.input_price_per_1m, output_price_per_1m = EXCLUDED.output_price_per_1m,
  currency = EXCLUDED.currency, constraints_json = EXCLUDED.constraints_json,
  source_url = EXCLUDED.source_url, is_available = true, is_headline = false, last_verified = EXCLUDED.last_verified;

SELECT p.slug AS provider, m.slug AS model, cp.input_price_per_1m, cp.output_price_per_1m, cp.notes
FROM api_channel_prices cp JOIN models m ON m.id = cp.model_id JOIN providers p ON p.id = cp.provider_id
WHERE (m.slug = 'subq-snap' AND p.slug = 'subq') OR (m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic');
SELECT pl.slug, pl.price, pl.currency, pl.region, pl.tier, pl.notes FROM plans pl JOIN providers p ON p.id = pl.provider_id
WHERE p.slug = 'google' AND pl.slug IN ('google-ai-plus','gemini-advanced','google-ai-pro','google-ai-ultra-5x','google-ai-ultra-20x');
SELECT v.variant_key, v.input_price_per_1m, v.output_price_per_1m, v.constraints_json
FROM api_channel_price_variants v JOIN models m ON m.id = v.model_id JOIN providers p ON p.id = v.provider_id
WHERE m.slug = 'claude-haiku-5.5' AND p.slug = 'anthropic';

-- Choice: keep ROLLBACK for dry-run; replace it with COMMIT only after reviewing results.
ROLLBACK;
-- COMMIT;
