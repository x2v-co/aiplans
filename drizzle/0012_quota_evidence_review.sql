-- Manual additive migration. Deliberately NOT registered in the auto-deploy runner.
-- Requires 0005_quota_estimates.sql. Review before applying to a named database.
ALTER TABLE quota_evidence
  ADD COLUMN confidence text NOT NULL DEFAULT 'low'
    CONSTRAINT quota_evidence_confidence CHECK (confidence IN ('high', 'medium', 'low')),
  ADD COLUMN observed_at timestamptz,
  ADD COLUMN source_name text,
  ADD COLUMN author_handle text,
  ADD COLUMN usage_mix_id text REFERENCES usage_mixes(id),
  ADD COLUMN tokens_input bigint,
  ADD COLUMN tokens_cached bigint,
  ADD COLUMN tokens_output bigint,
  ADD COLUMN quota_pct_before numeric,
  ADD COLUMN quota_pct_after numeric,
  ADD COLUMN "window" text,
  ADD COLUMN review_status text DEFAULT 'pending'
    CONSTRAINT quota_evidence_review_status CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN content_hash text CONSTRAINT quota_evidence_content_hash_unique UNIQUE;
