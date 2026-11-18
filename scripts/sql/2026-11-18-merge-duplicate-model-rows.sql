-- Standalone, MANUAL repair. Not registered with the migration runner.
--
-- Merges the 54 duplicate model rows listed in src/lib/duplicate-model-slugs.ts
-- (found 2026-11-16) into the row that should rank. Today the copy's page only
-- declares rel=canonical; after this runs, the copy's slug 301s through
-- model_slug_redirects (which the scraper also reads, so it stops re-creating
-- the copy) and its entry in DUPLICATE_MODEL_SLUGS can be deleted.
--
-- Unlike 2026-10-22 (one OpenRouter channel per pair), the two rows here carry
-- different channels, and sometimes the SAME provider on both sides. Rules:
--   * provider only on the copy      -> channel + its variants move to the canonical row
--   * provider on both rows          -> one channel survives: available first, then the
--     most recently verified, then the most recently updated, then the canonical
--     row's. The other channel is deleted, its price_history moves to the survivor,
--     and only the survivor's side keeps its endpoint variants for that provider.
--   * plan links: canonical row wins on conflict, the rest move
--   * every other model_id reference moves as-is
--   * canonical metadata: fill NULLs from the copy, never overwrite
--
-- How to run (SRE, production DB):
--   1. Run only the READ-ONLY PREVIEW block and save its output with the PR.
--   2. pg_dump first. Then run the whole file with psql -v ON_ERROR_STOP=1.
--      The transaction backs every touched row up into model_merge_backup_20261118
--      and COMMITs only if the verification block passes; any exception rolls
--      everything back.
--   3. Remove the merged pairs from DUPLICATE_MODEL_SLUGS in a follow-up PR.

-- ── READ-ONLY PREVIEW ────────────────────────────────────────────────────────
WITH pairs(old_slug, new_slug) AS (VALUES
  ('claude-fable-5-(batch)', 'anthropic-claude-fable-5-batch'),
  ('claude-opus-5:batch', 'anthropic-claude-opus-5-batch'),
  ('claude-sonnet-5-(batch)', 'anthropic-claude-sonnet-5-batch'),
  ('claude-3-7-sonnet', 'claude-3.7-sonnet'),
  ('anthropic-claude-opus-4', 'claude-opus-4'),
  ('anthropic-claude-opus-4-1', 'claude-opus-4.1'),
  ('gemma-4-31b-(batch)', 'gemma-4-31b-batch'),
  ('zai-glm-5-2', 'glm-5.2'),
  ('gemini-2.5-flash-(batch)', 'google-gemini-gemini-2-5-flash-batch'),
  ('gemini-2.5-flash-lite-(batch)', 'google-gemini-gemini-2-5-flash-lite-batch'),
  ('gemini-2.5-pro-(batch)', 'google-gemini-gemini-2-5-pro-batch'),
  ('gemini-3.1-flash-lite-(batch)', 'google-gemini-gemini-3-1-flash-lite-batch'),
  ('gemini-3.5-flash-(batch)', 'google-gemini-gemini-3-5-flash-batch'),
  ('gemini-3.5-flash-lite-(batch)', 'google-gemini-gemini-3-5-flash-lite-batch'),
  ('gemini-3.6-flash-(batch)', 'google-gemini-gemini-3-6-flash-batch'),
  ('gemini-3.7-flash-(batch)', 'google-gemini-gemini-3-7-flash-batch'),
  ('gemini-3.8-flash-(batch)', 'google-gemini-gemini-3-8-flash-batch'),
  ('openai-gpt-4-1-mini', 'gpt-4.1-mini'),
  ('openai-gpt-5-4', 'gpt-5.4'),
  ('openai-gpt-6-astra-law', 'gpt-6-astra-law'),
  ('kimi-k3us-geo-pinned', 'kimi-k3-us-geo-pinned'),
  ('kimi-k3-(batch)', 'moonshotai-kimi-k3-batch'),
  ('nvidia-nemotron-3-5-lightning', 'nemotron-3.5-lightning'),
  ('gpt-4.1-mini-(batch)', 'openai-gpt-4-1-mini-batch'),
  ('gpt-5.1-(batch)', 'openai-gpt-5-1-batch'),
  ('gpt-5.2-(batch)', 'openai-gpt-5-2-batch'),
  ('gpt-5.2-pro-(batch)', 'openai-gpt-5-2-pro-batch'),
  ('gpt-5.4-(batch)', 'openai-gpt-5-4-batch'),
  ('gpt-5.4-mini-(batch)', 'openai-gpt-5-4-mini-batch'),
  ('gpt-5.4-nano-(batch)', 'openai-gpt-5-4-nano-batch'),
  ('gpt-5.4-pro-(batch)', 'openai-gpt-5-4-pro-batch'),
  ('gpt-5.5-(batch)', 'openai-gpt-5-5-batch'),
  ('gpt-5.5-pro-(batch)', 'openai-gpt-5-5-pro-batch'),
  ('gpt-5.6-luna-(batch)', 'openai-gpt-5-6-luna-batch'),
  ('gpt-5.6-luna-pro-(batch)', 'openai-gpt-5-6-luna-pro-batch'),
  ('gpt-5.6-sol-(batch)', 'openai-gpt-5-6-sol-batch'),
  ('gpt-5.6-sol-pro-(batch)', 'openai-gpt-5-6-sol-pro-batch'),
  ('gpt-5.6-terra-(batch)', 'openai-gpt-5-6-terra-batch'),
  ('gpt-5.6-terra-pro-(batch)', 'openai-gpt-5-6-terra-pro-batch'),
  ('gpt-5-(batch)', 'openai-gpt-5-batch'),
  ('gpt-5-mini-(batch)', 'openai-gpt-5-mini-batch'),
  ('gpt-5-nano-(batch)', 'openai-gpt-5-nano-batch'),
  ('gpt-5-pro-(batch)', 'openai-gpt-5-pro-batch'),
  ('gpt-6-astra-(batch)', 'openai-gpt-6-astra-batch'),
  ('gpt-6-astra-pro-(batch)', 'openai-gpt-6-astra-pro-batch'),
  ('gpt-oss-120b-(batch)', 'openai-gpt-oss-120b-batch'),
  ('gpt-oss-20b-(batch)', 'openai-gpt-oss-20b-batch'),
  ('o3-(batch)', 'openai-o3-batch'),
  ('qwen3.5-9b-(batch)', 'qwen-qwen3-5-9b-batch'),
  ('qwen3.8-2.4t-a95b-(batch)', 'qwen-qwen3-8-2-4t-a95b-batch'),
  ('grok-4.3-(batch)', 'x-ai-grok-4-3-batch'),
  ('glm-5.2-(batch)', 'z-ai-glm-5-2-batch'),
  ('glm-5.3-(batch)', 'z-ai-glm-5-3-batch'),
  ('glm-5.3-flash-(batch)', 'z-ai-glm-5-3-flash-batch')
), p AS (
  SELECT t.old_slug, t.new_slug, om.id AS old_id, nm.id AS new_id
  FROM pairs t
  LEFT JOIN models om ON om.slug = t.old_slug
  LEFT JOIN models nm ON nm.slug = t.new_slug
)
SELECT p.old_slug, p.old_id, p.new_slug, p.new_id,
       (SELECT count(*) FROM api_channel_prices c WHERE c.model_id = p.old_id) AS old_channels,
       (SELECT count(*) FROM api_channel_prices c WHERE c.model_id = p.new_id) AS new_channels,
       (SELECT count(*) FROM api_channel_prices oc JOIN api_channel_prices nc
          ON nc.model_id = p.new_id AND nc.provider_id = oc.provider_id
        WHERE oc.model_id = p.old_id) AS shared_providers,
       (SELECT count(*) FROM model_plan_mapping mp WHERE mp.model_id = p.old_id) AS old_plan_links,
       (SELECT count(*) FROM model_slug_redirects r WHERE r.old_slug = p.old_slug) AS existing_redirect
FROM p
ORDER BY (p.old_id IS NULL OR p.new_id IS NULL) DESC, p.old_slug;

-- ── REPAIR ───────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS model_merge_backup_20261118 (
  source_table text NOT NULL,
  row_key text NOT NULL,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, row_key)
);

CREATE TEMP TABLE dup_targets (old_slug text PRIMARY KEY, new_slug text NOT NULL) ON COMMIT DROP;
INSERT INTO dup_targets VALUES
  ('claude-fable-5-(batch)', 'anthropic-claude-fable-5-batch'),
  ('claude-opus-5:batch', 'anthropic-claude-opus-5-batch'),
  ('claude-sonnet-5-(batch)', 'anthropic-claude-sonnet-5-batch'),
  ('claude-3-7-sonnet', 'claude-3.7-sonnet'),
  ('anthropic-claude-opus-4', 'claude-opus-4'),
  ('anthropic-claude-opus-4-1', 'claude-opus-4.1'),
  ('gemma-4-31b-(batch)', 'gemma-4-31b-batch'),
  ('zai-glm-5-2', 'glm-5.2'),
  ('gemini-2.5-flash-(batch)', 'google-gemini-gemini-2-5-flash-batch'),
  ('gemini-2.5-flash-lite-(batch)', 'google-gemini-gemini-2-5-flash-lite-batch'),
  ('gemini-2.5-pro-(batch)', 'google-gemini-gemini-2-5-pro-batch'),
  ('gemini-3.1-flash-lite-(batch)', 'google-gemini-gemini-3-1-flash-lite-batch'),
  ('gemini-3.5-flash-(batch)', 'google-gemini-gemini-3-5-flash-batch'),
  ('gemini-3.5-flash-lite-(batch)', 'google-gemini-gemini-3-5-flash-lite-batch'),
  ('gemini-3.6-flash-(batch)', 'google-gemini-gemini-3-6-flash-batch'),
  ('gemini-3.7-flash-(batch)', 'google-gemini-gemini-3-7-flash-batch'),
  ('gemini-3.8-flash-(batch)', 'google-gemini-gemini-3-8-flash-batch'),
  ('openai-gpt-4-1-mini', 'gpt-4.1-mini'),
  ('openai-gpt-5-4', 'gpt-5.4'),
  ('openai-gpt-6-astra-law', 'gpt-6-astra-law'),
  ('kimi-k3us-geo-pinned', 'kimi-k3-us-geo-pinned'),
  ('kimi-k3-(batch)', 'moonshotai-kimi-k3-batch'),
  ('nvidia-nemotron-3-5-lightning', 'nemotron-3.5-lightning'),
  ('gpt-4.1-mini-(batch)', 'openai-gpt-4-1-mini-batch'),
  ('gpt-5.1-(batch)', 'openai-gpt-5-1-batch'),
  ('gpt-5.2-(batch)', 'openai-gpt-5-2-batch'),
  ('gpt-5.2-pro-(batch)', 'openai-gpt-5-2-pro-batch'),
  ('gpt-5.4-(batch)', 'openai-gpt-5-4-batch'),
  ('gpt-5.4-mini-(batch)', 'openai-gpt-5-4-mini-batch'),
  ('gpt-5.4-nano-(batch)', 'openai-gpt-5-4-nano-batch'),
  ('gpt-5.4-pro-(batch)', 'openai-gpt-5-4-pro-batch'),
  ('gpt-5.5-(batch)', 'openai-gpt-5-5-batch'),
  ('gpt-5.5-pro-(batch)', 'openai-gpt-5-5-pro-batch'),
  ('gpt-5.6-luna-(batch)', 'openai-gpt-5-6-luna-batch'),
  ('gpt-5.6-luna-pro-(batch)', 'openai-gpt-5-6-luna-pro-batch'),
  ('gpt-5.6-sol-(batch)', 'openai-gpt-5-6-sol-batch'),
  ('gpt-5.6-sol-pro-(batch)', 'openai-gpt-5-6-sol-pro-batch'),
  ('gpt-5.6-terra-(batch)', 'openai-gpt-5-6-terra-batch'),
  ('gpt-5.6-terra-pro-(batch)', 'openai-gpt-5-6-terra-pro-batch'),
  ('gpt-5-(batch)', 'openai-gpt-5-batch'),
  ('gpt-5-mini-(batch)', 'openai-gpt-5-mini-batch'),
  ('gpt-5-nano-(batch)', 'openai-gpt-5-nano-batch'),
  ('gpt-5-pro-(batch)', 'openai-gpt-5-pro-batch'),
  ('gpt-6-astra-(batch)', 'openai-gpt-6-astra-batch'),
  ('gpt-6-astra-pro-(batch)', 'openai-gpt-6-astra-pro-batch'),
  ('gpt-oss-120b-(batch)', 'openai-gpt-oss-120b-batch'),
  ('gpt-oss-20b-(batch)', 'openai-gpt-oss-20b-batch'),
  ('o3-(batch)', 'openai-o3-batch'),
  ('qwen3.5-9b-(batch)', 'qwen-qwen3-5-9b-batch'),
  ('qwen3.8-2.4t-a95b-(batch)', 'qwen-qwen3-8-2-4t-a95b-batch'),
  ('grok-4.3-(batch)', 'x-ai-grok-4-3-batch'),
  ('glm-5.2-(batch)', 'z-ai-glm-5-2-batch'),
  ('glm-5.3-(batch)', 'z-ai-glm-5-3-batch'),
  ('glm-5.3-flash-(batch)', 'z-ai-glm-5-3-flash-batch');

DO $$
BEGIN
  IF (SELECT count(*) FROM dup_targets) <> 54 THEN
    RAISE EXCEPTION 'Expected 54 pairs';
  END IF;
  IF (SELECT count(*) FROM models m JOIN dup_targets t ON m.slug = t.new_slug) <> 54 THEN
    RAISE EXCEPTION 'Canonical rows missing; review the preview before retrying';
  END IF;
  IF (SELECT count(*) FROM models m JOIN dup_targets t ON m.slug = t.old_slug) <> 54 THEN
    RAISE EXCEPTION 'Duplicate rows missing; already merged? review the preview before retrying';
  END IF;
  IF EXISTS (SELECT 1 FROM dup_targets a JOIN dup_targets b ON a.new_slug = b.old_slug) THEN
    RAISE EXCEPTION 'A canonical slug is also a duplicate (chain)';
  END IF;
  IF EXISTS (SELECT 1 FROM model_slug_redirects r JOIN dup_targets t ON t.old_slug = r.old_slug) THEN
    RAISE EXCEPTION 'A duplicate slug already has a redirect; review first';
  END IF;
  IF EXISTS (SELECT 1 FROM model_slug_redirects r JOIN dup_targets t ON t.new_slug = r.old_slug) THEN
    RAISE EXCEPTION 'A canonical slug is itself redirected; review first';
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
SELECT om.id AS source_id, nm.id AS target_id, t.old_slug, t.new_slug
FROM dup_targets t
JOIN models om ON om.slug = t.old_slug
JOIN models nm ON nm.slug = t.new_slug;

-- Every (pair, provider) that has a channel on either row, and which channel survives.
CREATE TEMP TABLE channel_plan ON COMMIT DROP AS
WITH ranked AS (
  SELECT x.source_id, x.target_id, c.provider_id, c.id AS channel_id, c.model_id,
         row_number() OVER (
           PARTITION BY x.source_id, c.provider_id
           ORDER BY c.is_available IS TRUE DESC, c.last_verified DESC NULLS LAST,
                    c.updated_at DESC NULLS LAST, (c.model_id = x.target_id) DESC, c.id
         ) AS rank
  FROM dup_pairs x
  JOIN api_channel_prices c ON c.model_id IN (x.source_id, x.target_id)
)
SELECT source_id, target_id, provider_id,
       max(channel_id) FILTER (WHERE rank = 1) AS keep_channel,
       (array_agg(model_id) FILTER (WHERE rank = 1))[1] AS keep_side,
       coalesce(array_agg(channel_id) FILTER (WHERE rank > 1), '{}') AS drop_channels
FROM ranked
GROUP BY source_id, target_id, provider_id;

-- Back up every row this repair touches.
INSERT INTO model_merge_backup_20261118 (source_table, row_key, row_data)
SELECT 'models', m.id::text, to_jsonb(m) FROM models m JOIN dup_pairs x ON m.id IN (x.source_id, x.target_id);
INSERT INTO model_merge_backup_20261118 (source_table, row_key, row_data)
SELECT 'api_channel_prices', c.id::text, to_jsonb(c) FROM api_channel_prices c JOIN dup_pairs x ON c.model_id IN (x.source_id, x.target_id);
INSERT INTO model_merge_backup_20261118 (source_table, row_key, row_data)
SELECT 'price_history', h.id::text, to_jsonb(h) FROM price_history h
JOIN api_channel_prices c ON c.id = h.channel_price_id JOIN dup_pairs x ON c.model_id IN (x.source_id, x.target_id);
DO $$
DECLARE dependency text;
BEGIN
  FOREACH dependency IN ARRAY ARRAY[
    'api_channel_price_variants', 'model_plan_mapping', 'model_offical', 'model_benchmark_scores',
    'evaluation_run', 'usage_prices', 'coding_agent_scores', 'external_price_references'
  ] LOOP
    EXECUTE format(
      'INSERT INTO model_merge_backup_20261118 (source_table, row_key, row_data)
       SELECT %L, d.id::text, to_jsonb(d) FROM %I d JOIN dup_pairs x ON d.model_id IN (x.source_id, x.target_id)',
      dependency, dependency);
  END LOOP;
END $$;

-- Losing channels: history follows the survivor, then the channel goes away.
UPDATE price_history h SET channel_price_id = cp.keep_channel
FROM channel_plan cp WHERE h.channel_price_id = ANY(cp.drop_channels);
DELETE FROM api_channel_prices c USING channel_plan cp WHERE c.id = ANY(cp.drop_channels);

-- Endpoint variants: only the surviving side keeps them for that provider.
DELETE FROM api_channel_price_variants v USING channel_plan cp
WHERE v.provider_id = cp.provider_id
  AND v.model_id IN (cp.source_id, cp.target_id) AND v.model_id <> cp.keep_side;
UPDATE api_channel_price_variants v SET model_id = x.target_id, updated_at = now()
FROM dup_pairs x WHERE v.model_id = x.source_id;

-- Surviving channels on the copy move to the canonical row.
UPDATE api_channel_prices c SET model_id = x.target_id, updated_at = now()
FROM dup_pairs x WHERE c.model_id = x.source_id;

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

-- Fill canonical metadata nulls from the copy; never overwrite curated values.
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
SELECT x.old_slug, x.target_id, 'Duplicate model row merge 2026-11-18'
FROM dup_pairs x
ON CONFLICT (old_slug) DO UPDATE SET model_id = EXCLUDED.model_id, reason = EXCLUDED.reason;

DELETE FROM models m USING dup_pairs x WHERE m.id = x.source_id;

-- ── VERIFICATION ─────────────────────────────────────────────────────────────
SELECT x.old_slug, x.new_slug, x.target_id,
       (SELECT count(*) FROM api_channel_prices c WHERE c.model_id = x.target_id) AS channels,
       (SELECT count(*) FROM channel_plan cp WHERE cp.source_id = x.source_id) AS expected_channels
FROM dup_pairs x
ORDER BY x.old_slug;

SELECT 'backup_rows' AS check, count(*) FROM model_merge_backup_20261118;

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
  -- Exactly one channel per provider on each canonical row, and none lost.
  IF EXISTS (
    SELECT 1 FROM api_channel_prices c JOIN dup_pairs x ON c.model_id = x.target_id
    GROUP BY c.model_id, c.provider_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'A canonical row has two channels for one provider'; END IF;
  IF EXISTS (
    SELECT 1 FROM channel_plan cp
    WHERE NOT EXISTS (SELECT 1 FROM api_channel_prices c
                      WHERE c.id = cp.keep_channel AND c.model_id = cp.target_id)
  ) THEN RAISE EXCEPTION 'A surviving channel is missing from its canonical row'; END IF;
  IF EXISTS (
    SELECT 1 FROM model_merge_backup_20261118 b
    LEFT JOIN price_history h ON h.id = CASE WHEN b.source_table = 'price_history' THEN b.row_key::bigint END
    LEFT JOIN api_channel_prices p ON p.id = h.channel_price_id
    WHERE b.source_table = 'price_history' AND (h.id IS NULL OR p.id IS NULL)
  ) THEN RAISE EXCEPTION 'Affected price history lost or orphaned'; END IF;
END $$;

COMMIT;
