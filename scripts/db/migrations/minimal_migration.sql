-- 最小化迁移脚本 - 只添加关键的缺失部分
-- 适用于已有基础表结构的情况

-- 步骤1: 创建 providers 表
CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  website_url VARCHAR(255),
  logo_url VARCHAR(255),
  region VARCHAR(50) DEFAULT 'global',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 步骤2: 初始化供应商
INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (1, 'OpenAI', 'openai', 'https://openai.com', 'global'),
  (2, 'Anthropic', 'anthropic', 'https://anthropic.com', 'global'),
  (3, 'DeepSeek', 'deepseek', 'https://deepseek.com', 'global'),
  (4, 'Google', 'google', 'https://ai.google.dev', 'global'),
  (5, 'Meta', 'meta', 'https://llama.meta.com', 'global'),
  (6, 'Mistral AI', 'mistral', 'https://mistral.ai', 'global'),
  (7, 'Alibaba', 'alibaba', 'https://www.alibabacloud.com', 'china'),
  (8, 'ByteDance', 'bytedance', 'https://www.volcengine.com', 'china'),
  (9, 'Moonshot', 'moonshot', 'https://www.moonshot.cn', 'china'),
  (10, 'Zhipu AI', 'zhipu', 'https://www.zhipuai.cn', 'china'),
  (11, 'X.AI', 'xai', 'https://x.ai', 'global')
ON CONFLICT (slug) DO NOTHING;

-- 步骤3: 为 products 表添加 provider_id（如果表已存在）
DO $$
BEGIN
  -- 检查 products 表是否存在
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    -- 添加 provider_id 列
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'provider_id'
    ) THEN
      ALTER TABLE products ADD COLUMN provider_id INTEGER DEFAULT 1;
      -- 添加外键
      ALTER TABLE products ADD CONSTRAINT fk_products_provider
        FOREIGN KEY (provider_id) REFERENCES providers(id);
    END IF;

    -- 添加 context_window
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'context_window'
    ) THEN
      ALTER TABLE products ADD COLUMN context_window INTEGER;
    END IF;
  END IF;
END $$;

-- 步骤4: 为 channel_prices 添加唯一约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_prices') THEN
    -- 删除可能的重复数据
    DELETE FROM channel_prices a USING channel_prices b
    WHERE a.id < b.id
      AND a.product_id = b.product_id
      AND a.channel_id = b.channel_id;

    -- 添加唯一约束
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'uq_channel_prices_product_channel'
    ) THEN
      ALTER TABLE channel_prices
        ADD CONSTRAINT uq_channel_prices_product_channel
        UNIQUE(product_id, channel_id);
    END IF;

    -- 添加 last_verified
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'channel_prices' AND column_name = 'last_verified'
    ) THEN
      ALTER TABLE channel_prices ADD COLUMN last_verified TIMESTAMP DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- 步骤5: 为 channels 表添加额外字段
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'channels' AND column_name = 'website_url'
    ) THEN
      ALTER TABLE channels ADD COLUMN website_url VARCHAR(255);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'channels' AND column_name = 'region'
    ) THEN
      ALTER TABLE channels ADD COLUMN region VARCHAR(50) DEFAULT 'global';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'channels' AND column_name = 'access_from_china'
    ) THEN
      ALTER TABLE channels ADD COLUMN access_from_china BOOLEAN DEFAULT FALSE;
    END IF;
  END IF;
END $$;

-- 步骤6: 创建 plans 表
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER REFERENCES providers(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  pricing_model VARCHAR(50) NOT NULL DEFAULT 'subscription',
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  price_monthly REAL NOT NULL,
  price_yearly REAL,
  daily_message_limit INTEGER,
  requests_per_minute INTEGER,
  features JSONB,
  models JSONB,
  region VARCHAR(50) DEFAULT 'global',
  access_from_china BOOLEAN DEFAULT FALSE,
  payment_methods JSONB,
  is_official BOOLEAN DEFAULT TRUE,
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, slug)
);

-- 步骤7: 创建 price_history 和 scrape_logs
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  channel_price_id INTEGER REFERENCES channel_prices(id) ON DELETE CASCADE,
  old_input_price REAL NOT NULL,
  new_input_price REAL NOT NULL,
  old_output_price REAL NOT NULL,
  new_output_price REAL NOT NULL,
  change_percent REAL NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  models_found INTEGER DEFAULT 0,
  prices_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_channel_prices_product_channel ON channel_prices(product_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_prices_last_verified ON channel_prices(last_verified DESC);
CREATE INDEX IF NOT EXISTS idx_plans_provider_slug ON plans(provider_id, slug);
CREATE INDEX IF NOT EXISTS idx_price_history_channel_price ON price_history(channel_price_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_completed_at ON scrape_logs(completed_at DESC);

SELECT 'Minimal migration completed!' AS status;
