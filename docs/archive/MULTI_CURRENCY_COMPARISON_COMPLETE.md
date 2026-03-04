# 多货币计划对比功能完成

> 完成日期: 2026-02-28
> 功能状态: ✅ 已完成

---

## 问题

当不同货币的订阅计划进行对比时，直接比较数值没有意义：
- ChatGPT Plus: $20/月 (USD)
- 国内某渠道套餐: ¥100/月 (CNY)

直接比较 20 vs 100 是错误的，需要先进行货币转换。

---

## 解决方案

### 1. 货币转换工具

**文件**: `src/lib/currency-conversion.ts`

提供功能：
- `convertPrice()` - 将价格从一种货币转换为另一种货币
- `convertToUSD()` - 将价格转换为 USD（基准货币）
- `calculatePriceDifference()` - 计算两种不同货币价格的差异百分比
- `getExchangeRateDisplay()` - 获取汇率显示字符串
- `comparePlanPrices()` - 对比计划价格（支持不同货币）

支持的货币和简化汇率：
```typescript
{
  USD: 1,
  CNY: 7.2,      // 1 USD = ¥7.20
  EUR: 0.92,      // 1 USD = €0.92
  GBP: 0.79,      // 1 USD = £0.79
  JPY: 149.5,      // 1 USD = ¥149.50
  KRW: 1320,       // 1 USD = ₩1320
}
```

### 2. API 更新

**文件**: `src/app/api/compare/plans/route.ts`

新增功能：
- 支持查询参数 `?currency=USD|CNY` - 用户选择显示货币
- 从数据库读取计划的 `currency` 和 `price_unit` 字段
- 返回以下新字段：
  - `pricing.currency` - 原始货币
  - `pricing.displayCurrency` - 显示货币
  - `pricing.exchangeRate` - 汇率字符串
  - `pricing.convertedMonthly` - 转换后月付价格
  - `pricing.convertedYearly` - 转换后年付价格
  - `pricing.convertedYearlyMonthly` - 转换后年付平均价格
  - `summary.displayCurrency` - 使用的显示货币

### 3. 前端组件更新

**文件**: `src/components/compare/CompareTable.tsx`

更新内容：
- 添加 `billingUnit` 到接口
- 添加 `exchangeRate` 显示
- 显示原始货币
- 显示转换后价格（如果与显示货币不同）
- 显示汇率信息

---

## API 使用示例

### 获取对比（默认 USD 显示）

```
GET /api/compare/plans?model=gpt-4o
```

### 获取对比（以 CNY 显示）

```
GET /api/compare/plans?model=gpt-4o&currency=CNY
```

### 返回数据结构

```json
{
  "model": { ... },
  "officialPlans": [
    {
      "pricing": {
        "billingModel": "subscription",
        "billingUnit": "per_month",
        "monthly": 20,
        "yearly": 200,
        "yearlyMonthly": 16.67,
        "yearlyDiscountPercent": 16.67,
        "currency": "USD",
        "displayCurrency": "CNY",
        "convertedMonthly": 144.00,
        "convertedYearly": 1440.00,
        "convertedYearlyMonthly": 120.00,
        "exchangeRate": "(1 USD = ¥7.20)"
      }
    }
  ],
  "thirdPartyPlans": [
    {
      "pricing": {
        "monthly": 100,
        "currency": "CNY",
        "displayCurrency": "CNY",
        "convertedMonthly": 100.00,
        "exchangeRate": ""
      },
      "vsOfficial": {
        "priceDiffPercent": -30.56,
        "priceDiffLabel": "30.56%"
      }
    }
  ],
  "summary": {
    "totalPlans": 4,
    "displayCurrency": "CNY",
    "cheapestPlan": {
      "name": "Third Party Plan",
      "monthlyPrice": 100,
      "currency": "CNY",
      "displayMonthlyPrice": 100.00
    }
  }
}
```

---

## 前端显示效果

### 方案 1: 使用原币种（默认）

```
ChatGPT Plus (OpenAI)
  Monthly: $20.00
  Yearly (per month): $16.67

国内渠道套餐
  Monthly: ¥100.00
```

### 方案 2: 转换为 CNY 显示

```
ChatGPT Plus (OpenAI)
  Monthly: $20.00
  ≈ ¥144.00 (1 USD = ¥7.20)
  Yearly (per month): $16.67
  ≈ ¥120.00

国内渠道套餐
  Monthly: ¥100.00
  ≈ ¥100.00

对比结果:
  国内渠道比官方便宜 30.56%
```

---

## 实现细节

### 货币转换逻辑

```typescript
// 原价格转换为显示货币
const convertedPrice = originalPrice * (exchangeRate[target] / exchangeRate[source]);

// 示例: $20 USD → CNY
// convertedPrice = 20 * (7.2 / 1) = 144
```

### 价格比较逻辑

```typescript
// 所有价格转换为 USD 后再比较
const priceInUSD = originalPrice / exchangeRate[currency];
const difference = (price1USD - price2USD) / price2USD * 100;
```

### 显示规则

1. **原始货币显示**: 显示原币种的价格（如 $20.00）
2. **转换价格显示**: 如果原币种 ≠ 显示币种，显示转换后价格（如 ≈ ¥144.00）
3. **汇率提示**: 显示使用的汇率（如 (1 USD = ¥7.20)）
4. **同币种**: 不显示转换价格和汇率

---

## 文件清单

新增文件：
- `src/lib/currency-conversion.ts` - 货币转换和对比工具
- `MULTI_CURRENCY_COMPARISON_COMPLETE.md` - 本文档

修改文件：
- `src/app/api/compare/plans/route.ts` - 支持多货币对比
- `src/components/compare/CompareTable.tsx` - 更新显示逻辑

---

## 下一步优化

1. **实时汇率**: 集成实时汇率 API（如 Open Exchange Rates API）
2. **汇率缓存**: 实现汇率缓存机制，避免频繁 API 调用
3. **汇率更新时间**: 显示汇率最后更新时间
4. **前端货币切换器**: 让用户可以随时切换显示货币
5. **API 价格对比**: 同样功能应用到 API token 价格对比

---

## API 接口

### 支持的查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | string | 必填 | 模型 slug |
| `currency` | string | 'USD' | 显示货币 (USD, CNY, EUR, GBP, JPY, KRW) |

### 示例请求

```bash
# 查看对比（默认 USD 显示）
curl "/api/compare/plans?model=gpt-4o"

# 查看对比（以 CNY 显示）
curl "/api/compare/plans?model=gpt-4o&currency=CNY"

# 查看对比（以 EUR 显示）
curl "/api/compare/plans?model=gpt-4o&currency=EUR"
```

---

✅ **多货币对比功能完成！**
