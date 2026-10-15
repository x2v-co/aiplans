-- Channel-specific terms: unknown stays NULL. No data rows or backfills.
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS data_for_discount boolean;
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS data_for_discount_note text;
ALTER TABLE api_channel_prices ADD COLUMN IF NOT EXISTS quota_unit text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS data_for_discount boolean;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS data_for_discount_note text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS quota_unit text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'api_channel_prices'::regclass AND conname = 'api_channel_prices_quota_unit_check'
  ) THEN
    ALTER TABLE api_channel_prices ADD CONSTRAINT api_channel_prices_quota_unit_check
      CHECK (quota_unit IN ('usd', 'requests', 'tokens', 'credits'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'plans'::regclass AND conname = 'plans_quota_unit_check'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_quota_unit_check
      CHECK (quota_unit IN ('usd', 'requests', 'tokens', 'credits'));
  END IF;
END $$;
