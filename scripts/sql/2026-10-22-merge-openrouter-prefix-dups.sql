-- Standalone, MANUAL repair. Not registered with the migration runner.
--
-- OpenRouter's scraper generates provider-prefixed slugs (`anthropic/claude-opus-4.5`
-- -> `anthropic-claude-opus-4-5`). For six models that were catalogued before the
-- prefix convention, the nightly scrape wrote the only live OpenRouter channel to
-- a NEW model row, so the canonical page kept a stale/unavailable OpenRouter row
-- and the token/SEO landing page for the copy has no official price at all.
--
-- Direction: keep the older, richer canonical row (it owns the official quote,
-- resellers and inbound links). Move the live OpenRouter channel + its variants
-- and history onto it, fill metadata nulls, 301 the prefixed slug, delete the copy.
--
-- Read-only preview happens before BEGIN. The transaction is guarded, backs every
-- touched row up into model_merge_backup_20261022 and COMMITs only after the
-- verification block passes; any exception rolls the whole repair back.

-- ── READ-ONLY PREVIEW ────────────────────────────────────────────────────────
WITH pairs(old_slug, new_slug) AS (VALUES
  ('anthropic-claude-opus-4-5', 'claude-opus-4.5'),
  ('anthropic-claude-sonnet-4-5', 'claude-sonnet-4.5'),
  ('anthropic-claude-haiku-5-5', 'claude-haiku-5.5'),
  ('minimax-minimax-m2-5', 'minimax-m2.5'),
  ('meta-muse-wonder', 'muse-wonder'),
  ('mistral-mistral-large-2512', 'mistral-large')
)
SELECT p.old_slug, om.id AS old_id, om.name AS old_name, om.context_window AS old_ctx,
       nm.id AS new_id, nm.name AS new_name, nm.context_window AS new_ctx,
       oc.id AS old_channel, oc.is_available AS old_live,
       nc.id AS new_channel, nc.is_available AS new_live,
       (SELECT count(*) FROM api_channel_price_variants v WHERE v.model_id = nm.id AND v.provider_id = 59) AS new_variants,
       (SELECT count(*) FROM model_plan_mapping mp WHERE mp.model_id = om.id) AS old_plan_links
FROM pairs p
LEFT JOIN models om ON om.slug = p.old_slug
LEFT JOIN models nm ON nm.slug = p.new_slug
LEFT JOIN api_channel_prices oc ON oc.model_id = om.id
LEFT JOIN api_channel_prices nc ON nc.model_id = nm.id AND nc.provider_id = 59
ORDER BY p.old_slug;

-- ── REPAIR ───────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS model_merge_backup_20261022 (
  source_table text NOT NULL,
  row_key text NOT NULL,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, row_key)
);

CREATE TEMP TABLE dup_targets (old_slug text PRIMARY KEY, new_slug text NOT NULL) ON COMMIT DROP;
INSERT INTO dup_targets VALUES
  ('anthropic-claude-opus-4-5', 'claude-opus-4.5'),
  ('anthropic-claude-sonnet-4-5', 'claude-sonnet-4.5'),
  ('anthropic-claude-haiku-5-5', 'claude-haiku-5.5'),
  ('minimax-minimax-m2-5', 'minimax-m2.5'),
  ('meta-muse-wonder', 'muse-wonder'),
  ('mistral-mistral-large-2512', 'mistral-large');

DO $$
BEGIN
  IF (SELECT count(*) FROM models m JOIN dup_targets t ON m.slug = t.new_slug) <> 6 THEN
    RAISE EXCEPTION 'Canonical rows missing; review before retrying';
  END IF;
  IF (SELECT count(*) FROM models m JOIN dup_targets t ON m.slug = t.old_slug) <> 6 THEN
    RAISE EXCEPTION 'Duplicate rows missing; already merged? review before retrying';
  END IF;
  -- Refuse unhandled FKs (including cascading), rather than lose data.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'models'::regclass
      AND NOT (
        c.conrelid IN ('api_channel_prices'::regclass, 'api_channel_price_variants'::regclass,
          'model_plan_mapping'::regclass, 'model_offical'::regclass, 'model_benchmark_scores'::regclass,
          'evaluation_run'::regclass, 'usage_prices'::regclass, 'coding_agent_scores'::regclass,
          'external_price_references'::regclass, 'model_slug_redirects'::regclass)
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'model_id')]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')]
      )
  ) THEN RAISE EXCEPTION 'Unhandled FK to models; extend the repair before proceeding'; END IF;
END $$;

CREATE TEMP TABLE dup_pairs ON COMMIT DROP AS
SELECT om.id AS source_id, nm.id AS target_id, oc.id AS source_channel, nc.id AS target_channel, t.old_slug, t.new_slug
FROM dup_targets t
JOIN models om ON om.slug = t.old_slug
JOIN models nm ON nm.slug = t.new_slug
JOIN api_channel_prices oc ON oc.model_id = om.id
LEFT JOIN api_channel_prices nc ON nc.model_id = nm.id AND nc.provider_id = oc.provider_id;

DO $$
BEGIN
  IF (SELECT count(*) FROM dup_pairs) <> 6 THEN
    RAISE EXCEPTION 'Each pair must have exactly one shared provider channel';
  END IF;
  -- The copy must be the live OpenRouter row; the canonical one must be stale.
  IF EXISTS (SELECT 1 FROM dup_pairs x JOIN api_channel_prices c ON c.id = x.source_channel WHERE NOT c.is_available) THEN
    RAISE EXCEPTION 'A duplicate OpenRouter channel is already unavailable; re-check the pair';
  END IF;
  IF EXISTS (SELECT 1 FROM dup_pairs x WHERE x.target_channel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM api_channel_prices c WHERE c.id = x.target_channel AND c.is_available = false)) THEN
    RAISE EXCEPTION 'A canonical OpenRouter channel is already live; do not merge blindly';
  END IF;
  IF EXISTS (SELECT 1 FROM model_slug_redirects r JOIN dup_targets t ON t.old_slug = r.old_slug) THEN
    RAISE EXCEPTION 'Old slug already has a redirect; review first';
  END IF;
END $$;

-- Back up every row this repair touches.
INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
SELECT 'models', m.id::text, to_jsonb(m) FROM models m JOIN dup_pairs x ON m.id IN (x.source_id, x.target_id);
INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
SELECT 'api_channel_prices', c.id::text, to_jsonb(c) FROM api_channel_prices c JOIN dup_pairs x ON c.id IN (x.source_channel, x.target_channel);
INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
SELECT 'api_channel_price_variants', v.id::text, to_jsonb(v) FROM api_channel_price_variants v JOIN dup_pairs x ON v.model_id IN (x.source_id, x.target_id) AND v.provider_id = 59;
INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
SELECT 'price_history', h.id::text, to_jsonb(h) FROM price_history h JOIN dup_pairs x ON h.channel_price_id IN (x.source_channel, x.target_channel);
INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
SELECT 'model_plan_mapping', mp.id::text, to_jsonb(mp) FROM model_plan_mapping mp JOIN dup_pairs x ON mp.model_id IN (x.source_id, x.target_id);
DO $$
DECLARE dependency text;
BEGIN
  FOREACH dependency IN ARRAY ARRAY[
    'model_offical', 'model_benchmark_scores', 'evaluation_run',
    'usage_prices', 'coding_agent_scores', 'external_price_references'
  ] LOOP
    EXECUTE format(
      'INSERT INTO model_merge_backup_20261022 (source_table, row_key, row_data)
       SELECT %L, d.id::text, to_jsonb(d) FROM %I d JOIN dup_pairs x ON d.model_id IN (x.source_id, x.target_id)',
      dependency, dependency);
  END LOOP;
END $$;

-- History follows the surviving channel id; the stale canonical channel goes away.
UPDATE price_history h SET channel_price_id = x.source_channel FROM dup_pairs x WHERE x.target_channel IS NOT NULL AND h.channel_price_id = x.target_channel;
DELETE FROM api_channel_prices c USING dup_pairs x WHERE c.id = x.target_channel;

-- The live row owns the endpoint variants for provider 59.
DELETE FROM api_channel_price_variants v USING dup_pairs x WHERE v.model_id = x.target_id AND v.provider_id = 59;
UPDATE api_channel_price_variants v SET model_id = x.target_id, updated_at = now() FROM dup_pairs x WHERE v.model_id = x.source_id;
UPDATE api_channel_prices c SET model_id = x.target_id, updated_at = now() FROM dup_pairs x WHERE c.id = x.source_channel;

-- Plan links are derived; keep the canonical row on conflicts, move the rest.
DELETE FROM model_plan_mapping d USING dup_pairs x
WHERE d.model_id = x.source_id AND EXISTS (
  SELECT 1 FROM model_plan_mapping k WHERE k.model_id = x.target_id AND k.plan_id = d.plan_id);
UPDATE model_plan_mapping d SET model_id = x.target_id FROM dup_pairs x WHERE d.model_id = x.source_id;

-- Remaining relational references move as-is (no model-dependent unique keys).
UPDATE model_offical d SET model_id = x.target_id FROM dup_pairs x WHERE d.model_id = x.source_id;
UPDATE model_benchmark_scores d SET model_id = x.target_id FROM dup_pairs x WHERE d.model_id = x.source_id;
UPDATE evaluation_run d SET model_id = x.target_id FROM dup_pairs x WHERE d.model_id = x.source_id;
UPDATE usage_prices d SET model_id = x.target_id, updated_at = now() FROM dup_pairs x WHERE d.model_id = x.source_id;
UPDATE coding_agent_scores d SET model_id = x.target_id, updated_at = now() FROM dup_pairs x WHERE d.model_id = x.source_id;
UPDATE external_price_references d SET model_id = x.target_id, updated_at = now() FROM dup_pairs x WHERE d.model_id = x.source_id;

-- Fill canonical metadata nulls from the scraped row; never overwrite curated values.
UPDATE models nm SET
  context_window = COALESCE(nm.context_window, om.context_window),
  max_output_tokens = COALESCE(nm.max_output_tokens, om.max_output_tokens),
  released_at = COALESCE(nm.released_at, om.released_at),
  description = COALESCE(nm.description, om.description),
  offical_link = COALESCE(nm.offical_link, om.offical_link),
  provider_ids = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(nm.provider_ids || om.provider_ids) p),
  updated_at = now()
FROM dup_pairs x JOIN models om ON om.id = x.source_id
WHERE nm.id = x.target_id;

INSERT INTO model_slug_redirects (old_slug, model_id, reason)
SELECT x.old_slug, x.target_id, 'OpenRouter prefix duplicate merge 2026-10-22'
FROM dup_pairs x
ON CONFLICT (old_slug) DO UPDATE SET model_id = EXCLUDED.model_id, reason = EXCLUDED.reason;

DELETE FROM models m USING dup_pairs x WHERE m.id = x.source_id;

-- ── VERIFICATION ─────────────────────────────────────────────────────────────
SELECT x.old_slug, x.new_slug, nm.id AS canonical_id,
       r.model_id = nm.id AS redirect_ok,
       (SELECT count(*) FROM models d WHERE d.slug = x.old_slug) AS old_rows,
       (SELECT count(*) FROM api_channel_prices c WHERE c.model_id = nm.id) AS channels,
       (SELECT count(*) FROM api_channel_prices c WHERE c.model_id = nm.id AND c.provider_id = 59) AS openrouter_channels,
       (SELECT count(*) FROM api_channel_price_variants v WHERE v.model_id = nm.id AND v.is_headline AND v.is_available) AS available_headlines
FROM dup_pairs x
JOIN models nm ON nm.id = x.target_id
JOIN model_slug_redirects r ON r.old_slug = x.old_slug
ORDER BY x.old_slug;

SELECT 'backup_rows' AS check, count(*) FROM model_merge_backup_20261022;

DO $$
DECLARE dependency text; remaining bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM dup_pairs x
    WHERE NOT EXISTS (SELECT 1 FROM model_slug_redirects r WHERE r.old_slug = x.old_slug AND r.model_id = x.target_id)
      OR EXISTS (SELECT 1 FROM models d WHERE d.slug = x.old_slug)
  ) THEN RAISE EXCEPTION 'Redirect/canonical verification failed'; END IF;
  FOREACH dependency IN ARRAY ARRAY[
    'api_channel_prices', 'api_channel_price_variants', 'model_plan_mapping',
    'model_offical', 'model_benchmark_scores', 'evaluation_run', 'usage_prices',
    'coding_agent_scores', 'external_price_references'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I d JOIN dup_pairs x ON d.model_id = x.source_id', dependency) INTO remaining;
    IF remaining <> 0 THEN RAISE EXCEPTION 'Unmoved rows in %: %', dependency, remaining; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM model_merge_backup_20261022 b
    LEFT JOIN price_history h ON h.id = CASE WHEN b.source_table = 'price_history' THEN b.row_key::bigint END
    LEFT JOIN api_channel_prices p ON p.id = h.channel_price_id
    WHERE b.source_table = 'price_history' AND (h.id IS NULL OR p.id IS NULL)
  ) THEN RAISE EXCEPTION 'Affected price history lost or orphaned'; END IF;
  IF EXISTS (
    SELECT 1 FROM dup_pairs x JOIN api_channel_prices c ON c.model_id = x.target_id AND c.provider_id = 59
    WHERE c.is_available IS DISTINCT FROM true
  ) OR (SELECT count(*) FROM api_channel_prices c JOIN dup_pairs x ON c.model_id = x.target_id AND c.provider_id = 59) <> 6 THEN RAISE EXCEPTION 'Canonical OpenRouter channel is not live after the merge'; END IF;
END $$;

COMMIT;
