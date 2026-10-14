-- Targeted additive migration; production uses scripts/migrate-data-accuracy.ts
-- on every rollout rather than the Drizzle snapshot diff / migration journal.
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz;
--> statement-breakpoint
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS regular_input_price_per_1m real;
--> statement-breakpoint
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS regular_output_price_per_1m real;
--> statement-breakpoint
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS regular_cached_input_price_per_1m real;
