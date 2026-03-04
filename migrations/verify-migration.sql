-- Verify migration was successful
-- Run this in Supabase SQL Editor to check

-- 1. Check plans table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'plans'
  AND column_name IN (
    'requests_per_minute',
    'qps',
    'price_yearly_monthly',
    'is_official',
    'plan_tier'
  )
ORDER BY column_name;

-- 2. Check if model_plan_mapping table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'model_plan_mapping'
) as table_exists;

-- 3. Count existing plans (to see if we have data)
SELECT COUNT(*) as total_plans FROM plans;

-- 4. Count existing products/models
SELECT COUNT(*) as total_models FROM products;
