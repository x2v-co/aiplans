-- ===== 第一部分：只添加列，不插入数据 =====
-- 请先执行这个部分

-- 为 providers 表添加所有可能缺失的列
ALTER TABLE providers ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 为 products 表添加列
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_id INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS context_window INTEGER;

-- 为 channels 表添加列
ALTER TABLE channels ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS access_from_china BOOLEAN DEFAULT false;

-- 为 channel_prices 添加列
ALTER TABLE channel_prices ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP DEFAULT NOW();

-- 验证列是否添加成功
SELECT 'Step 1 completed! Check columns:' as message;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'providers'
ORDER BY ordinal_position;
