-- 安全的增量迁移脚本
-- 此脚本会检查列是否存在再添加，避免重复执行错误

-- ============================================
-- 1. 创建 providers 表（如果不存在）
-- ============================================
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

-- ============================================
-- 2. 为 products 表添加 provider_id 列（如果不存在）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE products ADD COLUMN provider_id INTEGER;
    ALTER TABLE products ADD CONSTRAINT fk_products_provider
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 添加其他缺失的列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'context_window'
  ) THEN
    ALTER TABLE products ADD COLUMN context_window INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'benchmark_score'
  ) THEN
    ALTER TABLE products ADD COLUMN benchmark_score JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description TEXT;
  END IF;
END $$;

-- ============================================
-- 3. 创建 channels 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL DEFAULT 'aggregator',
  website_url VARCHAR(255),
  region VARCHAR(50) DEFAULT 'global',
  access_from_china BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 为已有的 channels 表添加缺失列
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

-- ============================================
-- 4. 创建 channel_prices 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS channel_prices (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  channel_id INTEGER,
  input_price_per_1m REAL NOT NULL,
  output_price_per_1m REAL NOT NULL,
  cached_input_price_per_1m REAL,
  rate_limit VARCHAR(100),
  is_available BOOLEAN DEFAULT TRUE,
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加外键约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_channel_prices_product'
  ) THEN
    ALTER TABLE channel_prices
      ADD CONSTRAINT fk_channel_prices_product
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_channel_prices_channel'
  ) THEN
    ALTER TABLE channel_prices
      ADD CONSTRAINT fk_channel_prices_channel
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_channel_prices_product_channel'
  ) THEN
    ALTER TABLE channel_prices
      ADD CONSTRAINT uq_channel_prices_product_channel
      UNIQUE(product_id, channel_id);
  END IF;
END $$;

-- 为 channel_prices 添加缺失列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_prices' AND column_name = 'last_verified'
  ) THEN
    ALTER TABLE channel_prices ADD COLUMN last_verified TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- 5. 创建 plans 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  pricing_model VARCHAR(50) NOT NULL DEFAULT 'subscription',
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  price_monthly REAL NOT NULL,
  price_yearly REAL,
  daily_message_limit INTEGER,
  requests_per_minute INTEGER,
  qps INTEGER,
  tokens_per_minute INTEGER,
  features JSONB,
  models JSONB,
  region VARCHAR(50) DEFAULT 'global',
  access_from_china BOOLEAN DEFAULT FALSE,
  payment_methods JSONB,
  is_official BOOLEAN DEFAULT TRUE,
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加外键约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_plans_provider'
  ) THEN
    ALTER TABLE plans
      ADD CONSTRAINT fk_plans_provider
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 添加唯一约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_plans_provider_slug'
  ) THEN
    ALTER TABLE plans
      ADD CONSTRAINT uq_plans_provider_slug
      UNIQUE(provider_id, slug);
  END IF;
END $$;

-- ============================================
-- 6. 创建 price_history 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  channel_price_id INTEGER,
  old_input_price REAL NOT NULL,
  new_input_price REAL NOT NULL,
  old_output_price REAL NOT NULL,
  new_output_price REAL NOT NULL,
  change_percent REAL NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- 添加外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_price_history_channel_price'
  ) THEN
    ALTER TABLE price_history
      ADD CONSTRAINT fk_price_history_channel_price
      FOREIGN KEY (channel_price_id) REFERENCES channel_prices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 7. 创建 scrape_logs 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  models_found INTEGER DEFAULT 0,
  prices_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  duration_ms INTEGER
);

-- ============================================
-- 8. 创建索引（如果不存在）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_provider ON products(provider_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_channel_prices_product ON channel_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_prices_channel ON channel_prices(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_prices_last_verified ON channel_prices(last_verified DESC);
CREATE INDEX IF NOT EXISTS idx_plans_provider ON plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_plans_tier ON plans(tier);
CREATE INDEX IF NOT EXISTS idx_price_history_channel_price ON price_history(channel_price_id);
CREATE INDEX IF NOT EXISTS idx_price_history_detected_at ON price_history(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_completed_at ON scrape_logs(completed_at DESC);

-- ============================================
-- 9. 初始化供应商数据
-- ============================================
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
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  region = EXCLUDED.region;

-- ============================================
-- 10. 为 products 表添加唯一约束（如果不存在）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_products_provider_slug'
  ) THEN
    -- 先删除重复数据（如果有）
    DELETE FROM products a USING products b
    WHERE a.id < b.id
      AND a.provider_id = b.provider_id
      AND a.slug = b.slug;

    -- 添加唯一约束
    ALTER TABLE products
      ADD CONSTRAINT uq_products_provider_slug
      UNIQUE(provider_id, slug);
  END IF;
END $$;

-- ============================================
-- 完成！
-- ============================================
SELECT 'Migration completed successfully!' AS status;
