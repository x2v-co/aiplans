-- 完整的数据库表结构和约束

-- 1. 供应商表 (providers)
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

-- 2. 产品/模型表 (products)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'llm',
  context_window INTEGER,
  benchmark_score JSONB,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, slug)
);

-- 3. 渠道表 (channels)
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('official', 'cloud', 'aggregator', 'reseller')),
  website_url VARCHAR(255),
  region VARCHAR(50) DEFAULT 'global',
  access_from_china BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 渠道价格表 (channel_prices)
CREATE TABLE IF NOT EXISTS channel_prices (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
  input_price_per_1m REAL NOT NULL,
  output_price_per_1m REAL NOT NULL,
  cached_input_price_per_1m REAL,
  rate_limit VARCHAR(100),
  is_available BOOLEAN DEFAULT TRUE,
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, channel_id)
);

-- 5. 订阅计划表 (plans)
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  pricing_model VARCHAR(50) NOT NULL CHECK (pricing_model IN ('subscription', 'token_pack', 'pay_as_you_go')),
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'basic', 'pro', 'team', 'enterprise')),
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
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, slug)
);

-- 6. 价格变更历史表 (price_history)
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  channel_price_id INTEGER REFERENCES channel_prices(id) ON DELETE CASCADE,
  old_input_price REAL NOT NULL,
  new_input_price REAL NOT NULL,
  old_output_price REAL NOT NULL,
  new_output_price REAL NOT NULL,
  change_percent REAL NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- 7. 抓取日志表 (scrape_logs)
CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  models_found INTEGER DEFAULT 0,
  prices_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  duration_ms INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) STORED
);

-- 索引
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

-- 注释
COMMENT ON TABLE providers IS 'AI服务供应商';
COMMENT ON TABLE products IS 'AI模型/产品';
COMMENT ON TABLE channels IS '销售渠道';
COMMENT ON TABLE channel_prices IS '各渠道的模型定价';
COMMENT ON TABLE plans IS '订阅套餐';
COMMENT ON TABLE price_history IS '价格变更历史记录';
COMMENT ON TABLE scrape_logs IS '数据抓取日志';

-- 初始化基础数据
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
  (10, 'Zhipu AI', 'zhipu', 'https://www.zhipuai.cn', 'china')
ON CONFLICT (slug) DO NOTHING;
