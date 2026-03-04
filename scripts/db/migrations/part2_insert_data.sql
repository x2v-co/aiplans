-- ===== 第二部分：插入数据和创建其他表 =====
-- 请在第一部分执行成功后再执行这个部分

-- 清理可能的重复数据
DELETE FROM channel_prices a USING channel_prices b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.channel_id = b.channel_id;

-- 添加唯一约束
ALTER TABLE channel_prices DROP CONSTRAINT IF EXISTS channel_prices_product_id_channel_id_key;
ALTER TABLE channel_prices ADD CONSTRAINT channel_prices_product_id_channel_id_key UNIQUE(product_id, channel_id);

-- 插入供应商数据（现在 region 列应该存在了）
INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (1, 'OpenAI', 'openai', 'https://openai.com', 'global'),
  (2, 'Anthropic', 'anthropic', 'https://anthropic.com', 'global'),
  (3, 'DeepSeek', 'deepseek', 'https://deepseek.com', 'global'),
  (4, 'Google', 'google', 'https://ai.google.dev', 'global'),
  (5, 'Meta', 'meta', 'https://llama.meta.com', 'global'),
  (6, 'Mistral', 'mistral', 'https://mistral.ai', 'global'),
  (7, 'Alibaba', 'alibaba', 'https://www.alibabacloud.com', 'china'),
  (8, 'ByteDance', 'bytedance', 'https://www.volcengine.com', 'china'),
  (9, 'Moonshot', 'moonshot', 'https://www.moonshot.cn', 'china'),
  (10, 'Zhipu', 'zhipu', 'https://www.zhipuai.cn', 'china'),
  (11, 'XAI', 'xai', 'https://x.ai', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

-- 创建 plans 表
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  pricing_model TEXT DEFAULT 'subscription',
  tier TEXT DEFAULT 'free',
  price_monthly REAL NOT NULL,
  price_yearly REAL,
  features JSONB,
  models JSONB,
  region TEXT DEFAULT 'global',
  access_from_china BOOLEAN DEFAULT false,
  payment_methods JSONB,
  is_official BOOLEAN DEFAULT true,
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 为 plans 添加唯一约束
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_provider_id_slug_key;
ALTER TABLE plans ADD CONSTRAINT plans_provider_id_slug_key UNIQUE(provider_id, slug);

-- 创建日志表
CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  models_found INTEGER DEFAULT 0,
  prices_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  channel_price_id INTEGER,
  old_input_price REAL NOT NULL,
  new_input_price REAL NOT NULL,
  old_output_price REAL NOT NULL,
  new_output_price REAL NOT NULL,
  change_percent REAL NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_channel_prices_product_channel ON channel_prices(product_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_plans_provider_slug ON plans(provider_id, slug);

-- 验证完成
SELECT 'Migration completed!' as status;
SELECT COUNT(*) as provider_count, 'providers' as table_name FROM providers
UNION ALL
SELECT COUNT(*), 'plans' FROM plans
UNION ALL
SELECT COUNT(*), 'scrape_logs' FROM scrape_logs
UNION ALL
SELECT COUNT(*), 'price_history' FROM price_history;
