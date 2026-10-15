-- Additive audit fields. NULL credit amount means unknown, never zero.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_api_credit_usd real;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_api_credit_status text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS legacy_ends_on date;
-- Expand the existing taxonomy constraint; preserve every previous category.
ALTER TABLE models DROP CONSTRAINT IF EXISTS models_model_category_chk;
ALTER TABLE models ADD CONSTRAINT models_model_category_chk CHECK (
  model_category IN ('text','image','video','audio','music','world','embedding','speech','agent','decision')
);
