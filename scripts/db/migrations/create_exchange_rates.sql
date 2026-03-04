-- ===== 创建汇率表 =====
-- 用于支持每天更新的汇率数据

-- 1. 创建 exchange_rates 表
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 8) NOT NULL,  -- 1 from_currency = X to_currency
  source VARCHAR(50) NOT NULL,  -- 'openexchangerates', 'manual', etc.
  is_active BOOLEAN DEFAULT true,  -- 当前是否激活
  valid_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 汇率生效时间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 创建时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 更新时间
  CONSTRAINT exchange_rates_from_currency_check CHECK (from_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW')),
  CONSTRAINT exchange_rates_to_currency_check CHECK (to_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW'))
);

-- 2. 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_unique
  ON exchange_rates (from_currency, to_currency)
  WHERE is_active = true;

-- 3. 创建时间索引（用于清理过期汇率）
CREATE INDEX IF NOT EXISTS idx_exchange_rates_valid_at
  ON exchange_rates (valid_at);

-- 4. 创建更新时间索引
CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated_at
  ON exchange_rates (updated_at);

-- 5. 初始化汇率数据（基于当前固定汇率）
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, is_active, valid_at)
VALUES
  -- USD 基准汇率
  ('USD', 'CNY', 1 / 7.2, 'fixed', true, NOW()),
  ('USD', 'EUR', 1 / 0.92, 'fixed', true, NOW()),
  ('USD', 'GBP', 1 / 0.79, 'fixed', true, NOW()),
  ('USD', 'JPY', 1 / 149.5, 'fixed', true, NOW()),
  ('USD', 'KRW', 1 / 1320, 'fixed', true, NOW()),
  -- 反向汇率
  ('CNY', 'USD', 7.2, 'fixed', true, NOW()),
  ('EUR', 'USD', 0.92, 'fixed', true, NOW()),
  ('GBP', 'USD', 0.79, 'fixed', true, NOW()),
  ('JPY', 'USD', 149.5, 'fixed', true, NOW()),
  ('KRW', 'USD', 0.0007575, 'fixed', true, NOW())
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- 6. 显示初始化结果
SELECT
  'exchange_rates' as table_name,
  from_currency,
  to_currency,
  rate::NUMERIC,
  source,
  COUNT(*) as rate_count
FROM exchange_rates
WHERE is_active = true
ORDER BY from_currency, to_currency;

SELECT 'Exchange rates table created successfully!' as status;
