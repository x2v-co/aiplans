# 修复 exchange_rates 表约束冲突

## 1. 检查现有表

```sql
-- 查看表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_name = 'exchange_rates';

-- 查看表结构
\d exchange_rates;

-- 如果表已存在，查看现有数据
SELECT * FROM exchange_rates LIMIT 10;
```

## 2. 方案一：删除并重建表（推荐）

```sql
-- 删除旧表（如果存在）
DROP TABLE IF EXISTS exchange_rates CASCADE;

-- 重新创建表
CREATE TABLE exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 8) NOT NULL,
  source VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  valid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT exchange_rates_from_currency_check CHECK (from_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW')),
  CONSTRAINT exchange_rates_to_currency_check CHECK (to_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW'))
);

-- 唯一索引（先创建表，再创建索引）
CREATE UNIQUE INDEX idx_exchange_rates_unique
  ON exchange_rates (from_currency, to_currency)
  WHERE is_active = true;

CREATE INDEX idx_exchange_rates_updated_at
  ON exchange_rates (updated_at);
```

## 3. 方案二：只清理现有数据（如果表已存在且有约束冲突）

```sql
-- 查看是否有重复数据
SELECT from_currency, to_currency, COUNT(*)
FROM exchange_rates
GROUP BY from_currency, to_currency
HAVING COUNT(*) > 1;

-- 如果有重复，只删除重复的
DELETE FROM exchange_rates
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY from_currency, to_currency ORDER BY id) as rn
    FROM exchange_rates
    WHERE rn > 1
);
```

## 4. 验证和初始化

```sql
-- 验证表已创建
\d exchange_rates

-- 初始化汇率数据
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, is_active, valid_at)
VALUES
  ('USD', 'CNY', 1 / 7.2, 'fixed', true, NOW()),
  ('USD', 'EUR', 1 / 0.92, 'fixed', true, NOW()),
  ('USD', 'GBP', 1 / 0.79, 'fixed', true, NOW()),
  ('USD', 'JPY', 1 / 149.5, 'fixed', true, NOW()),
  ('USD', 'KRW', 1 / 1320, 'fixed', true, NOW()),
  ('CNY', 'USD', 7.2, 'fixed', true, NOW()),
  ('EUR', 'USD', 0.92, 'fixed', true, NOW()),
  ('GBP', 'USD', 0.79, 'fixed', true, NOW()),
  ('JPY', 'USD', 149.5, 'fixed', true, NOW()),
  ('KRW', 'USD', 0.0007575, 'fixed', true, NOW())
ON CONFLICT (from_currency, to_currency) DO NOTHING;
```

## 推荐执行步骤

1. 在 Supabase SQL Editor 中先检查表是否存在
2. 如果表已存在且有冲突，选择"方案二"清理数据
3. 如果表不存在或没有冲突，选择"方案一"完整执行

执行后运行 `npm run build` 验证构建成功。
