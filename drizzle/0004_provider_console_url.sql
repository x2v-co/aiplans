-- Targeted additive migration, registered in scripts/migrate-data-accuracy.ts.
-- 0003 is reserved for the model shutdown migration (PR #106).
ALTER TABLE providers ADD COLUMN IF NOT EXISTS console_url text;
