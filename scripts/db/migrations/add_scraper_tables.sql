-- 价格变更历史表
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

CREATE INDEX idx_price_history_channel_price ON price_history(channel_price_id);
CREATE INDEX idx_price_history_detected_at ON price_history(detected_at DESC);
CREATE INDEX idx_price_history_change_percent ON price_history(change_percent) WHERE ABS(change_percent) > 20;

-- 抓取日志表
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

CREATE INDEX idx_scrape_logs_source ON scrape_logs(source);
CREATE INDEX idx_scrape_logs_completed_at ON scrape_logs(completed_at DESC);
CREATE INDEX idx_scrape_logs_status ON scrape_logs(status);

-- 为 channel_prices 添加最后验证时间
ALTER TABLE channel_prices
ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_channel_prices_last_verified ON channel_prices(last_verified DESC);

-- 为 channels 添加更多字段
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS website_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'global',
ADD COLUMN IF NOT EXISTS access_from_china BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE price_history IS '价格变更历史记录';
COMMENT ON TABLE scrape_logs IS '数据抓取日志';
COMMENT ON COLUMN price_history.change_percent IS '价格变化百分比，正数表示涨价，负数表示降价';
COMMENT ON COLUMN scrape_logs.duration_ms IS '抓取耗时（毫秒）';
