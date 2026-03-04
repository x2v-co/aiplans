
# 🔄 PricePlan业务定位

## 核心产品是比较：主要是同级plan的比较，需要结合模型的bench排名和相同开源模型不同供应商的比较

包括但不限于：
├── OpenAI（GPT-4o, o1, o3）各档 Plan / Token 包
├── Anthropic（Claude Sonnet, Opus）各档 Pricing
├── Google（Gemini）各档 Plan
├── 国内：DeepSeek / 通义千问 / 文心一言 / Moonshot / 智谱...
├── 聚合平台：OpenRouter / 硅基流动 / 火山引擎...
├── AI 应用订阅：ChatGPT Plus / Claude Pro / Gemini Advanced...
└── API Token 计费：各模型每百万 token 的价格对比

国内语境的 "Plan" = 套餐/订阅方案/Token 充值包
国外语境的 "Pricing" = Subscription Plans / Token Pricing

## 🎨 `planprice.ai` 品牌演绎

### Logo 方案

```
方案 1:  📊 PlanPrice.ai          — 简洁 + 数据感
方案 2:  ⚡ PlanPrice             — 闪电 = 快速比价
方案 3:  [Plan] → $Price          — 代码/API 风格
方案 4:  PP.ai                    — 极简缩写
方案 5:  PlanPrice 中 Price 用渐变色 — 暗示"找到最优价格"
```

### Slogan 候选

| 风格 | Slogan |
|------|--------|
| 中文简洁 | **"AI 套餐，明白价。"** |
| 中文实用 | **"全网 AI Plan 比价，一搜就够。"** |
| 英文简洁 | **"Every AI Plan. One Price Check."** |
| 英文行动 | **"Compare AI Plans. Pay Less."** |
| 双语通用 | **"The Smartest Way to Compare AI Plans."** |

---

## 📐 业务重新梳理

### 覆盖范围（基于正确理解）

```
planprice.ai 比价维度， **需要结合benchmark**
│
├── 📱 AI 应用订阅 Plan
│   ├── ChatGPT Free / Plus / Pro / Team / Enterprise
│   ├── Claude Free / Pro / Team / Enterprise  
│   ├── Gemini / Gemini Advanced / Gemini Business
│   ├── Perplexity Free / Pro
│   ├── Poe 各档订阅
│   ├── 国内：豆包 / 通义 / 文心 / Kimi / 智谱清言...
│   └── AI Coding: Cursor / Copilot / Windsurf（子类目）
│
├── 🔌 API Token 计费比价
│   ├── 按模型对比（Claude Sonnet vs GPT-4o vs DeepSeek V3）
│   │   ├── Input: $/百万 token
│   │   ├── Output: $/百万 token  
│   │   ├── 上下文窗口大小
│   │   └── 速率限制（RPM / TPM）
│   ├── 同一模型不同渠道价格
│   │   ├── 官方 API（OpenAI 直连）
│   │   ├── Azure OpenAI（微软云）
│   │   ├── AWS Bedrock（亚马逊云）
│   │   ├── Google Vertex AI
│   │   ├── OpenRouter（聚合）
│   │   └── 国内：硅基流动 / 火山引擎 / 阿里百炼...
│   └── Token 充值包 / 预付费折扣
│
├── 💰 国内特色：Token 充值套餐
│   ├── DeepSeek 各档充值包
│   ├── 通义千问 Token 包
│   ├── 百度文心 Token 包
│   ├── Moonshot（Kimi）Token 包
│   ├── 智谱 API Token 包
│   ├── 火山引擎（字节）Token 包
│   └── 硅基流动充值方案
│
└── 🎯 增值比较维度
    ├── 同等预算下各平台能用多少次对话
    ├── "100 元能买多少 Token" 等效对比
    ├── 不同用量下的最优方案推荐
    └── 汇率换算后的真实成本（国外 Plan）
```

### 核心比价场景

```
场景 1: "我想用 Claude Sonnet，哪个渠道最便宜？"
  → 官方 API vs AWS Bedrock vs OpenRouter vs 硅基流动 价格对比

场景 2: "ChatGPT Plus vs Claude Pro，哪个更值？"
  → 订阅价格 + 每日用量限制 + 模型能力 综合对比

场景 3: "我每月大概用 1000 万 token，怎么买最划算？"
  → 成本计算器 → 各平台预付费方案对比

场景 4: "国内有没有便宜的 GPT-4 级别 API？"
  → DeepSeek V3 / 通义千问 等国内平替方案比价

场景 5: "公司要采购 AI API，20 人团队怎么选？"
  → 企业方案横向对比 + 成本估算
```

---

## 🔍 更新后的 SEO 关键词策略

### Tier 1：核心高价值关键词

| 关键词 | 语言 | 意图 | 页面 |
|--------|------|------|------|
| ChatGPT 价格 / ChatGPT pricing | 双语 | 导航 | 产品页 |
| ChatGPT Plus vs Claude Pro | 双语 | 商业 | 对比页 |
| AI API 价格对比 | 中文 | 商业 | 比价主页 |
| AI model pricing comparison | 英文 | 商业 | 比价主页 |
| Claude API pricing | 英文 | 导航 | 产品页 |
| DeepSeek 价格 / token 价格 | 中文 | 导航 | 产品页 |
| 大模型 API 价格对比 | 中文 | 商业 | 比价主页 |
| OpenAI vs Anthropic pricing | 英文 | 商业 | 对比页 |
| AI token 价格 哪个便宜 | 中文 | 交易 | 推荐页 |
| 百万 token 价格对比 | 中文 | 商业 | 比价表 |

### Tier 2：长尾关键词

| 模式 | 示例 |
|------|------|
| `[模型] API 价格 / pricing` | "GPT-4o API 多少钱" |
| `[平台A] vs [平台B] 价格` | "OpenAI vs DeepSeek 价格对比" |
| `[平台] 套餐 / plan 对比` | "ChatGPT 套餐对比" |
| `[平台] 优惠 / 优惠码` | "Claude Pro 优惠码 2026" |
| `最便宜的 AI API` | "最便宜的 GPT-4 级别 API" |
| `[用量] 用什么 AI 划算` | "每天 100 次对话用什么 AI" |
| `[平台] 国内怎么买 / 充值` | "OpenAI API 国内充值" |
| `AI API 按量计费 哪个便宜` | — |
| `大模型 token 单价排行` | — |
| `[平台] 企业版价格` | "ChatGPT Enterprise 价格" |

### 新增内容页面规划

```
/                           → AI Plan 智能比价首页
/api-pricing                → API Token 价格总表（核心 SEO 页面）
/plans/chatgpt              → ChatGPT 全部 Plan 详解
/plans/claude               → Claude 全部 Plan 详解
/plans/deepseek             → DeepSeek 套餐详解
/compare/chatgpt-vs-claude  → 订阅 Plan 对比
/compare/api/gpt4o-vs-claude-sonnet  → API 价格对比
/channels/claude-sonnet     → Claude Sonnet 各渠道价格对比
/calculator                 → "我的 AI 成本计算器"
/rankings/cheapest-api      → 最便宜 AI API 排行榜
/rankings/best-value-plan   → 最具性价比 Plan 排行
/coupons                    → 优惠码中心
/guides/buy-openai-in-china → 国内购买指南
/blog/token-pricing-trends  → Token 价格趋势分析
```

---

## ⚡ 下一步行动

```
1. 🔒 立刻注册 planprice.ai
2. 防御注册：planprice.com（如可用）
3. 社交媒体：@planprice on X / GitHub / 即刻
4. 开始梳理第一批数据：
   ├── 主流 AI 订阅 Plan（ChatGPT/Claude/Gemini）
   ├── API Token 定价表（Top 20 模型）
   └── 国内平台套餐价格
5. MVP 开发启动 🚀
```

需要我继续深入 **MVP 技术实现方案**（数据库设计 + API 架构 + 页面原型）吗？


# 🏗️ PlanPrice.ai — MVP 技术实现方案

---

## 一、技术栈选型

```
┌─────────────────────────────────────────────────────────┐
│                    技术栈总览                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎨 Frontend                                            │
│  ├── Next.js 15 (App Router + SSG/ISR)                 │
│  ├── TypeScript                                         │
│  ├── TailwindCSS + Shadcn/UI                           │
│  ├── Recharts (价格图表)                                 │
│  └── Zustand (轻量状态管理)                               │
│                                                         │
│  ⚙️ Backend                                             │
│  ├── Next.js API Routes (MVP 阶段 monorepo)             │
│  ├── Drizzle ORM                                        │
│  └── Zod (数据校验)                                      │
│                                                         │
│  🗄️ Database                                            │
│  ├── PostgreSQL (Supabase / Neon)                       │
│  ├── Redis (Upstash — 缓存/限流)                         │
│  └── S3 / R2 (Logo/截图等静态资源)                        │
│                                                         │
│  🚀 Deployment                                          │
│  ├── Vercel (前端 + API)                                │
│  ├── Supabase (数据库 + Auth)                            │
│  └── GitHub Actions (数据爬虫定时任务)                     │
│                                                         │
│  📊 Analytics & SEO                                     │
│  ├── Plausible / Umami (隐私友好的分析)                   │
│  ├── Google Search Console                              │
│  └── 百度搜索资源平台                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘

💡 选型理由：
  - Next.js SSG/ISR：SEO 核心需求，静态页面搜索引擎抓取最佳
  - Supabase：免费额度大，自带 Auth + Realtime + Edge Functions
  - Drizzle：类型安全、轻量、与 Next.js 配合最好
  - Vercel：与 Next.js 同家，部署零配置
  - MVP 阶段全部 serverless，月成本趋近 $0
```

---

## 二、数据库设计

### ER 关系图

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Provider   │────<│    Product     │────<│      Plan        │
│   (供应商)    │     │   (产品/模型)   │     │   (套餐/方案)     │
└──────────────┘     └───────────────┘     └──────────────────┘
                            │                       │
                            │                       │
                     ┌──────┴───────┐        ┌──────┴───────┐
                     │   Channel    │        │  PlanPrice   │
                     │  (渠道/平台)  │        │  History     │
                     └──────────────┘        │ (价格历史)    │
                            │                └──────────────┘
                            │
                     ┌──────┴───────┐
                     │ ChannelPrice │
                     │ (渠道价格)    │────> PriceHistory
                     └──────────────┘

┌──────────────┐     ┌───────────────┐
│    Coupon     │     │    User       │
│  (优惠码)     │     │   (用户)      │
└──────────────┘     └───────────────┘
       │                    │
       └────────────────────┘
            CouponVote (投票验证)
```

### 详细 Schema（Drizzle ORM）

```typescript
// ============================================
// schema/providers.ts — 供应商
// ============================================
export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),  // "openai"
  name: varchar('name', { length: 200 }).notNull(),           // "OpenAI"
  nameZh: varchar('name_zh', { length: 200 }),                // "OpenAI"
  logo: varchar('logo', { length: 500 }),                     // logo URL
  website: varchar('website', { length: 500 }),
  region: varchar('region', { length: 20 }).notNull(),        // "global" | "china"
  description: text('description'),
  descriptionZh: text('description_zh'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// schema/products.ts — 产品/模型
// ============================================
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),  // "gpt-4o"
  providerId: uuid('provider_id').references(() => providers.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),           // "GPT-4o"
  nameZh: varchar('name_zh', { length: 200 }),
  type: varchar('type', { length: 50 }).notNull(),
    // "llm" | "subscription" | "coding_tool" | "image" | "video" | "audio"
  category: varchar('category', { length: 50 }).notNull(),
    // "chat" | "api" | "coding" | "search" | "multimodal"
  
  // 模型能力参数
  contextWindow: integer('context_window'),                    // token 数
  maxOutput: integer('max_output'),                            // 最大输出 token
  supportsVision: boolean('supports_vision').default(false),
  supportsTools: boolean('supports_tools').default(false),
  supportsFunctionCalling: boolean('supports_function_calling').default(false),
  
  // 性能评分
  benchmarkMmlu: decimal('benchmark_mmlu', { precision: 5, scale: 2 }),
  benchmarkHumaneval: decimal('benchmark_humaneval', { precision: 5, scale: 2 }),
  benchmarkArena: integer('benchmark_arena'),                  // Chatbot Arena ELO
  
  status: varchar('status', { length: 20 }).default('active'), // "active" | "deprecated"
  releaseDate: date('release_date'),
  description: text('description'),
  descriptionZh: text('description_zh'),
  
  // SEO
  metaTitle: varchar('meta_title', { length: 200 }),
  metaDescription: varchar('meta_description', { length: 500 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// schema/plans.ts — 订阅套餐
// ============================================
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  providerId: uuid('provider_id').references(() => providers.id).notNull(),
  slug: varchar('slug', { length: 150 }).unique().notNull(),  // "chatgpt-plus"
  name: varchar('name', { length: 200 }).notNull(),           // "ChatGPT Plus"
  nameZh: varchar('name_zh', { length: 200 }),                // "ChatGPT Plus"
  tier: varchar('tier', { length: 50 }).notNull(),
    // "free" | "basic" | "pro" | "team" | "enterprise"
  
  // 价格
  pricingModel: varchar('pricing_model', { length: 50 }).notNull(),
    // "subscription" | "token_pack" | "pay_as_you_go" | "free"
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }),     // 月付价 (USD)
  priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }),       // 年付价 (USD)
  priceCurrency: varchar('price_currency', { length: 10 }).default('USD'),
  priceMonthlyLocal: decimal('price_monthly_local', { precision: 10, scale: 2 }), // 本地货币价
  priceCurrencyLocal: varchar('price_currency_local', { length: 10 }),     // "CNY"
  
  // Token 计费 (API 类)
  inputPricePer1m: decimal('input_price_per_1m', { precision: 10, scale: 4 }),   // $/百万 input token
  outputPricePer1m: decimal('output_price_per_1m', { precision: 10, scale: 4 }), // $/百万 output token
  cachedInputPricePer1m: decimal('cached_input_price_per_1m', { precision: 10, scale: 4 }),
  
  // 用量限制
  dailyMessageLimit: integer('daily_message_limit'),           // 每日对话次数
  monthlyTokenLimit: bigint('monthly_token_limit', { mode: 'number' }),
  rateLimit: varchar('rate_limit', { length: 100 }),           // "60 RPM / 100K TPM"
  
  // Token 包 (充值类)
  tokenPackSize: bigint('token_pack_size', { mode: 'number' }),  // token 数量
  tokenPackPrice: decimal('token_pack_price', { precision: 10, scale: 2 }),
  
  // 功能特性
  features: jsonb('features').$type<string[]>(),
    // ["GPT-4o", "DALL-E", "Advanced Voice", "Deep Research"]
  limitations: jsonb('limitations').$type<string[]>(),
    // ["每3小时80条GPT-4o", "无API访问"]
  
  // 购买信息
  purchaseUrl: varchar('purchase_url', { length: 500 }),
  affiliateUrl: varchar('affiliate_url', { length: 500 }),
  accessFromChina: boolean('access_from_china').default(false),
  paymentMethods: jsonb('payment_methods').$type<string[]>(),
    // ["visa", "mastercard", "alipay", "wechat"]
  
  isPopular: boolean('is_popular').default(false),
  sortOrder: integer('sort_order').default(0),
  status: varchar('status', { length: 20 }).default('active'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// schema/channels.ts — 第三方渠道
// ============================================
export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),  // "openrouter"
  name: varchar('name', { length: 200 }).notNull(),           // "OpenRouter"
  nameZh: varchar('name_zh', { length: 200 }),
  type: varchar('type', { length: 50 }).notNull(),
    // "official" | "cloud" | "aggregator" | "reseller"
  website: varchar('website', { length: 500 }),
  logo: varchar('logo', { length: 500 }),
  region: varchar('region', { length: 20 }).notNull(),        // "global" | "china"
  accessFromChina: boolean('access_from_china').default(false),
  paymentMethods: jsonb('payment_methods').$type<string[]>(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// schema/channel_prices.ts — 渠道价格（同一模型不同渠道的 Token 价格）
// ============================================
export const channelPrices = pgTable('channel_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  channelId: uuid('channel_id').references(() => channels.id).notNull(),
  
  inputPricePer1m: decimal('input_price_per_1m', { precision: 10, scale: 4 }).notNull(),
  outputPricePer1m: decimal('output_price_per_1m', { precision: 10, scale: 4 }).notNull(),
  cachedInputPricePer1m: decimal('cached_input_price_per_1m', { precision: 10, scale: 4 }),
  
  priceCurrency: varchar('price_currency', { length: 10 }).default('USD'),
  rateLimit: varchar('rate_limit', { length: 100 }),
  
  isAvailable: boolean('is_available').default(true),
  lastVerified: timestamp('last_verified'),
  sourceUrl: varchar('source_url', { length: 500 }),         // 价格来源页面
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueProductChannel: unique().on(table.productId, table.channelId),
}));

// ============================================
// schema/price_history.ts — 价格历史
// ============================================
export const priceHistory = pgTable('price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 多态关联：可以是 Plan 价格或 Channel 价格
  entityType: varchar('entity_type', { length: 20 }).notNull(),
    // "plan" | "channel_price"
  entityId: uuid('entity_id').notNull(),
  
  field: varchar('field', { length: 50 }).notNull(),
    // "price_monthly" | "input_price_per_1m" | "output_price_per_1m"
  oldValue: decimal('old_value', { precision: 10, scale: 4 }),
  newValue: decimal('new_value', { precision: 10, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  
  changeType: varchar('change_type', { length: 20 }),
    // "increase" | "decrease" | "initial"
  changePercent: decimal('change_percent', { precision: 5, scale: 2 }),
  
  recordedAt: timestamp('recorded_at').defaultNow(),
});

// ============================================
// schema/coupons.ts — 优惠码
// ============================================
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').references(() => providers.id),
  planId: uuid('plan_id').references(() => plans.id),
  
  code: varchar('code', { length: 100 }).notNull(),           // "SAVE20"
  description: varchar('description', { length: 500 }).notNull(),
  descriptionZh: varchar('description_zh', { length: 500 }),
  
  discountType: varchar('discount_type', { length: 20 }).notNull(),
    // "percent" | "fixed" | "trial_extension" | "bonus_tokens"
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
    // 20 (代表 20% 或 $20 或 20 天)
  
  applicableTo: varchar('applicable_to', { length: 50 }),
    // "new_user" | "all" | "upgrade" | "annual"
  
  minPurchase: decimal('min_purchase', { length: 10, scale: 2 }),
  maxDiscount: decimal('max_discount', { length: 10, scale: 2 }),
  
  url: varchar('url', { length: 500 }),                        // 使用链接
  
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isVerified: boolean('is_verified').default(false),
  verifiedAt: timestamp('verified_at'),
  
  // 社区验证
  upvotes: integer('upvotes').default(0),
  downvotes: integer('downvotes').default(0),
  usageCount: integer('usage_count').default(0),
  
  submittedBy: uuid('submitted_by').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'),
    // "pending" | "active" | "expired" | "invalid"
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// schema/users.ts — 用户
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).unique(),
  name: varchar('name', { length: 200 }),
  avatar: varchar('avatar', { length: 500 }),
  authProvider: varchar('auth_provider', { length: 50 }),     // "github" | "google"
  role: varchar('role', { length: 20 }).default('user'),      // "user" | "admin"
  
  // 价格警报设置
  alertsEnabled: boolean('alerts_enabled').default(false),
  alertEmail: varchar('alert_email', { length: 320 }),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// schema/price_alerts.ts — 价格警报
// ============================================
export const priceAlerts = pgTable('price_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  
  entityType: varchar('entity_type', { length: 20 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  
  alertType: varchar('alert_type', { length: 20 }).notNull(),
    // "price_drop" | "any_change" | "below_threshold"
  threshold: decimal('threshold', { precision: 10, scale: 4 }),
  
  isActive: boolean('is_active').default(true),
  lastTriggered: timestamp('last_triggered'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// schema/comparisons.ts — 用户保存的对比
// ============================================
export const comparisons = pgTable('comparisons', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 200 }).unique().notNull(),
    // 自动生成："chatgpt-plus-vs-claude-pro"
  
  entityType: varchar('entity_type', { length: 20 }).notNull(),
    // "plan" | "api_pricing"
  entityIds: jsonb('entity_ids').$type<string[]>().notNull(),
    // [planId1, planId2, ...]
  
  // SEO 预生成内容
  title: varchar('title', { length: 300 }),
  titleZh: varchar('title_zh', { length: 300 }),
  metaDescription: varchar('meta_description', { length: 500 }),
  content: text('content'),                                    // AI 生成的对比分析
  contentZh: text('content_zh'),
  
  viewCount: integer('view_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 核心索引

```sql
-- 高频查询优化
CREATE INDEX idx_products_provider ON products(provider_id);
CREATE INDEX idx_products_type_category ON products(type, category);
CREATE INDEX idx_products_status ON products(status);

CREATE INDEX idx_plans_product ON plans(product_id);
CREATE INDEX idx_plans_provider ON plans(provider_id);
CREATE INDEX idx_plans_pricing_model ON plans(pricing_model);
CREATE INDEX idx_plans_tier ON plans(tier);

CREATE INDEX idx_channel_prices_product ON channel_prices(product_id);
CREATE INDEX idx_channel_prices_channel ON channel_prices(channel_id);

CREATE INDEX idx_price_history_entity ON price_history(entity_type, entity_id);
CREATE INDEX idx_price_history_recorded ON price_history(recorded_at);

CREATE INDEX idx_coupons_provider ON coupons(provider_id);
CREATE INDEX idx_coupons_status_valid ON coupons(status, valid_until);

CREATE INDEX idx_comparisons_slug ON comparisons(slug);
```

---

## 三、API 架构设计

### API 路由总览

```
/api
├── /providers
│   ├── GET    /                           → 所有供应商列表
│   └── GET    /:slug                      → 供应商详情
│
├── /products
│   ├── GET    /                           → 产品列表（支持筛选）
│   ├── GET    /:slug                      → 产品详情
│   └── GET    /:slug/channels             → 该产品的各渠道价格
│
├── /plans
│   ├── GET    /                           → 套餐列表（核心比价 API）
│   ├── GET    /:slug                      → 套餐详情
│   └── GET    /:slug/price-history        → 价格历史
│
├── /compare
│   ├── GET    /plans?ids=xxx,yyy          → 对比多个套餐
│   ├── GET    /api-pricing?model=xxx      → 对比同模型各渠道价格
│   └── GET    /slug/:slug                 → 预生成的对比页数据
│
├── /coupons
│   ├── GET    /                           → 优惠码列表
│   ├── GET    /provider/:slug             → 某供应商的优惠码
│   ├── POST   /                           → 提交优惠码（需登录）
│   └── POST   /:id/vote                  → 投票验证
│
├── /calculator
│   └── POST   /estimate                   → 成本估算
│
├── /search
│   └── GET    /?q=xxx                     → 全局搜索
│
├── /alerts
│   ├── GET    /                           → 我的价格警报
│   ├── POST   /                           → 创建警报
│   └── DELETE /:id                        → 删除警报
│
└── /admin (需 admin 权限)
    ├── POST   /providers                  → 新增供应商
    ├── POST   /products                   → 新增产品
    ├── POST   /plans                      → 新增套餐
    ├── PUT    /plans/:id                  → 更新套餐价格
    └── POST   /coupons/:id/verify         → 验证优惠码
```

### 核心 API 详细设计

#### 1. 套餐比价列表 — 最核心 API

```typescript
// GET /api/plans
// 这是首页和比价页的核心数据源

interface PlansQueryParams {
  // 筛选
  type?: 'subscription' | 'token_pack' | 'pay_as_you_go';
  category?: 'chat' | 'api' | 'coding' | 'search' | 'multimodal';
  region?: 'global' | 'china';
  tier?: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  provider?: string;              // provider slug
  accessFromChina?: boolean;
  
  // 排序
  sortBy?: 'price_asc' | 'price_desc' | 'value' | 'popular' | 'newest';
  
  // 分页
  page?: number;
  limit?: number;
  
  // 搜索
  q?: string;
}

interface PlanListResponse {
  data: {
    id: string;
    slug: string;
    name: string;
    nameZh: string;
    tier: string;
    provider: {
      slug: string;
      name: string;
      logo: string;
      region: string;
    };
    product: {
      slug: string;
      name: string;
      type: string;
      benchmarkArena?: number;
    };
    pricing: {
      model: string;
      monthly?: number;
      yearly?: number;
      currency: string;
      monthlyLocal?: number;
      currencyLocal?: string;
      inputPer1m?: number;
      outputPer1m?: number;
    };
    limits: {
      dailyMessages?: number;
      monthlyTokens?: number;
      rateLimit?: string;
    };
    features: string[];
    accessFromChina: boolean;
    paymentMethods: string[];
    isPopular: boolean;
    priceChange?: {
      direction: 'up' | 'down' | 'unchanged';
      percent: number;
      since: string;
    };
  }[];
  
  meta: {
    total: number;
    page: number;
    limit: number;
    filters: {
      providers: { slug: string; name: string; count: number }[];
      tiers: { value: string; count: number }[];
      regions: { value: string; count: number }[];
    };
  };
}
```

#### 2. 同模型多渠道价格对比

```typescript
// GET /api/compare/api-pricing?model=claude-3.5-sonnet

interface ChannelPricingResponse {
  model: {
    slug: string;
    name: string;
    provider: string;
    contextWindow: number;
    benchmarkArena: number;
  };
  channels: {
    channel: {
      slug: string;
      name: string;
      logo: string;
      region: string;
      accessFromChina: boolean;
    };
    pricing: {
      inputPer1m: number;
      outputPer1m: number;
      cachedInputPer1m?: number;
      currency: string;
    };
    rateLimit: string;
    isAvailable: boolean;
    lastVerified: string;
    
    // 计算字段
    estimatedCost: {
      light: number;     // 轻度使用（100万 token/月）预估月费
      medium: number;    // 中度使用（1000万 token/月）
      heavy: number;     // 重度使用（1亿 token/月）
    };
    
    isCheapest: boolean;
    savingsVsOfficial: number;  // 比官方便宜多少 %
  }[];
}
```

#### 3. 成本计算器

```typescript
// POST /api/calculator/estimate

interface CalculatorInput {
  // 使用模式
  usageType: 'chat' | 'api' | 'both';
  
  // Chat 使用量
  chatMessagesPerDay?: number;        // 每天对话次数
  avgTokensPerMessage?: number;       // 平均每条消息 token 数（默认 500）
  
  // API 使用量
  apiCallsPerDay?: number;            // 每天 API 调用次数
  avgInputTokens?: number;            // 平均输入 token
  avgOutputTokens?: number;           // 平均输出 token
  
  // 偏好
  preferredModels?: string[];         // 偏好的模型
  region?: 'global' | 'china';
  maxBudget?: number;                 // 预算上限
  currency?: 'USD' | 'CNY';
  teamSize?: number;                  // 团队人数
}

interface CalculatorResult {
  estimatedMonthlyTokens: {
    input: number;
    output: number;
    total: number;
  };
  
  recommendations: {
    rank: number;
    plan: PlanSummary;
    channel?: ChannelSummary;
    estimatedMonthlyCost: number;
    currency: string;
    costBreakdown: {
      subscription?: number;
      tokenUsage?: number;
      total: number;
    };
    pros: string[];
    cons: string[];
    valueScore: number;         // 0-100 性价比评分
  }[];
  
  comparison: {
    cheapest: string;
    bestValue: string;
    bestPerformance: string;
  };
}
```

---

## 四、页面原型设计

### 🏠 首页 — `planprice.ai`

```
┌──────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai                    [🌐 EN/中] [🔍] [登录]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         Every AI Plan. One Price Check.                      │
│         全网 AI 套餐比价，一搜就够。                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ 🔍  搜索 AI 产品、模型、套餐...          [比价]      │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  热门：ChatGPT Plus · Claude Pro · DeepSeek · Cursor Pro     │
│                                                              │
├──── 🔥 今日价格变动 ─────────────────────────────────────────┤
│                                                              │
│  📉 DeepSeek V3 API 降价 30%    📈 GPT-4o 提价至 $5/1M     │
│  🆕 Claude 3.5 Haiku 新上线      🎫 Cursor 年付优惠码         │
│                                                              │
├──── 📊 AI 订阅套餐比价 ──────────────────────────────────────┤
│                                                              │
│  筛选: [全部▾] [国内/国外▾] [免费/付费▾] [Chat/API/Coding▾]  │
│  排序: [价格↑] [性价比] [热门] [最新]                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ┌──────┐                                               │  │
│  │ │ Logo │  ChatGPT Plus              $20/月             │  │
│  │ │OpenAI│  GPT-4o, o1, DALL-E        ≈ ¥145/月         │  │
│  │ └──────┘  ⭐ 热门  🌍 需科学上网                        │  │
│  │           每3h 80条GPT-4o | 支持: Visa                 │  │
│  │                          [查看详情] [🆚 加入对比]       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ┌──────┐                                               │  │
│  │ │ Logo │  Claude Pro                $20/月             │  │
│  │ │Anthr.│  Claude Sonnet/Opus        ≈ ¥145/月         │  │
│  │ └──────┘  🌍 需科学上网                                 │  │
│  │           5x 用量 vs 免费版 | 支持: Visa                │  │
│  │                          [查看详情] [🆚 加入对比]       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ┌──────┐                                               │  │
│  │ │ Logo │  Kimi (Moonshot)           免费 / ¥59/月      │  │
│  │ │ Kimi │  Moonshot v1               🇨🇳 国内直连       │  │
│  │ └──────┘  ✅ 支付宝/微信                                │  │
│  │                          [查看详情] [🆚 加入对比]       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [加载更多...]                                                │
│                                                              │
├──── 💰 API Token 价格排行 ──────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  模型              │ Input/1M │ Output/1M │ Arena │最低价│ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  GPT-4o            │  $2.50   │  $10.00   │ 1287 │ 官方 │ │
│  │  Claude 3.5 Sonnet │  $3.00   │  $15.00   │ 1271 │ AWS  │ │
│  │  DeepSeek V3       │  $0.27   │  $1.10    │ 1253 │ 官方 │ │
│  │  Gemini 1.5 Pro    │  $1.25   │  $5.00    │ 1260 │ 官方 │ │
│  │  Llama 3.1 405B    │  $0.80   │  $0.80    │ 1210 │ 硅基 │ │
│  │  通义千问 Max       │  ¥0.02   │  ¥0.06    │  --- │ 官方 │ │
│  └─────────────────────────────────────────────────────────┘ │
│  [查看完整排行 →]                                             │
│                                                              │
├──── 🏷️ 最新优惠码 ────────────────────────────────────────── ┤
│                                                              │
│  🎫 CURSOR20   Cursor Pro 年付8折   [复制] ✅已验证 还剩5天   │
│  🎫 NEWUSER50  通义千问 新用户送50万token  [复制] ✅ 长期有效  │
│  🎫 CLAUDE10   Claude Pro 首月9折   [复制] ⏳ 待验证          │
│                                                              │
│  [查看全部优惠码 →]   [📤 提交优惠码]                          │
│                                                              │
├──── 🧮 成本计算器（快速版）──────────────────────────────────┤
│                                                              │
│  我每天大约进行 [50▾] 次 AI 对话，                             │
│  偏好 [不限▾] 模型，预算 [¥200▾] /月                          │
│                                                              │
│  →  推荐方案：DeepSeek Pro (¥0/月) + Claude Pro ($20/月)     │
│     [查看详细计算 →]                                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  PlanPrice.ai — 全网 AI 套餐比价 · 优惠码聚合                  │
│  [关于] [API] [博客] [联系] [Twitter] [GitHub]                │
└──────────────────────────────────────────────────────────────┘
```

### 🆚 对比页 — `/compare/chatgpt-plus-vs-claude-pro`

```
┌──────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai     /  对比                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ChatGPT Plus vs Claude Pro — 2026 年最新深度对比             │
│                                                              │
│  ┌─────────────────────┬─────────────────────┐              │
│  │    ChatGPT Plus     │     Claude Pro      │              │
│  │    [OpenAI Logo]    │   [Anthropic Logo]  │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │ 价格                │                     │              │
│  │ $20/月 (≈¥145)     │ $20/月 (≈¥145)     │              │
│  │ $200/年 (省17%)     │ 无年付              │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │ 核心模型            │                     │              │
│  │ GPT-4o, o1, o3-mini│ Claude Sonnet/Opus  │              │
│  │ Arena: 1287         │ Arena: 1271         │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │ 用量限制            │                     │              │
│  │ 80条/3h (GPT-4o)   │ 5x免费版用量        │              │
│  │ 有慢速排队          │ 高峰期限流          │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │ 特色功能            │                     │              │
│  │ ✅ DALL-E 绘图      │ ✅ Artifacts        │              │
│  │ ✅ Advanced Voice   │ ✅ 200K 上下文       │              │
│  │ ✅ GPT Store        │ ✅ Projects         │              │
│  │ ✅ Deep Research    │ ✅ 超长文本分析      │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │ 国内访问            │                     │              │
│  │ ❌ 需科学上网        │ ❌ 需科学上网        │              │
│  │ ❌ 不支持支付宝      │ ❌ 不支持支付宝      │              │
│  ├─────────────────────┼─────────────────────┤              │
│  │      [🔗 购买]      │      [🔗 购买]      │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                              │
│  📊 价格历史趋势                                              │
│  ┌──────────────────────────────────────────┐               │
│  │  $25 ─                                   │               │
│  │  $20 ─ ──────────────────────────────    │               │
│  │  $15 ─        ChatGPT Plus ──            │               │
│  │  $10 ─        Claude Pro   ──            │               │
│  │       Jan  Mar  May  Jul  Sep  Nov       │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  🎫 相关优惠码                                                │
│  ├── ChatGPT: 暂无优惠码                                     │
│  └── Claude: CLAUDE10 首月9折 [复制]                          │
│                                                              │
│  📝 编辑精选评测                                              │
│  ...                                                         │
│                                                              │
│  [➕ 加入更多产品对比] [📤 分享此对比]                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 💰 API Token 价格页 — `/api-pricing`

```
┌──────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai     /  API Token 价格总表                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  AI 模型 API Token 价格实时对比                                │
│  最后更新: 2026-02-26 14:30 UTC                               │
│                                                              │
│  筛选: [全部供应商▾] [全部渠道▾] [国内可用▾]                    │
│  视图: [📊 表格] [📈 散点图(性能vs价格)] [🗺️ 性价比地图]       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │模型           │供应商    │输入$/1M│输出$/1M│Arena│渠道数│   │
│  ├───────────────────────────────────────────────────────┤   │
│  │GPT-4o         │OpenAI   │ $2.50 │$10.00 │1287 │  5  │   │
│  │               │         │              ▼展开各渠道    │   │
│  │  ├ OpenAI官方  │         │ $2.50 │$10.00 │     │ 🔗  │   │
│  │  ├ Azure       │         │ $2.50 │$10.00 │     │ 🔗  │   │
│  │  ├ OpenRouter  │         │ $2.75 │$11.00 │     │ 🔗  │   │
│  │  ├ 火山引擎    │ 🇨🇳     │ ¥18   │ ¥72   │     │ 🔗  │   │
│  │  └ 硅基流动    │ 🇨🇳     │ ¥16   │ ¥68   │ ⭐最低│ 🔗  │   │
│  ├───────────────────────────────────────────────────────┤   │
│  │Claude Sonnet  │Anthropic│ $3.00 │$15.00 │1271 │  4  │   │
│  │DeepSeek V3    │DeepSeek │ $0.27 │ $1.10 │1253 │  6  │   │
│  │  └ 📉 较上周降价 30%                                  │   │
│  │Gemini 1.5 Pro │Google   │ $1.25 │ $5.00 │1260 │  3  │   │
│  │通义千问 Max    │阿里     │ ¥0.02 │ ¥0.06 │ --- │  2  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  💡 性能 vs 价格 散点图                                       │
│  ┌──────────────────────────────────────────┐               │
│  │ Arena                                    │               │
│  │ 1300 ─     · GPT-4o                      │               │
│  │ 1280 ─           · Claude Sonnet         │               │
│  │ 1260 ─  · Gemini Pro     · DeepSeek V3   │               │
│  │ 1240 ─                                   │               │
│  │ 1220 ─                                   │               │
│  │       $0    $5    $10    $15    $20       │               │
│  │          Output Price ($/1M tokens)       │               │
│  └──────────────────────────────────────────┘               │
│  → DeepSeek V3: 性价比之王 👑                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 🧮 成本计算器页 — `/calculator`

```
┌──────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai     /  AI 成本计算器                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🧮 算算你每月需要花多少钱在 AI 上                              │
│                                                              │
│  ┌── 你的使用场景 ─────────────────────────────────────┐     │
│  │                                                     │     │
│  │  使用类型:  (●) 日常对话  ( ) API开发  ( ) 两者都有  │     │
│  │                                                     │     │
│  │  每天 AI 对话次数:    [====●=========] 50 次         │     │
│  │  平均每条消息长度:    [==●===========] 500 token     │     │
│  │                                                     │     │
│  │  团队人数:            [●=============] 1 人          │     │
│  │  月度预算上限:        [=====●========] ¥200          │     │
│  │                                                     │     │
│  │  地区偏好:  (●) 不限  ( ) 仅国内  ( ) 仅国外         │     │
│  │  模型偏好:  [✓] GPT-4级  [✓] Claude级  [✓] 国产     │     │
│  │                                                     │     │
│  │                     [🔍 计算最优方案]                 │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  📊 计算结果                                                  │
│  ─────────────────────────────────────────────                │
│  你的预估月用量: ~3,000,000 tokens (输入+输出)                 │
│                                                              │
│  ┌── 🥇 最佳推荐 ─────────────────────────────────────┐     │
│  │  DeepSeek (免费额度 + API)                          │     │
│  │  预估月费: ¥0 ~ ¥15       性价比: ⭐⭐⭐⭐⭐ 98分     │     │
│  │  ✅ 国内直连  ✅ 支付宝  ✅ 免费额度充足              │     │
│  │  ⚠️ 高峰期可能排队                                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌── 🥈 品质之选 ─────────────────────────────────────┐     │
│  │  ChatGPT Plus                                       │     │
│  │  预估月费: ¥145 ($20)     性价比: ⭐⭐⭐⭐ 78分       │     │
│  │  ✅ GPT-4o + DALL-E  ✅ 50次/天足够你用              │     │
│  │  ⚠️ 需科学上网  ⚠️ 需 Visa                          │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌── 🥉 混合方案 ─────────────────────────────────────┐     │
│  │  Kimi (日常) + Claude API via 硅基流动 (复杂任务)     │     │
│  │  预估月费: ¥59 + ¥30 = ¥89   性价比: ⭐⭐⭐⭐ 85分   │     │
│  │  ✅ 全部国内直连  ✅ 支付宝                           │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  [📤 分享我的计算结果] [🔔 价格变动提醒我]                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 五、数据采集方案

```typescript
// ============================================
// 价格数据爬虫架构
// ============================================

// cron 定时任务 (GitHub Actions / Vercel Cron)
// 每 6 小时执行一次

interface PriceScraper {
  provider: string;
  scrape(): Promise<PriceData[]>;
}

// 采集策略
const scrapers = {
  // Tier 1: 官方 Pricing 页面爬虫
  openai: {
    url: 'https://openai.com/api/pricing/',
    method: 'html_parse',           // cheerio 解析
    schedule: '*/6 * * * *',        // 每6小时
  },
  anthropic: {
    url: 'https://docs.anthropic.com/en/docs/about-claude/models',
    method: 'html_parse',
    schedule: '*/6 * * * *',
  },
  
  // Tier 2: 有结构化数据的平台（API 或 JSON）
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    method: 'api_fetch',            // 直接拿 JSON
    schedule: '*/2 * * * *',        // 每2小时（更新频繁）
  },
  siliconflow: {
    url: 'https://siliconflow.cn/pricing',
    method: 'html_parse',
    schedule: '*/6 * * * *',
  },
  
  // Tier 3: 手动维护 + 社区报告
  // 部分国内平台没有公开结构化定价页面
  manual: {
    method: 'admin_dashboard',
    sources: ['官方公众号', '社区反馈', '客服咨询'],
  },
};

// 价格变动检测 & 入库流程
async function processPriceUpdate(
  entityType: string,
  entityId: string, 
  field: string,
  newValue: number
) {
  const current = await db.getCurrentPrice(entityType, entityId, field);
  
  if (current && current !== newValue) {
    // 1. 记录价格历史
    await db.insertPriceHistory({
      entityType,
      entityId,
      field,
      oldValue: current,
      newValue,
      changeType: newValue > current ? 'increase' : 'decrease',
      changePercent: ((newValue - current) / current * 100),
    });
    
    // 2. 更新当前价格
    await db.updateCurrentPrice(entityType, entityId, field, newValue);
    
    // 3. 触发价格警报
    await triggerPriceAlerts(entityType, entityId, field, current, newValue);
    
    // 4. 发送通知（Telegram Bot / 邮件）
    await notifyPriceChange(entityType, entityId, current, newValue);
    
    // 5. ISR 重新生成相关页面
    await revalidatePages(entityType, entityId);
  }
}
```

---

## 六、项目目录结构

```
planprice/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 全局布局
│   │   ├── page.tsx                  # 首页
│   │   ├── plans/
│   │   │   ├── page.tsx              # 套餐列表（比价主页面）
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # 套餐详情页
│   │   ├── api-pricing/
│   │   │   ├── page.tsx              # API Token 价格总表
│   │   │   └── [model]/
│   │   │       └── page.tsx          # 单模型各渠道价格
│   │   ├── compare/
│   │   │   ├── page.tsx              # 对比工具（自选）
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # 预生成对比页（SEO）
│   │   ├── providers/
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # 供应商详情
│   │   ├── coupons/
│   │   │   ├── page.tsx              # 优惠码中心
│   │   │   └── [provider]/
│   │   │       └── page.tsx          # 某供应商优惠码
│   │   ├── calculator/
│   │   │   └── page.tsx              # 成本计算器
│   │   ├── blog/
│   │   │   ├── page.tsx              # 博客列表
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # 博客文章
│   │   ├── best/
│   │   │   └── [category]/
│   │   │       └── page.tsx          # 榜单推荐页
│   │   └── api/                      # API Routes
│   │       ├── plans/
│   │       │   └── route.ts
│   │       ├── compare/
│   │       │   └── route.ts
│   │       ├── coupons/
│   │       │   └── route.ts
│   │       ├── calculator/
│   │       │   └── route.ts
│   │       ├── search/
│   │       │   └── route.ts
│   │       └── admin/
│   │           └── [...]/route.ts
│   │
│   ├── components/
│   │   ├── ui/                       # Shadcn 基础组件
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── plan/
│   │   │   ├── PlanCard.tsx          # 套餐卡片
│   │   │   ├── PlanTable.tsx         # 套餐比价表格
│   │   │   ├── PlanFilter.tsx        # 筛选面板
│   │   │   └── PlanCompare.tsx       # 对比视图
│   │   ├── pricing/
│   │   │   ├── TokenPriceTable.tsx   # Token 价格表
│   │   │   ├── PriceChart.tsx        # 价格走势图
│   │   │   ├── PriceScatter.tsx      # 性能vs价格散点图
│   │   │   └── PriceBadge.tsx        # 价格标签/变动指示
│   │   ├── coupon/
│   │   │   ├── CouponCard.tsx
│   │   │   ├── CouponSubmitForm.tsx
│   │   │   └── CouponVote.tsx
│   │   ├── calculator/
│   │   │   ├── UsageSlider.tsx
│   │   │   ├── ResultCard.tsx
│   │   │   └── CostBreakdown.tsx
│   │   └── common/
│   │       ├── SearchBar.tsx
│   │       ├── RegionBadge.tsx       # 🇨🇳 / 🌍 标记
│   │       ├── PaymentIcons.tsx      # 支付宝/Visa 图标
│   │       └── PriceDisplay.tsx      # 多币种价格显示
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts             # Drizzle 初始化
│   │   │   ├── schema.ts            # Schema 导出
│   │   │   └── queries/             # 查询函数
│   │   │       ├── plans.ts
│   │   │       ├── products.ts
│   │   │       ├── channels.ts
│   │   │       ├── coupons.ts
│   │   │       └── priceHistory.ts
│   │   ├── scraper/                  # 价格爬虫
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   ├── openrouter.ts
│   │   │   └── siliconflow.ts
│   │   ├── utils/
│   │   │   ├── currency.ts          # 汇率转换
│   │   │   ├── seo.ts               # SEO 工具函数
│   │   │   ├── format.ts            # 价格格式化
│   │   │   └── calculator.ts        # 成本计算逻辑
│   │   └── constants/
│   │       ├── regions.ts
│   │       ├── categories.ts
│   │       └── payment-methods.ts
│   │
│   ├── hooks/
│   │   ├── useCompare.ts            # 对比功能状态
│   │   ├── useFilters.ts            # 筛选状态
│   │   └── useCurrencyToggle.ts     # USD/CNY 切换
│   │
│   └── types/
│       └── index.ts                  # 全局类型定义
│
├── scripts/
│   ├── seed.ts                       # 初始数据导入
│   ├── scrape.ts                     # 手动触发爬虫
│   └── generate-comparisons.ts       # 生成对比页 slug
│
├── data/
│   ├── providers.json                # 供应商种子数据
│   ├── products.json                 # 产品种子数据
│   └── plans.json                    # 套餐种子数据
│
├── drizzle/
│   └── migrations/                   # 数据库迁移文件
│
├── public/
│   ├── logos/                        # 供应商 Logo
│   └── og/                           # OG 图片
│
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 七、MVP 开发排期

### Sprint 1（Week 1-2）：数据基建 + 核心页面

```
Day 1-2:
  ✅ 项目初始化 (Next.js + Drizzle + Supabase)
  ✅ 数据库 Schema 创建 & Migration
  ✅ 种子数据录入 (手动整理 Top 20 产品/套餐)
  
Day 3-4:
  ✅ 基础布局 (Header + Footer + 响应式)
  ✅ 首页开发 (套餐列表 + 筛选 + 排序)
  

