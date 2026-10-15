-- Standalone, MANUAL repair. Not registered with the migration runner.
-- Run the read-only preview separately first. Then run the transaction in a
-- persistent session, inspect verification, and explicitly COMMIT or ROLLBACK.
-- Stop scrapers/writers while reviewing: transaction locks block their writes.
-- Resolve identities by slug; IDs below are derived only from those rows.
-- Canonical model metadata/prices win conflicts (including promotion fields).
-- Backups retain every affected row, including discarded conflicts/history.

-- READ-ONLY DRY RUN: no DDL, writes, or transaction below this heading until BEGIN.
WITH requested(slug) AS (VALUES
  ('gemini-4-argon'), ('google-gemini-gemini-4-argon'),
  ('gemini-4-argon-batch'), ('google-gemini-gemini-4-argon-batch')
)
SELECT r.slug AS requested_slug, m.* FROM requested r
LEFT JOIN models m ON m.slug = r.slug ORDER BY r.slug;

WITH affected AS (
  SELECT id, slug FROM models WHERE slug IN (
    'gemini-4-argon', 'google-gemini-gemini-4-argon',
    'gemini-4-argon-batch', 'google-gemini-gemini-4-argon-batch')
)
SELECT m.slug, deps.table_name, deps.row_count FROM affected m
CROSS JOIN LATERAL (
  SELECT 'api_channel_prices' AS table_name, count(*) AS row_count FROM api_channel_prices WHERE model_id = m.id
  UNION ALL SELECT 'api_channel_price_variants', count(*) FROM api_channel_price_variants WHERE model_id = m.id
  UNION ALL SELECT 'model_plan_mapping', count(*) FROM model_plan_mapping WHERE model_id = m.id
  UNION ALL SELECT 'model_offical', count(*) FROM model_offical WHERE model_id = m.id
  UNION ALL SELECT 'model_benchmark_scores', count(*) FROM model_benchmark_scores WHERE model_id = m.id
  UNION ALL SELECT 'evaluation_run', count(*) FROM evaluation_run WHERE model_id = m.id
  UNION ALL SELECT 'usage_prices', count(*) FROM usage_prices WHERE model_id = m.id
  UNION ALL SELECT 'coding_agent_scores', count(*) FROM coding_agent_scores WHERE model_id = m.id
  UNION ALL SELECT 'external_price_references', count(*) FROM external_price_references WHERE model_id = m.id
  UNION ALL SELECT 'model_slug_redirects', count(*) FROM model_slug_redirects WHERE model_id = m.id
  -- History has channel_price_id, NOT model_id; include both sides' histories.
  UNION ALL SELECT 'price_history (via api_channel_prices)', count(*) FROM price_history h
    JOIN api_channel_prices p ON p.id = h.channel_price_id WHERE p.model_id = m.id
) deps ORDER BY m.slug, deps.table_name;

-- Discover live FKs as well as the references in src/db/schema/index.ts and
-- scripts/migrate-data-accuracy.ts. Unknown references abort the repair below.
SELECT c.conrelid::regclass AS referencing_table, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'f' AND c.confrelid IN ('models'::regclass, 'api_channel_prices'::regclass)
ORDER BY 1, 2;

-- Inspect live uniqueness rules; older Drizzle snapshots use legacy names.
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN (
  'api_channel_prices', 'api_channel_price_variants', 'model_plan_mapping',
  'model_offical', 'model_benchmark_scores', 'evaluation_run', 'usage_prices',
  'coding_agent_scores', 'external_price_references', 'price_history')
ORDER BY tablename, indexname;

-- Channel conflicts: these duplicate prices will be discarded, canonical kept.
WITH pairs(old_slug, new_slug) AS (VALUES
  ('google-gemini-gemini-4-argon', 'gemini-4-argon'),
  ('google-gemini-gemini-4-argon-batch', 'gemini-4-argon-batch')
)
SELECT x.old_slug, x.new_slug, d.provider_id,
       d.id AS discarded_channel_id, k.id AS kept_channel_id,
       d.input_price_per_1m AS duplicate_input, k.input_price_per_1m AS canonical_input,
       d.output_price_per_1m AS duplicate_output, k.output_price_per_1m AS canonical_output
FROM pairs x JOIN models old ON old.slug = x.old_slug JOIN models canon ON canon.slug = x.new_slug
JOIN api_channel_prices d ON d.model_id = old.id
JOIN api_channel_prices k ON k.model_id = canon.id AND k.provider_id IS NOT DISTINCT FROM d.provider_id
ORDER BY x.old_slug, d.provider_id;

-- END READ-ONLY DRY RUN. Run everything below only after reviewing the above.
BEGIN;
SET LOCAL search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS model_slug_redirects (
  old_slug text PRIMARY KEY,
  model_id integer NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

LOCK TABLE models, api_channel_prices, api_channel_price_variants,
  model_plan_mapping, model_offical, model_benchmark_scores, evaluation_run,
  usage_prices, coding_agent_scores, external_price_references,
  model_slug_redirects, price_history IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE argon_targets (old_slug text PRIMARY KEY, new_slug text NOT NULL) ON COMMIT DROP;
INSERT INTO argon_targets VALUES
  ('google-gemini-gemini-4-argon', 'gemini-4-argon'),
  ('google-gemini-gemini-4-argon-batch', 'gemini-4-argon-batch');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM models WHERE slug = 'gemini-4-argon') THEN
    RAISE EXCEPTION 'Canonical gemini-4-argon is missing; review/seed it first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM models WHERE slug IN ('gemini-4-argon-batch', 'google-gemini-gemini-4-argon-batch')) THEN
    RAISE EXCEPTION 'Both batch rows are missing; manual review required';
  END IF;
  -- Refuse unhandled FKs, including cascading ones, rather than lose data.
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
  ) THEN RAISE EXCEPTION 'Unhandled FK to models; extend preview, backup and merge before proceeding'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'api_channel_prices'::regclass
      AND NOT (c.conrelid = 'price_history'::regclass
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'channel_price_id')]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')])
  ) THEN RAISE EXCEPTION 'Unhandled FK to api_channel_prices; extend repair before proceeding'; END IF;
  IF EXISTS (
    SELECT 1 FROM api_channel_prices p JOIN models m ON m.id = p.model_id
    WHERE m.slug IN (SELECT old_slug FROM argon_targets UNION ALL SELECT new_slug FROM argon_targets)
    GROUP BY p.model_id, p.provider_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Multiple channel rows within an affected model/provider; review first'; END IF;
  IF EXISTS (
    SELECT 1 FROM model_slug_redirects r JOIN argon_targets t ON t.old_slug = r.old_slug
    JOIN models m ON m.id = r.model_id WHERE m.slug NOT IN (t.old_slug, t.new_slug)
  ) THEN RAISE EXCEPTION 'Argon old slug redirects to an unrelated model; review first'; END IF;
END $$;

-- Permanent, typed JSON backup; deliberate failure if already present avoids
-- overwriting a previous repair's evidence. Rolled back with the transaction.
CREATE TABLE model_merge_backup_20261015 (
  source_table text NOT NULL,
  row_key text NOT NULL,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, row_key)
);
INSERT INTO model_merge_backup_20261015 (source_table, row_key, row_data)
SELECT 'models', m.id::text, to_jsonb(m) FROM models m
WHERE m.slug IN (SELECT old_slug FROM argon_targets UNION ALL SELECT new_slug FROM argon_targets);

DO $$
DECLARE dependency text;
BEGIN
  FOREACH dependency IN ARRAY ARRAY[
    'api_channel_prices', 'api_channel_price_variants', 'model_plan_mapping',
    'model_offical', 'model_benchmark_scores', 'evaluation_run', 'usage_prices',
    'coding_agent_scores', 'external_price_references'
  ] LOOP
    EXECUTE format(
      'INSERT INTO model_merge_backup_20261015 (source_table, row_key, row_data)
       SELECT %L, d.id::text, to_jsonb(d) FROM %I d JOIN models m ON m.id = d.model_id
       WHERE m.slug IN (SELECT old_slug FROM argon_targets UNION ALL SELECT new_slug FROM argon_targets)',
      dependency, dependency);
  END LOOP;
END $$;
INSERT INTO model_merge_backup_20261015 (source_table, row_key, row_data)
SELECT 'price_history', h.id::text, to_jsonb(h) FROM price_history h
JOIN api_channel_prices p ON p.id = h.channel_price_id JOIN models m ON m.id = p.model_id
WHERE m.slug IN (SELECT old_slug FROM argon_targets UNION ALL SELECT new_slug FROM argon_targets);
INSERT INTO model_merge_backup_20261015 (source_table, row_key, row_data)
SELECT 'model_slug_redirects', r.old_slug, to_jsonb(r) FROM model_slug_redirects r
WHERE r.old_slug IN (SELECT old_slug FROM argon_targets)
   OR r.model_id IN (SELECT row_key::integer FROM model_merge_backup_20261015 WHERE source_table = 'models');

-- Batch: rename in place if no canonical exists. Preserve its ID/dependencies.
UPDATE models m SET slug = 'gemini-4-argon-batch', updated_at = now()
WHERE m.slug = 'google-gemini-gemini-4-argon-batch'
  AND NOT EXISTS (SELECT 1 FROM models WHERE slug = 'gemini-4-argon-batch');

CREATE TEMP TABLE argon_merge ON COMMIT DROP AS
SELECT old.id AS source_id, canon.id AS target_id, t.old_slug, t.new_slug
FROM argon_targets t JOIN models old ON old.slug = t.old_slug JOIN models canon ON canon.slug = t.new_slug;

CREATE TEMP TABLE argon_channel_conflicts ON COMMIT DROP AS
SELECT d.id AS source_id, k.id AS target_id
FROM argon_merge x JOIN api_channel_prices d ON d.model_id = x.source_id
JOIN api_channel_prices k ON k.model_id = x.target_id AND k.provider_id IS NOT DISTINCT FROM d.provider_id;

-- Preserve ALL history events by attaching them to the surviving channel ID.
UPDATE price_history h SET channel_price_id = x.target_id
FROM argon_channel_conflicts x WHERE h.channel_price_id = x.source_id;
DELETE FROM api_channel_prices d USING argon_channel_conflicts x WHERE d.id = x.source_id;
UPDATE api_channel_prices d SET model_id = x.target_id, updated_at = now()
FROM argon_merge x WHERE d.model_id = x.source_id;

-- Keep canonical variants on key conflicts, but retain every other variant.
DELETE FROM api_channel_price_variants d USING argon_merge x
WHERE d.model_id = x.source_id AND EXISTS (
  SELECT 1 FROM api_channel_price_variants k WHERE k.model_id = x.target_id
    AND k.provider_id IS NOT DISTINCT FROM d.provider_id AND k.variant_key = d.variant_key);
-- Also obey the partial unique index: only one available headline per pair.
UPDATE api_channel_price_variants d SET is_headline = false, updated_at = now()
FROM argon_merge x WHERE d.model_id = x.source_id AND d.is_headline AND d.is_available
  AND EXISTS (SELECT 1 FROM api_channel_price_variants k WHERE k.model_id = x.target_id
    AND k.provider_id IS NOT DISTINCT FROM d.provider_id AND k.is_headline AND k.is_available);
UPDATE api_channel_price_variants d SET model_id = x.target_id, updated_at = now()
FROM argon_merge x WHERE d.model_id = x.source_id;

DELETE FROM model_plan_mapping d USING argon_merge x
WHERE d.model_id = x.source_id AND EXISTS (SELECT 1 FROM model_plan_mapping k
  WHERE k.model_id = x.target_id AND k.plan_id IS NOT DISTINCT FROM d.plan_id);
UPDATE model_plan_mapping d SET model_id = x.target_id FROM argon_merge x WHERE d.model_id = x.source_id;

DELETE FROM model_offical d USING argon_merge x
WHERE d.model_id = x.source_id AND EXISTS (SELECT 1 FROM model_offical k
  WHERE k.model_id = x.target_id AND k.producer_id IS NOT DISTINCT FROM d.producer_id);
UPDATE model_offical d SET model_id = x.target_id FROM argon_merge x WHERE d.model_id = x.source_id;

-- Distinct dated benchmark results survive; canonical wins the same score key.
DELETE FROM model_benchmark_scores d USING argon_merge x
WHERE d.model_id = x.source_id AND EXISTS (SELECT 1 FROM model_benchmark_scores k
  WHERE k.model_id = x.target_id AND k.benchmark_task_id IS NOT DISTINCT FROM d.benchmark_task_id
    AND k.metric_id IS NOT DISTINCT FROM d.metric_id AND k.release_date IS NOT DISTINCT FROM d.release_date);
UPDATE model_benchmark_scores d SET model_id = x.target_id FROM argon_merge x WHERE d.model_id = x.source_id;

-- These tables have no model-dependent unique key in the current schema.
-- Keep source slugs/raw payloads as provenance; only the relational ID moves.
UPDATE evaluation_run d SET model_id = x.target_id FROM argon_merge x WHERE d.model_id = x.source_id;
UPDATE usage_prices d SET model_id = x.target_id, updated_at = now() FROM argon_merge x WHERE d.model_id = x.source_id;
UPDATE coding_agent_scores d SET model_id = x.target_id, updated_at = now() FROM argon_merge x WHERE d.model_id = x.source_id;
UPDATE external_price_references d SET model_id = x.target_id, updated_at = now() FROM argon_merge x WHERE d.model_id = x.source_id;

-- Move existing redirects before deleting models (FK has ON DELETE CASCADE).
UPDATE model_slug_redirects d SET model_id = x.target_id FROM argon_merge x WHERE d.model_id = x.source_id;
INSERT INTO model_slug_redirects (old_slug, model_id, reason)
SELECT t.old_slug, m.id, 'Argon duplicate merge 2026-10-15: OpenRouter google-gemini prefix'
FROM argon_targets t JOIN models m ON m.slug = t.new_slug
ON CONFLICT (old_slug) DO UPDATE SET model_id = EXCLUDED.model_id, reason = EXCLUDED.reason;

DELETE FROM models d USING argon_merge x WHERE d.id = x.source_id;

-- VERIFICATION: expect two canonical rows, two redirects, and no old model rows.
SELECT t.old_slug, t.new_slug, m.id AS canonical_id, m.name,
       r.model_id AS redirect_id, r.model_id = m.id AS redirect_ok,
       (SELECT count(*) FROM models d WHERE d.slug = t.old_slug) AS old_model_rows
FROM argon_targets t LEFT JOIN models m ON m.slug = t.new_slug
LEFT JOIN model_slug_redirects r ON r.old_slug = t.old_slug ORDER BY t.new_slug;

-- Before/after dependency counts (conflicts are retained in backup).
SELECT source_table, count(*) AS backed_up_rows FROM model_merge_backup_20261015
GROUP BY source_table ORDER BY source_table;
SELECT m.slug,
  (SELECT count(*) FROM api_channel_prices d WHERE d.model_id = m.id) AS channels,
  (SELECT count(*) FROM api_channel_price_variants d WHERE d.model_id = m.id) AS variants,
  (SELECT count(*) FROM model_plan_mapping d WHERE d.model_id = m.id) AS plans,
  (SELECT count(*) FROM price_history h JOIN api_channel_prices d ON d.id = h.channel_price_id WHERE d.model_id = m.id) AS history
FROM models m WHERE m.slug IN (SELECT new_slug FROM argon_targets) ORDER BY m.slug;

-- Expect zero rows: no affected history orphaned or silently dropped.
SELECT b.row_key AS lost_or_orphaned_history_id
FROM model_merge_backup_20261015 b
LEFT JOIN price_history h ON h.id = CASE WHEN b.source_table = 'price_history' THEN b.row_key::bigint END
LEFT JOIN api_channel_prices p ON p.id = h.channel_price_id
WHERE b.source_table = 'price_history' AND (h.id IS NULL OR p.id IS NULL);

DO $$
DECLARE dependency text; remaining bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM argon_targets t
    LEFT JOIN models m ON m.slug = t.new_slug LEFT JOIN model_slug_redirects r ON r.old_slug = t.old_slug
    WHERE m.id IS NULL OR r.model_id IS DISTINCT FROM m.id
      OR EXISTS (SELECT 1 FROM models d WHERE d.slug = t.old_slug)) THEN
    RAISE EXCEPTION 'Canonical model / redirect verification failed';
  END IF;
  FOREACH dependency IN ARRAY ARRAY[
    'api_channel_prices', 'api_channel_price_variants', 'model_plan_mapping',
    'model_offical', 'model_benchmark_scores', 'evaluation_run', 'usage_prices',
    'coding_agent_scores', 'external_price_references', 'model_slug_redirects'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I d JOIN argon_merge x ON d.model_id = x.source_id', dependency) INTO remaining;
    IF remaining <> 0 THEN RAISE EXCEPTION 'Unmoved rows in %: %', dependency, remaining; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM model_merge_backup_20261015 b
    LEFT JOIN price_history h ON h.id = CASE WHEN b.source_table = 'price_history' THEN b.row_key::bigint END
    LEFT JOIN api_channel_prices p ON p.id = h.channel_price_id
    WHERE b.source_table = 'price_history' AND (h.id IS NULL OR p.id IS NULL)) THEN
    RAISE EXCEPTION 'Affected price history lost or orphaned';
  END IF;
END $$;

-- Intentionally leave the transaction OPEN. Inspect, then choose manually:
-- COMMIT;
-- ROLLBACK;
