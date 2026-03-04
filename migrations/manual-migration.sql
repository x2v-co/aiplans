-- Manual Migration for Compare Plans Feature
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add request limits to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_minute INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_day INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_month INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS qps INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS concurrent_requests INTEGER;

-- 2. Add token limits to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_minute INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_day BIGINT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_month BIGINT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_tokens_per_request INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_input_tokens INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER;

-- 3. Add yearly pricing to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly_monthly REAL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS yearly_discount_percent REAL;

-- 4. Add plan metadata
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_granularity VARCHAR(30);

-- 5. Add overage pricing to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_overage_pricing BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS overage_input_price_per_1m REAL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS overage_output_price_per_1m REAL;

-- 6. Create model_plan_mapping table
CREATE TABLE IF NOT EXISTS model_plan_mapping (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) NOT NULL,
  plan_id INTEGER REFERENCES plans(id) NOT NULL,
  override_rpm INTEGER,
  override_qps INTEGER,
  override_input_price_per_1m REAL,
  override_output_price_per_1m REAL,
  override_max_output_tokens INTEGER,
  is_available BOOLEAN DEFAULT TRUE,
  note VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, plan_id)
);

-- 7. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_model_plan_mapping_product ON model_plan_mapping(product_id);
CREATE INDEX IF NOT EXISTS idx_model_plan_mapping_plan ON model_plan_mapping(plan_id);

-- Done! The schema is now updated.
