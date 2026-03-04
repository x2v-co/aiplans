-- Sample seed data for testing the comparison feature
-- Run this in Supabase SQL Editor

-- First, let's check if we have any providers and products
-- If not, you'll need to add those first

-- Example: Add a sample Claude plan if you have a Claude product
-- Replace the product_id with an actual ID from your products table

-- Get product IDs first:
-- SELECT id, name, slug FROM products;

-- Then insert sample plans (adjust product_id to match your data):
INSERT INTO plans (
  product_id,
  name,
  slug,
  pricing_model,
  price,
  price_unit,
  tier,
  rate_limit,
  requests_per_minute,
  qps,
  price_yearly_monthly,
  yearly_discount_percent,
  is_official,
  plan_tier,
  billing_granularity,
  access_from_china,
  payment_methods,
  features
) VALUES (
  -- Replace 1 with actual product_id for Claude 3.5 Sonnet
  1,
  'Claude Pro',
  'claude-pro',
  'subscription',
  20.00,
  'month',
  'pro',
  50,
  50,
  5,
  16.67,
  16.65,
  true,
  'pro',
  'flat_monthly',
  false,
  '["credit_card"]'::jsonb,
  '["200K context", "Priority access", "Early features"]'::jsonb
) ON CONFLICT DO NOTHING;

-- Add a "free" tier plan
INSERT INTO plans (
  product_id,
  name,
  slug,
  pricing_model,
  price,
  price_unit,
  tier,
  rate_limit,
  requests_per_minute,
  qps,
  is_official,
  plan_tier,
  access_from_china,
  daily_message_limit
) VALUES (
  1,
  'Claude Free',
  'claude-free',
  'subscription',
  0.00,
  'month',
  'free',
  10,
  10,
  1,
  true,
  'free',
  false,
  10
) ON CONFLICT DO NOTHING;

-- Note: This is just example data
-- Adjust product_id and values based on your actual products table
