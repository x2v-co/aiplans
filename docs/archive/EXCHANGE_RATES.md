# 汇率方案说明

> 更新日期: 2026-02-28
> 状态: 使用固定汇率（需要改进为实时汇率）

---

## 当前方案：固定汇率

### 当前汇率

```typescript
// src/lib/currency-conversion.ts
const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  CNY: 7.2,      // 1 USD = ¥7.20
  EUR: 0.92,      // 1 USD = €0.92
  GBP: 0.79,      // 1 USD = £0.79
  JPY: 149.5,      // 1 USD = ¥149.50
  KRW: 1320,       // 1 USD = ₩1320.00
};
```

### 问题

1. **不准确** - 汇率实时变动，固定汇率很快过时
2. **更新困难** - 需要手动修改代码才能更新
3. **用户体验差** - 显示的价格与实际可能不同
4. **数据不一致** - 不同渠道可能使用不同汇率计算

---

## 改进方案：实时汇率

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|--------|---------|
| 固定汇率 | 简单、稳定、无 API 调用 | 不准确 | ⭐⭐ |
| 免费 API | 实时准确 | 有免费额度限制 | ⭐⭐⭐⭐ |
| 付费 API | 实时准确、服务稳定 | 增加成本 | ⭐⭐ |
| 第三方服务 | 无需自行维护 | 依赖第三方 | ⭐⭐⭐ |

### 推荐：混合方案

```
1. 优先使用缓存中的汇率（有效期：15 分钟）
2. 缓存过期时，从免费 API 获取
3. 付费 API 作为备用（高可用性）
4. 前端显示汇率更新时间
```

---

## 实现方案

### 1. 免费汇率 API

#### Open Exchange Rates API
```bash
# 获取 USD 对其他货币的汇率
GET https://openexchangerates.org/api/latest.json
```

返回示例：
```json
{
  "base": "USD",
  "rates": {
    "CNY": 7.245983,
    "EUR": 0.918492,
    "GBP": 0.791723,
    "JPY": 149.732950,
    ...
  },
  "timestamp": 1709095200
}
```

#### ExchangeRate-API（简单、免费）
```bash
# 获取 USD 对其他货币的汇率
GET https://api.exchangerate-api.com/v4/latest/USD
```

**优势**：
- 简单易用
- 每日更新一次
- 免费额度高

#### Frankfurter API（欧洲汇率）
```bash
GET https://api.frankfurter.com/v1/latest
```

---

### 2. 数据库设计

#### 创建汇率表

```sql
-- exchange_rates 表
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 8) NOT NULL,  -- 1 from_currency = X to_currency
  source VARCHAR(50) NOT NULL,  -- 'openexchangerates', 'frankfurter', etc.
  valid_at TIMESTAMP NOT NULL,   -- 汇率生效时间
  expires_at TIMESTAMP NOT NULL,  -- 汇率过期时间
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 唯一索引
CREATE UNIQUE INDEX idx_exchange_rates_unique
  ON exchange_rates (from_currency, to_currency, valid_at);

-- 按有效期索引
CREATE INDEX idx_exchange_rates_expires
  ON exchange_rates (expires_at) WHERE expires_at IS NOT NULL;
```

#### 汇率更新策略

```typescript
// 1. 缓存优先（有效期 15 分钟）
const CACHE_DURATION = 15 * 60 * 1000; // 15 分钟（毫秒）

// 2. 优先使用缓存中的汇率
async function getExchangeRate(from: string, to: string): Promise<number> {
  // 先查缓存
  const cached = await getCachedRate(from, to);
  if (cached && isStillValid(cached.expires_at)) {
    return cached.rate;
  }

  // 缓存无效，从 API 获取
  const freshRate = await fetchFromAPI(from, to);

  // 存入缓存（有效期 15 分钟）
  await cacheRate(from, to, freshRate, CACHE_DURATION);

  return freshRate;
}

// 3. API 调用频率限制（防止滥用）
const RATE_LIMITS = {
  openexchangerates: { calls: 5, period: 'minute' },  // 每 10 分钟 1 次
  exchangerate: { calls: 100, period: 'day' },         // 每天 100 次
};
```

---

### 3. API 实现

#### 新增 API 端点

```bash
# 获取当前汇率
GET /api/exchange-rates

# 刷新汇率（管理员功能）
POST /api/admin/refresh-rates
```

#### 响应格式

```json
GET /api/exchange-rates
{
  "rates": {
    "USD_TO_CNY": 7.245983,
    "USD_TO_EUR": 0.918492,
    ...
  },
  "lastUpdated": "2026-02-28T08:30:00Z",
  "nextUpdate": "2026-02-28T09:30:00Z",
  "source": "openexchangerates"
}
```

---

### 4. 缓存策略

#### 使用 Redis 缓存

```typescript
// 存储结构
exchange_rates:USD:CNY = "7.245983"
exchange_rates:USD:CNY:expires_at = "2026-02-28T08:45:00Z"
```

#### Redis TTL 设置

```
# 汇率缓存：15 分钟
EX exchange_rates:USD:CNY 300

# 汇率 API 调用锁：10 分钟
exchangerates_api_lock:ttl=600
```

---

### 5. 前端实现

#### 显示汇率信息

```typescript
// 在价格卡片上显示
<div className="text-xs text-zinc-500 mt-2">
  $20.00
  <span className="text-zinc-400">
    ≈ ¥144.00 (1 USD = ¥7.20)
  </span>
  <span className="text-zinc-300 ml-2">
    汇率更新: 2026-02-28 08:30
  </span>
</div>
```

#### 货币选择器

```typescript
// 允许用户选择显示货币
const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('USD');

// 自动检测用户地区
useEffect(() => {
  const userLocale = getUserLocale();
  if (userLocale.startsWith('zh')) {
    setDisplayCurrency('CNY');
  } else {
    setDisplayCurrency('USD');
  }
}, []);
```

---

### 6. 错误处理

#### API 调用失败回退

```typescript
async function getExchangeRate(from: string, to: string): Promise<number> {
  try {
    // 优先使用免费 API
    return await fetchFromFreeAPI(from, to);
  } catch (error) {
    // 回退到固定汇率
    console.error('汇率 API 失败，使用固定汇率:', error);
    return FIXED_RATES[from][to];
  }
}
```

#### 前端容错

```typescript
// 如果汇率加载失败，使用固定汇率并提示
if (exchangeRates === null) {
  return (
    <div className="text-yellow-600 text-sm">
      ⚠️ 汇率服务暂时不可用，显示价格可能不准确
    </div>
  );
}
```

---

### 7. 监控和告警

#### 关键指标

- 汇率 API 调用成功率
- 汇率缓存命中率
- 汇率更新延迟
- 汇率与市场偏差（使用第三方服务验证）

#### 告警规则

```typescript
// 汇率偏离基准超过 5% 时告警
if (Math.abs(rate - benchmarkRate) / benchmarkRate > 0.05) {
  sendAlert(`汇率异常: ${from}->${to} = ${rate} (基准: ${benchmarkRate})`);
}
```

---

## 实施步骤

### 第一阶段：基础设施

1. 创建 `exchange_rates` 数据库表
2. 配置 Redis 缓存
3. 实现 `/api/exchange-rates` 端点
4. 更新 `currency-conversion.ts` 使用动态汇率

### 第二阶段：集成

1. 接入 Open Exchange Rates API
2. 实现缓存机制（Redis + 数据库）
3. 实现定时刷新任务
4. 添加监控和告警

### 第三阶段：前端

1. 更新对比页面显示汇率信息
2. 添加货币选择器
3. 优化移动端显示

---

## 数据库迁移

```sql
-- 创建汇率表
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 8) NOT NULL,
  source VARCHAR(50) NOT NULL,
  valid_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_exchange_rates_unique
  ON exchange_rates (from_currency, to_currency, valid_at);

CREATE INDEX idx_exchange_rates_expires
  ON exchange_rates (expires_at) WHERE expires_at IS NOT NULL;

-- 初始化常用汇率（基于当前固定汇率）
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, valid_at, expires_at)
VALUES
  ('USD', 'CNY', 7.2, 'fixed', NOW(), NOW() + INTERVAL '1 day'),
  ('USD', 'EUR', 0.92, 'fixed', NOW(), NOW() + INTERVAL '1 day'),
  ('USD', 'GBP', 0.79, 'fixed', NOW(), NOW() + INTERVAL '1 day');
```

---

## 推荐配置

```json
{
  "exchangeRates": {
    "primarySource": "openexchangerates",
    "fallbackSource": "exchangerate-api",
    "primaryCacheDuration": 900,    // 15 分钟
    "fallbackCacheDuration": 3600,  // 1 小时
    "refreshCron": "0 */15 * * *",  // 每 15 分钟
    "alerts": {
      "rateDeviationThreshold": 0.05,  // 5% 偏差告警
      "apiFailureThreshold": 3              // 连续 3 次失败告警
    }
  }
}
```

---

## 成本估算

| 服务 | 成本/月 | 说明 |
|------|----------|------|
| Open Exchange Rates | 免费 | 无 |
| Exchangerate-API | $10/月（基础套餐） | 中等规模可用 |
| ExchangeRate-API | 免费 | 简单易用 |
| Redis（Upstash） | $5/月 | 已有计划 |

**推荐**: 使用 Open Exchange Rates 作为主数据源，Exchangerate-API 作为备用

---

## 注意事项

1. **隐私合规** - 确保符合用户所在地的汇率法规
2. **时区处理** - 汇率时间戳使用 UTC，前端转换显示为本地时区
3. **API 密钥安全** - 使用环境变量存储，不提交到代码库
4. **速率限制** - 遵守各 API 服务的速率限制
5. **数据备份** - 定期备份汇率历史数据

---

## 相关文件

- `EXCHANGE_RATES.md` - 本文档
- `src/lib/currency-conversion.ts` - 需要更新使用动态汇率
- `src/app/api/exchange-rates/route.ts` - 新增汇率 API
- `src/lib/exchange-rate-cache.ts` - 汇率缓存模块（新建）
- `src/components/ExchangeRateBadge.tsx` - 汇率显示组件（新建）
