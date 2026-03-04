# 货币不一致问题修复完成

> 修复日期: 2026-02-28
> 修复状态: ✅ 已完成

---

## 问题描述

原系统存在货币不一致的问题：
- **订阅套餐 (plans)**: 价格单位为 "美元/月" 或 "美元/年"
- **API 价格 (channel_prices)**: 价格单位为 "美元/百万 tokens"
- 缺少 `currency` 列，所有价格默认为 USD
- 前端硬编码 `$` 符号，无法正确显示 CNY（人民币）

---

## 修复方案

### 1. 数据库架构修改

**迁移文件**: `scripts/db/migrations/add_currency_and_unit.sql`

新增列：
- `plans` 表:
  - `currency VARCHAR(3)` - 货币代码 (USD, CNY, EUR, etc.)
  - `price_unit VARCHAR(20)` - 价格单位 (per_month, per_year, per_1m_tokens, etc.)
- `channel_prices` 表:
  - `currency VARCHAR(3)` - 货币代码
  - `price_unit VARCHAR(20)` - 价格单位
- `providers` 表:
  - `currency VARCHAR(3)` - 默认货币

**执行迁移**:
```bash
psql < scripts/db/migrations/add_currency_and_unit.sql
```

---

### 2. 货币工具函数

**文件**: `src/lib/currency.ts`

提供功能：
- `formatPrice()` - 根据货币格式化价格
- `formatPriceSimple()` - 格式化价格（简化版）
- `getCurrencySymbol()` - 获取货币符号
- `formatPriceWithUnit()` - 格式化带单位的价格
- `convertCurrency()` - 货币转换
- `comparePrices()` - 比较不同货币的价格
- `calculateSavingsPercent()` - 计算节省百分比
- `getDefaultCurrencyForRegion()` - 根据区域获取默认货币

支持的货币：
- USD ($) - 美元
- CNY (¥) - 人民币
- EUR (€) - 欧元
- GBP (£) - 英镑
- JPY (¥) - 日元
- KRW (₩) - 韩元

---

### 3. 抓取器更新

#### 3.1 类型定义更新

**`scripts/utils/plan-validator.ts`**:
```typescript
export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export interface ScrapedPlan {
  // ... 其他字段
  currency: CurrencyCode;  // 新增
}
```

**`scripts/utils/validator.ts`**:
```typescript
export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export interface ScrapedPrice {
  // ... 其他字段
  currency?: CurrencyCode;  // 新增
}
```

#### 3.2 计划抓取器更新

已更新的文件：
- `scripts/scrapers/plan-openai.ts` - 所有计划添加 `currency: 'USD'`
- `scripts/scrapers/plan-anthropic.ts` - 所有计划添加 `currency: 'USD'`
- `scripts/scrapers/plan-google-gemini.ts` - 所有计划添加 `currency: 'USD'`

#### 3.3 主抓取脚本更新

**`scripts/index.ts`**:
- `processAPIScraper()`: 根据渠道区域推断货币 (china -> CNY, global -> USD)
- `processPlanScraper()`: 根据计划区域和价格模型推断货币和价格单位

货币推断逻辑：
```typescript
const currency = channel.region === 'china' ? 'CNY' : 'USD';
```

价格单位推断逻辑：
```typescript
let priceUnit = 'per_month';
if (plan.pricingModel === 'subscription') {
  priceUnit = plan.priceYearly ? 'per_year' : 'per_month';
} else if (plan.pricingModel === 'token_pack') {
  priceUnit = 'per_pack';
} else if (plan.pricingModel === 'pay_as_you_go') {
  priceUnit = 'per_1m_tokens';
}
```

#### 3.4 数据库查询函数更新

**`scripts/db/queries.ts`**:
- `upsertChannelPrice()` - 添加 `currency` 和 `price_unit` 参数
- `upsertPlan()` - 添加 `currency` 和 `price_unit` 参数

---

### 4. 前端组件更新

#### 4.1 API 定价页面

**文件**: `src/app/[locale]/api-pricing/page.tsx`

更新内容：
- 导入货币工具函数
- 更新 `ChannelPrice` 接口包含 `currency` 和 `price_unit`
- 价格显示使用 `formatPrice()` 函数
- 节省百分比计算使用 `calculateSavingsPercent()` 函数

#### 4.2 对比表格组件

**文件**: `src/components/compare/CompareTable.tsx`

更新内容：
- 导入货币工具函数
- 使用 `formatPriceSimple()` 替换原有的简单格式化

---

## 执行步骤

### 步骤 1: 执行数据库迁移

在 Supabase SQL Editor 或通过 psql 执行：

```bash
psql $DATABASE_URL -f scripts/db/migrations/add_currency_and_unit.sql
```

### 步骤 2: 重新运行抓取器（可选）

更新现有数据的货币信息：

```bash
npm run scrape
```

### 步骤 3: 验证修复

检查：
1. 数据库中的 `plans` 和 `channel_prices` 表是否包含 `currency` 列
2. API 端点是否返回 `currency` 字段
3. 前端页面是否正确显示货币符号

---

## 预期效果

### API 定价页面

| 模型 | 渠道 | 输入价格 | 输出价格 |
|------|------|----------|----------|
| GPT-4o | OpenAI (官方) | $2.50 | $10.00 |
| GPT-4o | 硅基流动 | ¥15.00 | ¥60.00 |

### 订阅套餐页面

| 套餐 | 月付价格 | 年付价格 |
|------|----------|----------|
| ChatGPT Plus | $20/月 | $200/年 |
| Claude Pro | $20/月 | $200/年 |

---

## 注意事项

1. **国内渠道价格**: 自动使用 CNY 货币
2. **国际渠道价格**: 默认使用 USD 货币
3. **汇率转换**: 当前使用固定汇率，生产环境应使用实时汇率 API
4. **向后兼容**: 如果抓取器未指定货币，会根据区域自动推断

---

## 后续优化

1. **实时汇率**: 集成实时汇率 API（如 Open Exchange Rates）
2. **货币切换**: 前端添加货币切换功能，用户可选择显示货币
3. **汇率提示**: 显示最后更新的汇率和时间
4. **汇率源**: 可配置多个汇率源以提高可靠性

---

## 文件清单

新增文件：
- `src/lib/currency.ts` - 货币工具函数
- `scripts/db/migrations/add_currency_and_unit.sql` - 数据库迁移脚本
- `CURRENCY_FIX_COMPLETE.md` - 本文档

修改文件：
- `scripts/utils/plan-validator.ts` - 添加货币类型
- `scripts/utils/validator.ts` - 添加货币类型
- `scripts/scrapers/plan-openai.ts` - 添加货币字段
- `scripts/scrapers/plan-anthropic.ts` - 添加货币字段
- `scripts/scrapers/plan-google-gemini.ts` - 添加货币字段
- `scripts/index.ts` - 推断货币并传递到数据库
- `scripts/db/queries.ts` - 更新 upsert 函数
- `src/app/[locale]/api-pricing/page.tsx` - 使用货币工具函数
- `src/components/compare/CompareTable.tsx` - 使用货币工具函数

---

## 测试建议

1. 单元测试：测试货币格式化和转换函数
2. 集成测试：测试抓取器是否正确传递货币
3. UI 测试：测试不同货币的价格显示
4. 端到端测试：从抓取到显示的完整流程

---

✅ **修复完成！**
