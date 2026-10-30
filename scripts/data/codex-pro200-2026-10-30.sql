-- Optional SRE seed; never run automatically by the application.
-- The current benchmark is versioned in public/reports, not quota_estimates.
-- Retain the exact 10-28 Astra rows as history instead of overwriting them.
-- Review with SELECT using the predicate below, then apply in one transaction:
-- psql "$DATABASE_URL" --single-transaction --set ON_ERROR_STOP=1 --file <this file>
-- Sol cannot be stored here: quota_estimates requires a finite high value.
UPDATE quota_estimates
SET is_current = false,
    notes = concat_ws(E'\n', NULLIF(notes, ''),
      'Historical 2026-10-28 Codex Pro 200 Astra measurement: https://aiplans.dev/reports/codex-models-2026-10-28.md',
      'Current weekly retest (2026-10-30): https://aiplans.dev/reports/codex-models-2026-10-30.md')
WHERE plan_slug IN ('chatgpt-pro', 'chatgpt-pro-200')
  AND (served_model IS NULL OR served_model = 'gpt-6-astra')
  AND "window" = 'weekly'
  AND est_tokens_low = 64883075 AND est_tokens_high = 129766150
  AND is_current = true AND superseded_by IS NULL
RETURNING id, plan_slug, served_model, "window", est_tokens_low, est_tokens_high, is_current;
