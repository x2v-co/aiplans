-- ===== 修复 plans 表并完成迁移 =====

-- 1. 如果 plans 表存在，添加缺失的列
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
    -- 添加 provider_id 列
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'plans' AND column_name = 'provider_id'
    ) THEN
      ALTER TABLE plans ADD COLUMN provider_id INTEGER;
    END IF;

    -- 添加其他可能缺失的列
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'features') THEN
      ALTER TABLE plans ADD COLUMN features JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'models') THEN
      ALTER TABLE plans ADD COLUMN models JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'payment_methods') THEN
      ALTER TABLE plans ADD COLUMN payment_methods JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'region') THEN
      ALTER TABLE plans ADD COLUMN region TEXT DEFAULT 'global';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'access_from_china') THEN
      ALTER TABLE plans ADD COLUMN access_from_china BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'is_official') THEN
      ALTER TABLE plans ADD COLUMN is_official BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'last_verified') THEN
      ALTER TABLE plans ADD COLUMN last_verified TIMESTAMP DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- 2. 清理 channel_prices 重复数据
DELETE FROM channel_prices a USING channel_prices b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.channel_id = b.channel_id;

-- 3. 添加唯一约束
ALTER TABLE channel_prices DROP CONSTRAINT IF EXISTS channel_prices_product_id_channel_id_key;
ALTER TABLE channel_prices ADD CONSTRAINT channel_prices_product_id_channel_id_key UNIQUE(product_id, channel_id);

-- 4. 为 plans 添加唯一约束（现在 provider_id 列应该存在了）
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_provider_id_slug_key;
ALTER TABLE plans ADD CONSTRAINT plans_provider_id_slug_key UNIQUE(provider_id, slug);

-- 5. 插入供应商数据
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

-- 6. 创建日志表
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

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS idx_channel_prices_product_channel ON channel_prices(product_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_prices_last_verified ON channel_prices(last_verified DESC);
CREATE INDEX IF NOT EXISTS idx_plans_provider_slug ON plans(provider_id, slug);
CREATE INDEX IF NOT EXISTS idx_price_history_channel_price ON price_history(channel_price_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_completed_at ON scrape_logs(completed_at DESC);

-- 8. 验证完成
SELECT 'Migration completed successfully!' as status;

-- 检查关键表
SELECT
  'providers' as table_name,
  COUNT(*) as row_count
FROM providers
UNION ALL
SELECT 'plans', COUNT(*) FROM plans
UNION ALL
SELECT 'scrape_logs', COUNT(*) FROM scrape_logs
UNION ALL
SELECT 'price_history', COUNT(*) FROM price_history;

-- 检查关键列是否存在
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('providers', 'products', 'plans', 'channel_prices')
  AND column_name IN ('provider_id', 'context_window', 'region', 'last_verified')
ORDER BY table_name, column_name;
