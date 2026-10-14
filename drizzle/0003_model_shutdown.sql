-- Targeted additive migration; registered in scripts/migrate-data-accuracy.ts.
-- NULL means no announced shutdown is recorded, not that the model is retired.
ALTER TABLE models ADD COLUMN IF NOT EXISTS shutdown_date date;
--> statement-breakpoint
ALTER TABLE models ADD COLUMN IF NOT EXISTS replacement_model text;
--> statement-breakpoint
ALTER TABLE models ADD COLUMN IF NOT EXISTS deprecation_source_url text;
