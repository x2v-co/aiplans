-- MANUAL additive migration. Deliberately NOT registered in the auto-deploy runner.
-- Review before applying to a named database. No quotas or real measurements seeded.
CREATE TABLE IF NOT EXISTS quota_usage_samples (
  id serial PRIMARY KEY,
  plan_slug text NOT NULL,
  collector text NOT NULL,
  account_label text NOT NULL,
  observed_at timestamptz NOT NULL,
  "window" text NOT NULL,
  window_minutes integer,
  resets_at timestamptz,
  used_pct numeric,
  tokens_input bigint,
  tokens_cached bigint,
  tokens_cache_write bigint,
  tokens_output bigint,
  tokens_reasoning bigint,
  model text,
  raw jsonb,
  confidence text NOT NULL DEFAULT 'high',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_usage_samples_collector CHECK (collector IN ('codex-log', 'ccusage', 'cursor-dashboard', 'grok-bot', 'claude-usage')),
  CONSTRAINT quota_usage_samples_account_label CHECK (account_label ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  CONSTRAINT quota_usage_samples_window CHECK ("window" IN ('5h', 'daily', 'weekly', 'monthly')),
  CONSTRAINT quota_usage_samples_window_minutes CHECK (window_minutes > 0),
  CONSTRAINT quota_usage_samples_used_pct CHECK (used_pct >= 0 AND used_pct <= 100),
  CONSTRAINT quota_usage_samples_tokens CHECK (
    tokens_input >= 0 AND tokens_cached >= 0 AND tokens_cache_write >= 0
    AND tokens_output >= 0 AND tokens_reasoning >= 0
  ),
  CONSTRAINT quota_usage_samples_confidence CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT quota_usage_samples_observation_unique UNIQUE (collector, account_label, observed_at, "window")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quota_usage_samples_plan_observed_idx
  ON quota_usage_samples (plan_slug, observed_at DESC);
