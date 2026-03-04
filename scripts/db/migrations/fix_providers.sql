-- 修复已存在的 providers 表，添加缺失列
-- 然后插入数据

-- 第1步：为 providers 表添加缺失的列
ALTER TABLE providers ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 第2步：插入供应商数据（使用最简单的方式）
INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (1, 'OpenAI', 'openai', 'https://openai.com', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (2, 'Anthropic', 'anthropic', 'https://anthropic.com', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (3, 'DeepSeek', 'deepseek', 'https://deepseek.com', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (4, 'Google', 'google', 'https://ai.google.dev', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (5, 'Meta', 'meta', 'https://llama.meta.com', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (6, 'Mistral', 'mistral', 'https://mistral.ai', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (7, 'Alibaba', 'alibaba', 'https://www.alibabacloud.com', 'china')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (8, 'ByteDance', 'bytedance', 'https://www.volcengine.com', 'china')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (9, 'Moonshot', 'moonshot', 'https://www.moonshot.cn', 'china')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (10, 'Zhipu', 'zhipu', 'https://www.zhipuai.cn', 'china')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (11, 'XAI', 'xai', 'https://x.ai', 'global')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

-- 第3步：为 products 表添加列
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_id INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS context_window INTEGER;

-- 第4步：为 channels 表添加列
ALTER TABLE channels ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS access_from_china BOOLEAN DEFAULT false;

-- 第5步：为 channel_prices 添加列和约束
ALTER TABLE channel_prices ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP DEFAULT NOW();

-- 清理重复数据
DELETE FROM channel_prices a USING channel_prices b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.channel_id = b.channel_id;

-- 添加唯一约束
ALTER TABLE channel_prices DROP CONSTRAINT IF EXISTS channel_prices_product_id_channel_id_key;
ALTER TABLE channel_prices ADD CONSTRAINT channel_prices_product_id_channel_id_key UNIQUE(product_id, channel_id);

-- 第6步：创建 plans 表
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
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, slug)
);

-- 第7步：创建日志表
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

-- 验证
SELECT 'Migration completed! Checking results...' as status;
SELECT COUNT(*) as provider_count FROM providers;
SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('provider_id', 'context_window');
