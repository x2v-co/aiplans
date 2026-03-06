-- 添加腾讯云 Coding Plan
-- 腾讯云: https://cloud.tencent.com/document/product/1772/128947
-- 购买链接: https://buy.cloud.tencent.com/hunyuan

-- 1. 获取或创建 Hunyuan Provider (腾讯混元)
INSERT INTO providers (name, slug, website_url, description, region) VALUES
  ('腾讯混元', 'hunyuan', 'https://hunyuan.tencent.com', '腾讯混元 AI 大模型', 'china')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description;

-- 2. 添加 Lite 套餐
INSERT INTO plans (
  provider_id,
  name,
  slug,
  pricing_model,
  price,
  price_unit,
  tier,
  currency,
  region,
  access_from_china,
  payment_methods,
  features,
  is_official
) VALUES (
  (SELECT id FROM providers WHERE slug = 'hunyuan'),
  'Lite',
  'lite',
  'subscription',
  7.9,
  'per_month',
  'basic',
  'CNY',
  'china',
  true,
  '["alipay", "wechat", "credit_card"]'::jsonb,
  '["每5小时最多约1,200次请求", "每周最多约9,000次请求", "每订阅月最多约18,000次请求", "支持模型: Tencent HY 2.0, GLM-5, Kimi-K2.5, MiniMax-M2.5", "支持工具: OpenClaw, Codebuddy, Claude Code, Cline, Cursor", "首月特惠7.9元", "次月20元(5折)", "第三月起40元/月"]'::jsonb,
  true
) ON CONFLICT (provider_id, slug) DO NOTHING;

-- 3. 添加 Pro 套餐
INSERT INTO plans (
  provider_id,
  name,
  slug,
  pricing_model,
  price,
  price_unit,
  tier,
  currency,
  region,
  access_from_china,
  payment_methods,
  features,
  is_official
) VALUES (
  (SELECT id FROM providers WHERE slug = 'hunyuan'),
  'Pro',
  'pro',
  'subscription',
  39.9,
  'per_month',
  'pro',
  'CNY',
  'china',
  true,
  '["alipay", "wechat", "credit_card"]'::jsonb,
  '["每5小时最多约6,000次请求", "每周最多约45,000次请求", "每订阅月最多约90,000次请求", "支持模型: Tencent HY 2.0, GLM-5, Kimi-K2.5, MiniMax-M2.5", "支持工具: OpenClaw, Codebuddy, Claude Code, Cline, Cursor", "首月特惠39.9元", "次月100元(5折)", "第三月起200元/月"]'::jsonb,
  true
) ON CONFLICT (provider_id, slug) DO NOTHING;
