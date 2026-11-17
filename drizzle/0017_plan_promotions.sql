-- Additive display metadata only. No data backfill or price changes.
-- Prepared for review; this task does not execute migrations.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz;
--> statement-breakpoint
ALTER TABLE plans ADD COLUMN IF NOT EXISTS regular_price real;
--> statement-breakpoint
ALTER TABLE plans ADD COLUMN IF NOT EXISTS regular_annual_price real;
