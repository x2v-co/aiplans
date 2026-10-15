-- Manual additive migration. Deliberately NOT registered in the auto-deploy runner.
-- Review this file before applying; no subscription quota estimates are seeded.
CREATE TABLE IF NOT EXISTS usage_mixes (
  id text PRIMARY KEY,
  name text NOT NULL,
  cache_read_pct numeric NOT NULL,
  input_pct numeric NOT NULL,
  output_pct numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_mixes_percentages CHECK (
    cache_read_pct >= 0 AND input_pct >= 0 AND output_pct >= 0
    AND cache_read_pct + input_pct + output_pct = 100
  )
);
--> statement-breakpoint
INSERT INTO usage_mixes (id, name, cache_read_pct, input_pct, output_pct, description)
VALUES
  ('coding-high-cache', 'Coding (high cache)', 97, 2.5, 0.5,
   'Our comparison assumption for high-cache coding; not a measured vendor workload.'),
  ('chat', 'Typical chat', 0, 75, 25,
   'Our own assumption for typical chat; not a measured vendor workload.')
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS quota_estimates (
  id serial PRIMARY KEY,
  plan_id integer REFERENCES plans(id),
  plan_slug text NOT NULL,
  served_model text,
  "window" text NOT NULL,
  est_tokens_low bigint NOT NULL,
  est_tokens_high bigint NOT NULL,
  usage_mix_id text NOT NULL REFERENCES usage_mixes(id),
  confidence text NOT NULL,
  verified_at timestamptz,
  notes text,
  is_current boolean NOT NULL DEFAULT true,
  superseded_by integer REFERENCES quota_estimates(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_estimates_window CHECK ("window" IN ('5h', 'daily', 'weekly', 'monthly')),
  CONSTRAINT quota_estimates_tokens CHECK (est_tokens_low >= 0 AND est_tokens_low <= est_tokens_high),
  CONSTRAINT quota_estimates_confidence CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT quota_estimates_supersession CHECK (superseded_by IS NULL OR (superseded_by <> id AND NOT is_current))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS quota_estimates_current_idx
  ON quota_estimates (plan_slug, COALESCE(served_model, ''), "window", usage_mix_id)
  WHERE is_current;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quota_estimates_history_idx ON quota_estimates (plan_slug, created_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS quota_evidence (
  id serial PRIMARY KEY,
  quota_estimate_id integer REFERENCES quota_estimates(id),
  plan_slug text,
  evidence_type text NOT NULL,
  url text,
  captured_at date NOT NULL DEFAULT CURRENT_DATE,
  raw_value text,
  screenshot_url text,
  notes text,
  CONSTRAINT quota_evidence_type CHECK (
    evidence_type IN ('self_measured', 'official_absolute', 'official_text', 'community', 'derived')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quota_evidence_estimate_idx ON quota_evidence (quota_estimate_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS quota_text_snapshots (
  id serial PRIMARY KEY,
  source_id text NOT NULL,
  url text NOT NULL,
  content_hash text NOT NULL,
  extracted_text text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  changed boolean NOT NULL DEFAULT false,
  alerted_at timestamptz,
  CONSTRAINT quota_text_snapshots_source_hash_unique UNIQUE (source_id, content_hash)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quota_text_snapshots_latest_idx
  ON quota_text_snapshots (source_id, fetched_at DESC, id DESC);
