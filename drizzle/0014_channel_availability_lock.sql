-- Manual take-down lock for API channels. Additive; no backfill.
-- availability_locked = true with is_available = false means a person or a
-- data seed retired the row (discontinued, retired, or past shutdown_date).
-- Scraper upserts keep such a row unavailable; only an explicit SQL change
-- (clear the lock) can bring it back.
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS availability_locked boolean NOT NULL DEFAULT false;
ALTER TABLE api_channel_price_variants ADD COLUMN IF NOT EXISTS availability_locked boolean NOT NULL DEFAULT false;
