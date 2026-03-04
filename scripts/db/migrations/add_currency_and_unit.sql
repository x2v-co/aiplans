-- ===== 添加货币和价格单位列 =====
-- 用于修复订阅计划和API价格的货币不一致问题

-- 1. 为 plans 表添加货币和价格单位列
DO $$
BEGIN
  -- 添加 currency 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'currency'
  ) THEN
    ALTER TABLE plans ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
    COMMENT ON COLUMN plans.currency IS '货币代码 (USD, CNY, EUR, etc.)';
  END IF;

  -- 添加 price_unit 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'price_unit'
  ) THEN
    ALTER TABLE plans ADD COLUMN price_unit VARCHAR(20) DEFAULT 'per_month';
    COMMENT ON COLUMN plans.price_unit IS '价格单位 (per_month, per_year, per_request, etc.)';
  END IF;
END $$;

-- 2. 为 channel_prices 表添加货币和价格单位列
DO $$
BEGIN
  -- 添加 currency 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_prices' AND column_name = 'currency'
  ) THEN
    ALTER TABLE channel_prices ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
    COMMENT ON COLUMN channel_prices.currency IS '货币代码 (USD, CNY, EUR, etc.)';
  END IF;

  -- 添加 price_unit 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_prices' AND column_name = 'price_unit'
  ) THEN
    ALTER TABLE channel_prices ADD COLUMN price_unit VARCHAR(20) DEFAULT 'per_1m_tokens';
    COMMENT ON COLUMN channel_prices.price_unit IS '价格单位 (per_1m_tokens, per_1k_tokens, etc.)';
  END IF;
END $$;

-- 3. 为 providers 表添加 currency 列（默认货币）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'currency'
  ) THEN
    ALTER TABLE providers ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
    COMMENT ON COLUMN providers.currency IS '默认货币 (USD for global, CNY for china)';
  END IF;
END $$;

-- 4. 更新现有 providers 的默认货币
UPDATE providers SET currency = 'USD' WHERE region = 'global';
UPDATE providers SET currency = 'CNY' WHERE region = 'china';

-- 5. 更新现有 plans 的货币（根据 provider 的 region）
UPDATE plans p
SET currency = (SELECT currency FROM providers WHERE id = p.provider_id),
    price_unit = CASE
      WHEN pricing_model = 'subscription' AND annual_price IS NOT NULL THEN 'per_year'
      WHEN pricing_model = 'subscription' THEN 'per_month'
      WHEN pricing_model = 'token_pack' THEN 'per_pack'
      WHEN pricing_model = 'pay_as_you_go' THEN 'per_1m_tokens'
      ELSE 'per_month'
    END
WHERE currency IS NULL OR currency = 'USD';

-- 6. 更新现有 channel_prices 的货币（根据 channel 的 region）
UPDATE channel_prices cp
SET currency = (
    CASE
      WHEN c.region = 'china' THEN 'CNY'
      ELSE 'USD'
    END
  )
FROM channels c
WHERE cp.channel_id = c.id
  AND (cp.currency IS NULL OR cp.currency = 'USD');

-- 7. 添加检查约束（可选）
ALTER TABLE plans ADD CONSTRAINT plans_currency_check
  CHECK (currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW'));

ALTER TABLE channel_prices ADD CONSTRAINT channel_prices_currency_check
  CHECK (currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW'));

-- 8. 创建货币索引
CREATE INDEX IF NOT EXISTS idx_plans_currency ON plans(currency);
CREATE INDEX IF NOT EXISTS idx_channel_prices_currency ON channel_prices(currency);

-- 验证结果
SELECT
  'plans' as table_name,
  currency,
  COUNT(*) as count
FROM plans
GROUP BY currency
UNION ALL
SELECT
  'channel_prices' as table_name,
  currency,
  COUNT(*) as count
FROM channel_prices
GROUP BY currency;

SELECT 'Currency and unit columns added successfully!' as status;
