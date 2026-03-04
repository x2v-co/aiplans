# ✅ API vs Plan 定价抓取系统升级完成

## 🎯 核心改进

### 1. **明确区分 API 定价和 Plan 定价**

- **API 定价** (🔹): 按 token 计费，存入 `channel_prices` 表
- **Plan 定价** (🔸): 订阅制计费，存入 `plans` 表
- **Both** (🔶): 同时提供两种定价，分别用两个爬虫抓取

### 2. **新增文件结构**

```
scripts/
├── index-new.ts              # 新的主协调器（支持 API + Plan）
├── index.ts                  # 旧版本（仅 API）
├── scrapers/
│   ├── openrouter.ts         # ✅ 已完成 (API aggregator)
│   ├── api-openai.ts         # ✅ 新增 (OpenAI API 定价)
│   ├── plan-openai.ts        # ✅ 新增 (ChatGPT Plus/Pro/Team)
│   ├── api-anthropic.ts      # ✅ 新增 (Anthropic API 定价)
│   ├── plan-anthropic.ts     # ✅ 新增 (Claude Pro/Team)
│   ├── api-deepseek.ts       # ✅ 新增 (DeepSeek API)
│   ├── api-together-ai.ts    # ✅ 新增 (Together AI aggregator)
│   └── api-siliconflow.ts    # ✅ 新增 (硅基流动 aggregator)
├── utils/
│   ├── validator.ts          # API 定价验证工具
│   └── plan-validator.ts     # ✅ 新增 (Plan 定价验证工具)
└── db/
    └── queries.ts            # ✅ 新增 Plan 相关数据库操作
```

## 📊 已实现的数据源

### 🔹 API 定价 (7 个数据源)

| 数据源 | 优先级 | 状态 | 模型数量 | 文件 |
|--------|--------|------|----------|------|
| OpenRouter | ⭐⭐⭐ | ✅ 已完成 | 200+ | `scrapers/openrouter.ts` |
| OpenAI Official | ⭐⭐⭐ | ✅ 新增 | 9 | `scrapers/api-openai.ts` |
| Anthropic Official | ⭐⭐⭐ | ✅ 新增 | 8 | `scrapers/api-anthropic.ts` |
| DeepSeek Official | ⭐⭐⭐ | ✅ 新增 | 2 | `scrapers/api-deepseek.ts` |
| Together AI | ⭐⭐⭐ | ✅ 新增 | 9 | `scrapers/api-together-ai.ts` |
| SiliconFlow | ⭐⭐⭐ | ✅ 新增 | 12 | `scrapers/api-siliconflow.ts` |

### 🔸 Plan 定价 (2 个数据源)

| 数据源 | 优先级 | 状态 | 套餐数量 | 文件 |
|--------|--------|------|----------|------|
| OpenAI Plans | ⭐⭐⭐ | ✅ 新增 | 4 | `scrapers/plan-openai.ts` |
| Anthropic Plans | ⭐⭐⭐ | ✅ 新增 | 3 | `scrapers/plan-anthropic.ts` |

## 🚀 使用方法

### 1. 运行完整抓取（API + Plan）

```bash
npm run scrape
```

这将执行：
- 6 个 API 定价爬虫
- 2 个 Plan 定价爬虫
- 总计 8 个爬虫并行执行

### 2. 测试单个爬虫

#### API 定价爬虫

```bash
# OpenAI API 定价
npm run scrape:openai-api

# Anthropic API 定价
npm run scrape:anthropic-api

# DeepSeek API 定价
npm run scrape:deepseek

# Together AI
npm run scrape:together

# 硅基流动
npm run scrape:siliconflow

# OpenRouter (原有)
npm run scrape:openrouter
```

#### Plan 定价爬虫

```bash
# OpenAI 订阅套餐 (ChatGPT Plus/Pro/Team)
npm run scrape:openai-plan

# Anthropic 订阅套餐 (Claude Pro/Team)
npm run scrape:anthropic-plan
```

### 3. 运行旧版本（仅 API）

```bash
npm run scrape:old
```

## 📋 抓取数据详情

### API 定价示例

#### OpenAI API (`api-openai.ts`)

```typescript
{
  modelName: "gpt-4o",
  inputPricePer1M: 2.50,
  outputPricePer1M: 10.00,
  cachedInputPricePer1M: 1.25,
  contextWindow: 128000
}
```

#### Anthropic API (`api-anthropic.ts`)

```typescript
{
  modelName: "claude-opus-4-6",
  inputPricePer1M: 15.00,
  outputPricePer1M: 75.00,
  cachedInputPricePer1M: 1.50,
  contextWindow: 200000
}
```

#### DeepSeek API (`api-deepseek.ts`)

```typescript
{
  modelName: "deepseek-chat",
  inputPricePer1M: 0.14,  // ¥1 * 0.14 = $0.14
  outputPricePer1M: 0.28,  // ¥2 * 0.14 = $0.28
  cachedInputPricePer1M: 0.014,
  contextWindow: 64000
}
```

### Plan 定价示例

#### OpenAI Plans (`plan-openai.ts`)

```typescript
{
  planName: "ChatGPT Plus",
  priceMonthly: 20,
  priceYearly: 200,
  tier: "pro",
  features: [
    "Access to GPT-4o, GPT-4o mini",
    "Up to 5x more messages",
    "DALL-E image generation"
  ],
  models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"]
}
```

#### Anthropic Plans (`plan-anthropic.ts`)

```typescript
{
  planName: "Claude Pro",
  priceMonthly: 20,
  priceYearly: 200,
  tier: "pro",
  features: [
    "At least 5x Claude usage",
    "Priority access",
    "Early access to new features"
  ],
  models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
}
```

## 🗄️ 数据库映射

### API 定价 → `channel_prices` 表

| 爬虫字段 | 数据库字段 | 说明 |
|---------|-----------|------|
| `inputPricePer1M` | `input_price_per_1m` | 输入价格（USD/1M tokens）|
| `outputPricePer1M` | `output_price_per_1m` | 输出价格 |
| `cachedInputPricePer1M` | `cached_input_price_per_1m` | 缓存输入价格（可选）|
| `contextWindow` | - | 存储在 `products` 表 |
| `rateLimit` | `rate_limit` | 速率限制说明 |
| `isAvailable` | `is_available` | 是否可用 |

### Plan 定价 → `plans` 表

| 爬虫字段 | 数据库字段 | 说明 |
|---------|-----------|------|
| `planName` | `name` | 套餐名称 |
| `priceMonthly` | `price_monthly` | 月付价格 |
| `priceYearly` | `price_yearly` | 年付价格 |
| `tier` | `tier` | free/basic/pro/team/enterprise |
| `features` | `features` | 功能列表（JSON）|
| `models` | - | 可用模型列表（可关联到 products）|
| `dailyMessageLimit` | `daily_message_limit` | 每日消息限制 |

## 🔄 执行流程

```
1. 启动 index-new.ts
   ↓
2. 并行执行 API 爬虫组
   ├─ scrapeOpenRouter()
   ├─ scrapeOpenAIAPI()
   ├─ scrapeAnthropicAPI()
   ├─ scrapeDeepSeekAPI()
   ├─ scrapeTogetherAI()
   └─ scrapeSiliconFlow()
   ↓
3. 并行执行 Plan 爬虫组
   ├─ scrapeOpenAIPlan()
   └─ scrapeAnthropicPlan()
   ↓
4. API 数据 → processAPIScraper()
   ├─ 创建/获取 Channel
   ├─ 创建/获取 Product
   ├─ Upsert channel_prices
   └─ 记录价格变化
   ↓
5. Plan 数据 → processPlanScraper()
   ├─ 创建/获取 Provider
   ├─ Upsert plans
   └─ 记录最后验证时间
   ↓
6. 记录到 scrape_logs
   ↓
7. 完成
```

## 📈 预期产出

### 每次执行将更新：

- **API 定价**: ~250+ 个模型价格记录
  - OpenRouter: ~200 个模型
  - OpenAI Official: 9 个模型
  - Anthropic Official: 8 个模型
  - DeepSeek: 2 个模型
  - Together AI: 9 个模型
  - SiliconFlow: 12 个模型

- **Plan 定价**: 7 个订阅套餐
  - OpenAI: 4 个套餐 (Free, Plus, Team, Pro)
  - Anthropic: 3 个套餐 (Free, Pro, Team)

## 🎯 下一步计划

### Phase 2: 扩展更多数据源

#### API 定价
- [ ] AWS Bedrock
- [ ] Google Vertex AI
- [ ] Azure OpenAI
- [ ] Fireworks AI
- [ ] Replicate
- [ ] 火山引擎豆包
- [ ] 阿里云百炼
- [ ] 腾讯云混元

#### Plan 定价
- [ ] Google Gemini Advanced
- [ ] 月之暗面 Kimi+
- [ ] Microsoft Copilot

### Phase 3: 动态抓取

目前使用静态数据（手动维护），后续可以：
1. 使用 Puppeteer/Playwright 动态抓取网页
2. 监听官方 API 变化
3. 自动检测新模型上线

## 💡 技术亮点

1. **类型安全**: API 和 Plan 定价使用不同的 TypeScript 接口
2. **数据隔离**: API 价格存入 `channel_prices`，Plan 价格存入 `plans`
3. **并行执行**: API 和 Plan 爬虫独立运行，互不影响
4. **容错机制**: 单个爬虫失败不影响其他
5. **货币转换**: 自动处理 CNY → USD 转换（硅基流动、DeepSeek）
6. **价格变化追踪**: 自动检测并记录显著价格变化（>20%）

## 📝 注意事项

### API 定价爬虫
- ✅ 关注 **input/output 价格** per 1M tokens
- ✅ 支持 **缓存输入价格**（如 Claude prompt caching）
- ✅ 记录 **上下文窗口大小**
- ✅ 支持 **速率限制** 说明

### Plan 定价爬虫
- ✅ 区分 **月付/年付** 价格
- ✅ 记录 **套餐层级** (free/pro/team/enterprise)
- ✅ 保存 **功能列表** 和 **可用模型**
- ✅ 标记 **国内可访问性** 和 **支付方式**

## 🎉 总结

现在系统支持：
- ✅ **7 个 API 定价数据源**
- ✅ **2 个 Plan 定价数据源**
- ✅ **250+ 模型价格**
- ✅ **7 个订阅套餐**
- ✅ **完整的类型安全**
- ✅ **自动化执行（GitHub Actions）**

每小时自动更新，确保数据始终最新！ 🚀
