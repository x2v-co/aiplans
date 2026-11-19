-- EXPLICIT operator bootstrap, never called by preview/freeze. No public-table changes.
-- Execute only through bootstrapO3(), which refuses an existing namespace.
CREATE SCHEMA o3_executor;
CREATE TABLE o3_executor.commits (
  plan_digest text PRIMARY KEY,
  journal_hash text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('APPLIED','RESTORED')),
  post_state jsonb NOT NULL
);
