# 🔧 数据库迁移错误修复指南

## 错误信息
```
Error: Failed to run sql query: ERROR: 42703: column "provider_id" does not exist
```

## 原因
数据库表结构缺少爬虫所需的关键列和表。

## ✅ 解决方案（3个选项，选择其一）

---

### 方案 1: 最小化迁移（推荐）⭐

**适用于**: 已有基础表结构，只需要添加缺失部分

**步骤**:
1. 打开 Supabase SQL Editor
2. 复制并执行: `scripts/db/migrations/minimal_migration.sql`
3. 等待执行完成（应该显示 "Minimal migration completed!"）
4. 运行 `npm run scrape`

**这个脚本会**:
- ✅ 创建 `providers` 表
- ✅ 为 `products` 表添加 `provider_id` 列
- ✅ 为 `channel_prices` 添加唯一约束（解决 ON CONFLICT 错误）
- ✅ 创建 `plans` 表
- ✅ 创建 `price_history` 和 `scrape_logs` 表
- ✅ 初始化11个供应商数据

---

### 方案 2: 完整安全迁移

**适用于**: 想要完整的表结构和所有约束

**步骤**:
1. 打开 Supabase SQL Editor
2. 复制并执行: `scripts/db/migrations/safe_migration.sql`
3. 等待执行完成
4. 运行 `npm run scrape`

**这个脚本会**:
- ✅ 使用 `IF NOT EXISTS` 检查，安全添加所有表和列
- ✅ 添加所有外键约束和唯一约束
- ✅ 创建所有索引
- ✅ 初始化供应商数据
- ✅ 可重复执行，不会报错

---

### 方案 3: 手动快速修复

如果只想快速测试，可以只执行以下SQL：

```sql
-- 1. 创建 providers 表
CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  website_url VARCHAR(255),
  region VARCHAR(50) DEFAULT 'global',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 初始化供应商
INSERT INTO providers (id, name, slug, website_url, region) VALUES
  (1, 'OpenAI', 'openai', 'https://openai.com', 'global'),
  (2, 'Anthropic', 'anthropic', 'https://anthropic.com', 'global'),
  (3, 'DeepSeek', 'deepseek', 'https://deepseek.com', 'global'),
  (4, 'Google', 'google', 'https://ai.google.dev', 'global'),
  (5, 'Meta', 'meta', 'https://llama.meta.com', 'global'),
  (6, 'Mistral AI', 'mistral', 'https://mistral.ai', 'global')
ON CONFLICT (slug) DO NOTHING;

-- 3. 为 products 添加 provider_id
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_id INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS context_window INTEGER;

-- 4. 为 channel_prices 添加唯一约束
DELETE FROM channel_prices a USING channel_prices b
WHERE a.id < b.id AND a.product_id = b.product_id AND a.channel_id = b.channel_id;

ALTER TABLE channel_prices
ADD CONSTRAINT IF NOT EXISTS uq_channel_prices_product_channel
UNIQUE(product_id, channel_id);

ALTER TABLE channel_prices ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP DEFAULT NOW();

-- 5. 创建 plans 表
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  pricing_model VARCHAR(50) DEFAULT 'subscription',
  tier VARCHAR(50) DEFAULT 'free',
  price_monthly REAL NOT NULL,
  price_yearly REAL,
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

-- 6. 创建日志表
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
```

---

## 执行后验证

运行以下SQL检查表是否创建成功：

```sql
-- 检查所有表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('providers', 'products', 'channels', 'channel_prices', 'plans', 'scrape_logs', 'price_history')
ORDER BY table_name;

-- 检查 products 表结构
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 检查 providers 数据
SELECT * FROM providers ORDER BY id;
```

应该看到：
- ✅ 7个表都存在
- ✅ products 表有 provider_id 和 context_window 列
- ✅ providers 表有至少6条数据

---

## 测试抓取

迁移完成后，测试单个爬虫：

```bash
# 测试 OpenAI API
npm run scrape:openai-api

# 测试 Google Gemini
npm run scrape:gemini-api

# 运行完整抓取
npm run scrape
```

---

## 常见问题

### Q: 执行时提示 "relation already exists"
**A**: 正常，说明表已存在，脚本会跳过

### Q: 执行时提示 "constraint already exists"
**A**: 正常，说明约束已存在，脚本会跳过

### Q: 仍然报 "column does not exist"
**A**: 检查是否选择了正确的数据库/Schema，或者重新执行方案2的完整脚本

### Q: 提示 "duplicate key value violates unique constraint"
**A**: 说明供应商数据已存在，可以忽略或使用 `ON CONFLICT DO NOTHING`

---

## 需要帮助？

如果遇到其他错误，请提供：
1. 完整的错误信息
2. 正在执行的SQL语句
3. 当前的表结构（执行上面的验证SQL）

---

**推荐执行方案1的 `minimal_migration.sql`，最安全且覆盖所有需求！** ✅
