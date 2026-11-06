-- Official supported purchase/access countries (ISO 3166-1 alpha-2, uppercase).
-- NULL = unknown/unresearched; [] = researched, officially zero countries.
-- No sentinel codes. providers.region/plans.region remain separate metadata.
-- Additive and rerunnable: no existing rows are updated or backfilled.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS supported_regions text[];
ALTER TABLE providers ADD COLUMN IF NOT EXISTS regions_source_url text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS regions_verified_at timestamptz;
ALTER TABLE providers ALTER COLUMN access_from_china DROP DEFAULT;
ALTER TABLE providers ALTER COLUMN access_from_china SET DEFAULT NULL;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS supported_regions text[];
ALTER TABLE plans ADD COLUMN IF NOT EXISTS regions_source_url text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS regions_verified_at timestamptz;
ALTER TABLE plans ALTER COLUMN access_from_china DROP DEFAULT;
ALTER TABLE plans ALTER COLUMN access_from_china SET DEFAULT NULL;
