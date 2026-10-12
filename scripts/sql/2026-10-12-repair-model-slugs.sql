-- One-off repair for model slugs rewritten by the old getOrCreateProduct
-- name-match rename (removed in #80). NOT run automatically; needs approval.
-- Ends without COMMIT: review the result sets, then COMMIT or ROLLBACK.
--
-- Only rows whose original slug is determinable from source data / scraper
-- code are changed. Each old slug gets a model_slug_redirects row, so
--   * /<locale>/models/<old> and /<locale>/compare/plans/<old> 308 to the new slug
--   * scrapers that still emit the old slug attach to the same model row.
-- Conflict policy: if the target slug already belongs to another model, the
-- row is SKIPPED (not merged) and listed below for a human decision — merging
-- means moving api_channel_prices / variants / mappings / price_history.

BEGIN;

CREATE TABLE IF NOT EXISTS model_slug_redirects (
  old_slug   text PRIMARY KEY,
  model_id   integer NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE slug_repair (
  id               integer PRIMARY KEY,
  expected_current text NOT NULL,
  new_slug         text NOT NULL,
  evidence         text NOT NULL
) ON COMMIT DROP;

INSERT INTO slug_repair (id, expected_current, new_slug, evidence) VALUES
  -- Canonical slugs referenced in code
  (2661, 'deepseek-deepseek-chat',            'deepseek-v3',          'src/lib/hot-models.ts + model-normalizer canonical map'),
  (2778, 'qwen-qwen3-235b-a22b-2507',         'qwen3-235b-a22b',      'scripts/scrapers/qwen-dynamic.ts official model name'),
  (2818, 'mistral-mistral-large-2407',        'mistral-large-2',      'model-normalizer canonical map'),
  -- Batch rows: fix-add-variant-models.ts creates them with slug = name
  (3132, 'mistral-codestral-2508-batch',               'codestral-batch',                'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3133, 'deepseek-deepseek-v4-flash-0731-batch',      'deepseek-v4-flash-batch',        'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3134, 'deepseek-deepseek-v4-flash-vision-exp-batch','deepseek-v4-flash-vision-batch', 'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3135, 'deepseek-deepseek-v4-pro-0813-batch',        'deepseek-v4-pro-batch',          'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3139, 'google-gemini-gemini-3-flash-preview-batch', 'gemini-3-flash-batch',           'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3141, 'google-gemini-gemini-3-1-pro-preview-batch', 'gemini-3.1-pro-batch',           'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3187, 'mistral-ministral-8b-2512-batch',            'ministral-8b-batch',             'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3188, 'mistral-mistral-large-2512-batch',           'mistral-large-batch',            'fix-add-variant-models.ts VARIANT_SLUGS'),
  (3191, 'mistral-mistral-small-2603-batch',           'mistral-small-batch',            'fix-add-variant-models.ts VARIANT_SLUGS');

-- NEEDS HUMAN JUDGMENT — uncomment this statement only after deciding
-- (proposed slug = models.name; no code evidence of the original slug):
-- INSERT INTO slug_repair (id, expected_current, new_slug, evidence) VALUES
--   (2758, 'qwen-qwen3-30b-a3b-thinking-2507',    'qwen3-30b-a3b-thinking',       'name; not on OpenRouter now'),
--   (2773, 'qwen-qwen3-235b-a22b-thinking-2507',  'qwen3-235b-a22b-thinking',     'name; OpenRouter only lists the -2507 id'),
--   (2775, 'qwen-qwen3-coder',                    'qwen3-coder-480b-a35b',        'name; OpenRouter qwen/qwen3-coder is the 480B-A35B model'),
--   (2788, 'google-gemini-gemini-2-5-pro-preview','gemini-2.5-pro-preview-06-05', 'name; OpenRouter alias points at the 06-05 snapshot');

-- Backup of every affected row, current state.
CREATE TABLE models_slug_backup_20261012 AS
  SELECT m.*, now() AS backed_up_at FROM models m WHERE m.id IN (SELECT id FROM slug_repair);

-- Preview: planned action per id.
SELECT r.id, m.slug AS current_slug, r.new_slug, r.evidence,
       CASE
         WHEN m.id IS NULL THEN 'skip: model missing'
         WHEN m.slug <> r.expected_current THEN 'skip: slug changed since audit'
         WHEN o.id IS NOT NULL THEN 'skip: CONFLICT with model ' || o.id || ' (' || o.name || ') — human merge/keep decision'
         ELSE 'rename + redirect'
       END AS action
FROM slug_repair r
LEFT JOIN models m ON m.id = r.id
LEFT JOIN models o ON o.slug = r.new_slug AND o.id <> r.id
ORDER BY r.id;

UPDATE models m
SET slug = r.new_slug, updated_at = now()
FROM slug_repair r
WHERE m.id = r.id
  AND m.slug = r.expected_current
  AND NOT EXISTS (SELECT 1 FROM models o WHERE o.slug = r.new_slug AND o.id <> r.id);

INSERT INTO model_slug_redirects (old_slug, model_id, reason)
SELECT r.expected_current, r.id, 'slug repair 2026-10-12: ' || r.evidence
FROM slug_repair r JOIN models m ON m.id = r.id AND m.slug = r.new_slug
ON CONFLICT (old_slug) DO NOTHING;

-- Verification: final state per id (expect renamed = true except listed conflicts).
SELECT r.id, b.slug AS before_slug, m.slug AS after_slug, (m.slug = r.new_slug) AS renamed,
       (SELECT count(*) FROM model_slug_redirects x WHERE x.model_id = r.id) AS redirects
FROM slug_repair r
JOIN models_slug_backup_20261012 b ON b.id = r.id
JOIN models m ON m.id = r.id
ORDER BY r.id;

-- Rollback after COMMIT, if ever needed:
--   UPDATE models m SET slug = b.slug FROM models_slug_backup_20261012 b WHERE m.id = b.id;
--   DELETE FROM model_slug_redirects WHERE reason LIKE 'slug repair 2026-10-12:%';

-- COMMIT;
