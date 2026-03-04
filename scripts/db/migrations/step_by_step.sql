-- 超简单迁移脚本 - 一步一步执行
-- 如果某一步失败，可以继续执行下一步

-- ========== 第1步：创建 providers 表 ==========
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  website_url TEXT,
  region TEXT DEFAULT 'global',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========== 第2步：插入供应商数据 ==========
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
ON CONFLICT (slug) DO NOTHING;

-- ========== 第3步：修改 products 表 ==========
-- 添加 provider_id 列（如果不存在）
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_id INTEGER DEFAULT 1;

-- 添加 context_window 列
ALTER TABLE products ADD COLUMN IF NOT EXISTS context_window INTEGER;

-- ========== 第4步：修改 channel_prices 表 ==========
-- 添加 last_verified 列
ALTER TABLE channel_prices ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP DEFAULT NOW();

-- 先清理重复数据（如果有）
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id, channel_id ORDER BY id) as rn
  FROM channel_prices
)
DELETE FROM channel_prices WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_prices_product_id_channel_id_key'
  ) THEN
    ALTER TABLE channel_prices ADD CONSTRAINT channel_prices_product_id_channel_id_key UNIQUE(product_id, channel_id);
  END IF;
END $$;

-- ========== 第5步：修改 channels 表 ==========
ALTER TABLE channels ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS access_from_china BOOLEAN DEFAULT false;

-- ========== 第6步：创建 plans 表 ==========
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_provider_id_slug_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_provider_id_slug_key UNIQUE(provider_id, slug);
  END IF;
END $$;

-- ========== 第7步：创建 scrape_logs 表 ==========
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

-- ========== 第8步：创建 price_history 表 ==========
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

-- ========== 完成 ==========
SELECT 'Migration completed! Run: SELECT * FROM providers;' as message;
