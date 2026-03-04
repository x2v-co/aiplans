

# 🆚 Compare Plans — 核心对比功能设计

---

## 一、业务逻辑梳理

### 核心概念重新定义

```
对比逻辑：

用户选择一个模型 (如 Claude 3.5 Sonnet)
  → 展示所有提供该模型的渠道/平台的 Plan
  → 每个 Plan 的核心对比维度：
     ├── 💰 价格区间（月付 / 年付 / 按量）
     ├── 🔢 请求次数限制（RPM / 每日 / 每月）
     ├── ⚡ QPS（每秒查询数 / 并发限制）
     ├── 📦 Token 配额（每月 / 每次请求上限）
     ├── 🏷️ 年度订阅折扣（vs 月付节省多少）
     └── 🏛️ 官方 Plan 作为基准线（benchmark）

关键设计原则：
  1. 官方 Plan 永远置顶作为基准（Baseline）
  2. 第三方渠道标注 "比官方便宜 X%" 或 "比官方贵 X%"
  3. 年付折扣单独列出，计算真实月均成本
  4. 相同模型不同 Plan 之间可能有能力差异（限速/配额）
```

### 数据模型补充

```typescript
// ============================================
// schema/plans.ts — 补充字段
// ============================================
export const plans = pgTable('plans', {
  // ... 之前的字段 ...

  // === 新增：请求限制维度 ===
  
  // 请求次数限制
  requestsPerMinute: integer('requests_per_minute'),          // RPM
  requestsPerDay: integer('requests_per_day'),                // 每日请求上限
  requestsPerMonth: integer('requests_per_month'),            // 每月请求上限
  
  // QPS / 并发
  qps: integer('qps'),                                        // 每秒查询数
  concurrentRequests: integer('concurrent_requests'),          // 最大并发数
  
  // Token 配额
  tokensPerMinute: integer('tokens_per_minute'),              // TPM
  tokensPerDay: bigint('tokens_per_day', { mode: 'number' }),
  tokensPerMonth: bigint('tokens_per_month', { mode: 'number' }),
  maxTokensPerRequest: integer('max_tokens_per_request'),     // 单次请求最大 token
  maxInputTokens: integer('max_input_tokens'),
  maxOutputTokens: integer('max_output_tokens'),
  
  // === 新增：年付折扣 ===
  priceYearlyMonthly: decimal('price_yearly_monthly', { precision: 10, scale: 2 }),
    // 年付折算月价 (年费/12)
  yearlyDiscountPercent: decimal('yearly_discount_percent', { precision: 5, scale: 2 }),
    // 年付折扣率 (vs 月付)
  
  // === 新增：是否为官方 Plan ===
  isOfficial: boolean('is_official').default(false),
  
  // === 新增：Plan 等级（同渠道内的档位）===
  planTier: varchar('plan_tier', { length: 50 }),
    // "free" | "tier1" | "tier2" | "tier3" | "enterprise" | "pay_as_you_go"
  
  // === 新增：计费粒度 ===
  billingGranularity: varchar('billing_granularity', { length: 30 }),
    // "per_token" | "per_request" | "flat_monthly" | "flat_yearly" | "prepaid_pack"
  
  // === 新增：额外费用 ===
  hasOveragePricing: boolean('has_overage_pricing').default(false),
  overageInputPricePer1m: decimal('overage_input_price_per_1m', { precision: 10, scale: 4 }),
  overageOutputPricePer1m: decimal('overage_output_price_per_1m', { precision: 10, scale: 4 }),
});

// ============================================
// schema/model_plan_mapping.ts — 模型与Plan多对多关系
// ============================================
export const modelPlanMapping = pgTable('model_plan_mapping', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),  // 模型
  planId: uuid('plan_id').references(() => plans.id).notNull(),           // Plan
  
  // 该模型在此 Plan 下的特殊限制（可能和 Plan 默认值不同）
  overrideRpm: integer('override_rpm'),
  overrideQps: integer('override_qps'),
  overrideInputPricePer1m: decimal('override_input_price_per_1m', { precision: 10, scale: 4 }),
  overrideOutputPricePer1m: decimal('override_output_price_per_1m', { precision: 10, scale: 4 }),
  overrideMaxOutputTokens: integer('override_max_output_tokens'),
  
  isAvailable: boolean('is_available').default(true),
  note: varchar('note', { length: 500 }),  // 特殊说明
}, (table) => ({
  uniqueModelPlan: unique().on(table.productId, table.planId),
}));
```

---

## 二、API 设计

```typescript
// ============================================
// GET /api/compare/plans?model={modelSlug}
// 核心对比 API
// ============================================

interface ComparePlansQuery {
  model: string;                    // 必填：模型 slug，如 "claude-3.5-sonnet"
  region?: 'all' | 'global' | 'china';
  billingType?: 'all' | 'subscription' | 'pay_as_you_go' | 'prepaid';
  showYearly?: boolean;            // 是否展示年付方案
  sortBy?: 'price_asc' | 'price_desc' | 'rpm_desc' | 'qps_desc' | 'value';
  usageEstimate?: {                // 可选：用户预估用量（用于计算实际成本）
    monthlyRequests?: number;
    avgInputTokens?: number;
    avgOutputTokens?: number;
  };
}

interface ComparePlansResponse {
  model: {
    slug: string;
    name: string;
    provider: {
      slug: string;
      name: string;
      logo: string;
    };
    contextWindow: number;
    maxOutput: number;
    benchmarkArena: number;
    releaseDate: string;
  };

  // 官方 Plan（基准线）
  officialPlans: PlanComparison[];

  // 第三方渠道 Plan
  thirdPartyPlans: PlanComparison[];

  // 汇总统计
  summary: {
    totalPlans: number;
    cheapestPlan: { name: string; channel: string; effectiveMonthly: number };
    bestRpmPlan: { name: string; channel: string; rpm: number };
    bestQpsPlan: { name: string; channel: string; qps: number };
    officialPrice: { inputPer1m: number; outputPer1m: number };
  };
}

interface PlanComparison {
  plan: {
    id: string;
    slug: string;
    name: string;           // "Tier 2 - 按量计费"
    nameZh: string;
    planTier: string;       // "tier2"
    isOfficial: boolean;
  };
  
  channel: {
    slug: string;
    name: string;           // "OpenRouter" / "硅基流动" / "OpenAI (Official)"
    nameZh: string;
    logo: string;
    region: string;
    accessFromChina: boolean;
    paymentMethods: string[];
  };

  // 💰 价格
  pricing: {
    billingModel: string;                 // "subscription" | "pay_as_you_go" | "prepaid_pack"
    
    // 订阅类
    monthly: number | null;               // 月付价格 (USD)
    yearly: number | null;                // 年付总价 (USD)
    yearlyMonthly: number | null;         // 年付折算月价
    yearlyDiscountPercent: number | null;  // 年付折扣 %
    currency: string;
    
    // 本地货币
    monthlyLocal: number | null;
    yearlyLocal: number | null;
    yearlyMonthlyLocal: number | null;
    currencyLocal: string | null;
    
    // Token 计费
    inputPer1m: number | null;
    outputPer1m: number | null;
    cachedInputPer1m: number | null;
    
    // 超额计费
    hasOverage: boolean;
    overageInputPer1m: number | null;
    overageOutputPer1m: number | null;
    
    // 预付费包
    prepaidPackSize: number | null;       // token 数量
    prepaidPackPrice: number | null;
  };

  // 🔢 请求限制
  limits: {
    rpm: number | null;                   // Requests Per Minute
    rpd: number | null;                   // Requests Per Day
    rpm_display: string;                  // "60 RPM" / "无限制"
    
    tpm: number | null;                   // Tokens Per Minute
    tpd: number | null;                   // Tokens Per Day
    tpm_display: string;
    
    monthlyRequests: number | null;
    monthlyTokens: number | null;
    maxTokensPerRequest: number | null;
    maxInputTokens: number | null;
    maxOutputTokens: number | null;
  };

  // ⚡ QPS / 并发
  performance: {
    qps: number | null;
    concurrentRequests: number | null;
    qps_display: string;                  // "10 QPS" / "不限"
  };

  // 📊 对比官方的差异
  vsOfficial: {
    priceDiffPercent: number | null;      // -20 表示比官方便宜 20%
    priceDiffLabel: string;               // "比官方便宜 20%" / "官方价格"
    rpmDiffPercent: number | null;
    qpsDiffPercent: number | null;
  };

  // 🧮 用户自定义用量下的预估成本（如果传了 usageEstimate）
  estimatedCost?: {
    monthlyCost: number;
    currency: string;
    breakdown: {
      subscription: number;
      tokenUsage: number;
      overage: number;
      total: number;
    };
    isWithinLimits: boolean;              // 是否在 Plan 限制内
    limitWarnings: string[];              // ["月请求数超出限制", ...]
  };

  // 元信息
  lastVerified: string;
  sourceUrl: string;
  note: string | null;
}
```

---

## 三、页面设计

### 页面入口路径

```
/compare/plans                              → 选择模型页面
/compare/plans/claude-3.5-sonnet            → Claude 3.5 Sonnet 全渠道 Plan 对比
/compare/plans/gpt-4o                       → GPT-4o 全渠道 Plan 对比
/compare/plans/deepseek-v3                  → DeepSeek V3 全渠道 Plan 对比
```

### 页面 1：模型选择入口 — `/compare/plans`

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai  /  Compare Plans                                  │
│                                                                      │
│  nav: [首页] [套餐比价] [API价格] [▶对比Plans◀] [优惠码] [计算器]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🆚 选择一个模型，对比全网 Plan                                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ 🔍  搜索模型名称... (如 "Claude Sonnet", "GPT-4o")         │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ── 🔥 热门模型 ──────────────────────────────────────────────       │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  [GPT-4o]   │ │[Claude 3.5  │ │[DeepSeek V3]│ │[Gemini 1.5  │   │
│  │  OpenAI     │ │  Sonnet]    │ │  DeepSeek   │ │  Pro]       │   │
│  │  Arena 1287 │ │ Anthropic   │ │  Arena 1253 │ │  Google     │   │
│  │  8 个 Plan  │ │ Arena 1271  │ │  12 个 Plan │ │  Arena 1260 │   │
│  │  ≥$2.5/1M   │ │ 6 个 Plan   │ │  ≥$0.27/1M  │ │  5 个 Plan  │   │
│  │  [对比 →]   │ │  [对比 →]   │ │  [对比 →]   │ │  [对比 →]   │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │[Claude 3    │ │[GPT-4o      │ │[Llama 3.1   │ │[通义千问     │   │
│  │  Opus]      │ │  mini]      │ │  405B]      │ │  Max]       │   │
│  │  Anthropic  │ │  OpenAI     │ │  Meta       │ │  阿里       │   │
│  │  4 个 Plan  │ │  10 个 Plan │ │  8 个 Plan  │ │  3 个 Plan  │   │
│  │  [对比 →]   │ │  [对比 →]   │ │  [对比 →]   │ │  [对比 →]   │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
│  ── 按供应商浏览 ─────────────────────────────────────────────       │
│  [OpenAI] [Anthropic] [Google] [Meta] [DeepSeek] [阿里] [百度] ...  │
│                                                                      │
│  ── 按能力排行 ───────────────────────────────────────────────       │
│  [Arena 排名↓] [上下文最长] [最便宜] [国内可用]                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 页面 2：核心对比页 — `/compare/plans/claude-3.5-sonnet`

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 PlanPrice.ai  /  Compare Plans  /  Claude 3.5 Sonnet                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ 模型信息卡 ───────────────────────────────────────────────────┐     │
│  │                                                                 │     │
│  │  [Anthropic Logo]  Claude 3.5 Sonnet                           │     │
│  │                                                                 │     │
│  │  供应商: Anthropic    上下文: 200K tokens   最大输出: 8,192     │     │
│  │  Arena: 1271          发布: 2024-06-20      状态: ✅ Active     │     │
│  │                                                                 │     │
│  │  全网共 8 个 Plan 提供此模型 · 最低 $0.30/百万输入token          │     │
│  │                                                                 │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ── ⚙️ 筛选 & 设置 ──────────────────────────────────────────────       │
│                                                                          │
│  地区: [全部] [🌍国际] [🇨🇳国内]     计费: [全部] [订阅] [按量] [预付]   │
│  排序: [💰价格↑] [💰价格↓] [🔢RPM↓] [⚡QPS↓] [📊性价比]               │
│  币种: [USD $] [CNY ¥]              年付: [✅ 显示年付折扣]              │
│                                                                          │
│  ── 📊 我的用量预估（可选，更精准对比）──────────────────────────         │
│  │ 月请求数: [10,000] │ 平均输入token: [1,000] │ 平均输出token: [500] │  │
│  └──────────────────── [🔄 重新计算] ─────────────────────────────       │
│                                                                          │
│                                                                          │
│ ═══════════════════════════════════════════════════════════════════       │
│                       对比结果表格                                         │
│ ═══════════════════════════════════════════════════════════════════       │
│                                                                          │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │                                                                    │   │
│ │  ┌─ 🏛️ 官方基准 (BASELINE) ────────────────────────────────────┐  │   │
│ │  │                                                              │  │   │
│ │  │  ┌────────────┬──────────┬──────────┬────────┬──────────┐   │  │   │
│ │  │  │  渠道/Plan  │ 💰 价格   │ 🔢 请求   │ ⚡ QPS │ 📦 Token │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ Anthropic  │ 输入:    │ RPM: 50  │ QPS: 5 │ TPM:     │   │  │   │
│ │  │  │ API        │ $3.00/1M │ RPD: 无限│        │ 40,000   │   │  │   │
│ │  │  │ (官方)     │ 输出:    │ 月: 无限 │并发: 5 │ 单次:    │   │  │   │
│ │  │  │ 🏛️ 基准    │ $15.00/1M│          │        │ 8,192出  │   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │  按量计费   │ 无订阅费  │          │        │          │   │  │   │
│ │  │  │  Visa/MC   │          │          │        │          │   │  │   │
│ │  │  │            │ 📊预估月费│          │        │          │   │  │   │
│ │  │  │            │ $45.00   │          │        │          │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ Anthropic  │ 月付:    │ RPM: 100 │QPS: 10 │ TPM:     │   │  │   │
│ │  │  │ Build Plan │ $25/月   │ RPD: 无限│        │ 80,000   │   │  │   │
│ │  │  │ (官方订阅)  │ 年付:    │ 月: 无限 │并发:10 │ 单次:    │   │  │   │
│ │  │  │ 🏛️ 基准    │ $20.83/月│          │        │ 8,192出  │   │  │   │
│ │  │  │            │ ════════ │          │        │          │   │  │   │
│ │  │  │            │ 🏷️年付省 │          │        │          │   │  │   │
│ │  │  │            │  17%     │          │        │          │   │  │   │
│ │  │  │  Visa/MC   │ ($250/年)│          │        │          │   │  │   │
│ │  │  │            │ +按量Token│          │        │          │   │  │   │
│ │  │  │            │ 输入$2.50│          │        │          │   │  │   │
│ │  │  │            │ 输出$12.5│          │        │          │   │  │   │
│ │  │  │            │ 📊预估月费│          │        │          │   │  │   │
│ │  │  │            │ $58.33   │          │        │          │   │  │   │
│ │  │  └────────────┴──────────┴──────────┴────────┴──────────┘   │  │   │
│ │  │                                                              │  │   │
│ │  └──────────────────────────────────────────────────────────────┘  │   │
│ │                                                                    │   │
│ │                                                                    │   │
│ │  ┌─ 🌍 第三方渠道 ─────────────────────────────────────────────┐  │   │
│ │  │                                                              │  │   │
│ │  │  ┌────────────┬──────────┬──────────┬────────┬──────────┐   │  │   │
│ │  │  │  渠道/Plan  │ 💰 价格   │ 🔢 请求   │ ⚡ QPS │ 📦 Token │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ AWS        │ 输入:    │ RPM: 100 │QPS: 10 │ TPM:     │   │  │   │
│ │  │  │ Bedrock    │ $3.00/1M │ RPD: 无限│        │ 100,000  │   │  │   │
│ │  │  │ 🌍         │ 输出:    │ 月: 无限 │并发:10 │ 单次:    │   │  │   │
│ │  │  │            │ $15.00/1M│          │        │ 8,192出  │   │  │   │
│ │  │  │  按量计费   │          │          │        │          │   │  │   │
│ │  │  │            │ vs官方:  │ vs官方:  │vs官方: │          │   │  │   │
│ │  │  │            │ 持平 =   │ RPM +100%│QPS+100%│          │   │  │   │
│ │  │  │            │ 📊$45.00 │          │        │          │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ OpenRouter │ 输入:    │ RPM: 200 │QPS: 20 │ TPM:     │   │  │   │
│ │  │  │ Free Tier  │ $3.30/1M │ RPD: 1000│        │ 无限     │   │  │   │
│ │  │  │ 🌍         │ 输出:    │ 月:30000 │并发:20 │ 单次:    │   │  │   │
│ │  │  │            │$16.50/1M │          │        │ 8,192出  │   │  │   │
│ │  │  │  按量计费   │          │          │        │          │   │  │   │
│ │  │  │            │ vs官方:  │ vs官方:  │vs官方: │          │   │  │   │
│ │  │  │            │ 贵10% ↑  │ RPM +300%│QPS+300%│          │   │  │   │
│ │  │  │            │ 📊$49.50 │          │        │          │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ OpenRouter │ 月付:    │ RPM: 500 │QPS: 50 │ TPM:     │   │  │   │
│ │  │  │ Pro Plan   │ $20/月   │ RPD: 无限│        │ 无限     │   │  │   │
│ │  │  │ 🌍         │ 年付:    │ 月: 无限 │并发:50 │ 单次:    │   │  │   │
│ │  │  │            │$16.67/月 │          │        │ 8,192出  │   │  │   │
│ │  │  │            │ ════════ │          │        │          │   │  │   │
│ │  │  │            │ 🏷️年付省 │          │        │          │   │  │   │
│ │  │  │            │  17%     │          │        │          │   │  │   │
│ │  │  │  Visa/支付宝│ ($200/年)│          │        │          │   │  │   │
│ │  │  │            │ +按量:   │          │        │          │   │  │   │
│ │  │  │            │ 输入$2.64│          │        │          │   │  │   │
│ │  │  │            │ 输出$13.2│          │        │          │   │  │   │
│ │  │  │            │ vs官方:  │ vs官方:  │vs官方: │          │   │  │   │
│ │  │  │            │便宜12% ↓ │ RPM +900%│QPS+900%│          │   │  │   │
│ │  │  │            │ 📊$53.17 │          │        │          │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ 🇨🇳 硅基流动│ 输入:    │ RPM: 60  │ QPS: 5 │ TPM:     │   │  │   │
│ │  │  │ 按量计费    │ ¥15/1M   │ RPD: 无限│        │ 50,000   │   │  │   │
│ │  │  │ 🇨🇳 国内直连│ ($2.06)  │ 月: 无限 │并发: 5 │ 单次:    │   │  │   │
│ │  │  │            │ 输出:    │          │        │ 8,192出  │   │  │   │
│ │  │  │  支付宝/微信│ ¥75/1M   │          │        │          │   │  │   │
│ │  │  │            │ ($10.34) │          │        │          │   │  │   │
│ │  │  │ ✅国内直连  │ vs官方:  │ vs官方:  │vs官方: │          │   │  │   │
│ │  │  │ ✅支付宝   │便宜31% ↓ │ RPM +20% │持平 =  │          │   │  │   │
│ │  │  │ ⭐ 最低价  │ 📊$31.05 │          │        │          │   │  │   │
│ │  │  ├────────────┼──────────┼──────────┼────────┼──────────┤   │  │   │
│ │  │  │            │          │          │        │          │   │  │   │
│ │  │  │ 🇨🇳 火山引擎│ 月付:    │ RPM: 120 │QPS: 10 │ TPM:     │   │  │   │
│ │  │  │ Tier 1     │ ¥99/月   │ RPD: 无限│        │ 100,000  │   │  │   │
│ │  │  │            │ ($13.62) │ 月: 无限 │并发:10 │ 单次:    │   │  │   │
│ │  │  │            │ 年付:    │          │        │ 8,192出  │   │  │   │
│ │  │  │            │ ¥79/月   │          │        │          │   │  │   │
│ │  │  │            │ ($10.87) │          │        │          │   │  │   │
│ │  │  │            │ ════════ │          │        │          │   │  │   │
│ │  │  │            │ 🏷️年付省 │          │        │          │   │  │   │
│ │  │  │  支付宝/微信│  20%     │          │        │          │   │  │   │
│ │  │  │ ✅国内直连  │ (¥948/年)│          │        │          │   │  │   │
│ │  │  │            │含50M免费  │          │        │          │   │  │   │
│ │  │  │            │ token/月  │          │        │          │   │  │   │
│ │  │  │            │ 超额:    │          │        │          │   │  │   │
│ │  │  │            │ 入¥12/1M │          │        │          │   │  │   │
│ │  │  │            │ 出¥60/1M │          │        │          │   │  │   │
│ │  │  │            │ vs官方:  │ vs官方:  │vs官方: │          │   │  │   │
│ │  │  │            │便宜46% ↓ │ RPM +140%│QPS+100%│          │   │  │   │
│ │  │  │            │ 📊$10.87 │          │        │          │   │  │   │
│ │  │  │            │ +超额另计│          │        │          │   │  │   │
│ │  │  └────────────┴──────────┴──────────┴────────┴──────────┘   │  │   │
│ │  │                                                              │  │   │
│ │  └──────────────────────────────────────────────────────────────┘  │   │
│ │                                                                    │   │
│ └────────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                                                          │
│ ═══════════════════════════════════════════════════════════════════       │
│                       可视化辅助区域                                       │
│ ═══════════════════════════════════════════════════════════════════       │
│                                                                          │
│  ── 📊 价格分布图 ─────────────────────────────────────────────          │
│                                                                          │
│  输出价格 ($/百万token)                                                   │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │                                                          │           │
│  │  $16 ─ ·OpenRouter Free                                  │           │
│  │  $15 ─ ★Anthropic官方 ─────────── 基准线 ──── ·AWS      │           │
│  │  $13 ─ ·OpenRouter Pro                                   │           │
│  │  $12 ─                                                   │           │
│  │  $10 ─ ·硅基流动 ⭐                                       │           │
│  │   $8 ─                                                   │           │
│  │   $6 ─ ·火山引擎 T1 ⭐⭐                                  │           │
│  │       ────────────────────────────────────────            │           │
│  │        0    100   200   300   400   500  RPM             │           │
│  │                                                          │           │
│  │  ⭐ = 国内可用   ★ = 官方   气泡大小 = QPS                │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│                                                                          │
│  ── 💡 智能推荐 ─────────────────────────────────────────────            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  基于你的预估用量 (10,000 请求/月, 1000入+500出 token/次)：      │    │
│  │                                                                 │    │
│  │  🏆 性价比之王：火山引擎 Tier 1 (年付)                            │    │
│  │     月费 ¥79 ≈ $10.87 · 50M 免费 token 覆盖你的用量              │    │
│  │     实际 token 用量: 15M/月 → 完全在免费额度内                    │    │
│  │     ✅ 国内直连 · ✅ 支付宝 · RPM 120 足够                       │    │
│  │                                                                 │    │
│  │  💰 最低价格：硅基流动 (按量)                                     │    │
│  │     预估月费 ¥31 ≈ $4.27 · 无订阅费，用多少付多少                 │    │
│  │     ✅ 国内直连 · ✅ 支付宝 · ⚠️ RPM 60 (高峰可能不够)           │    │
│  │                                                                 │    │
│  │  🌍 海外最佳：AWS Bedrock (按量)                                  │    │
│  │     预估月费 $45.00 · 与官方同价但 RPM/QPS 翻倍                   │    │
│  │     ⚠️ 需科学上网 · 需 AWS 账号                                   │    │
│  │                                                                 │    │
│  │  🏛️ 官方方案：Anthropic API (按量)                               │    │
│  │     预估月费 $45.00 · 最稳定，最新模型第一时间可用                  │    │
│  │     ⚠️ 需科学上网 · RPM 50 / QPS 5                               │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                                                                          │
│  ── 🏷️ 年付折扣汇总 ────────────────────────────────────────            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  渠道              │ 月付     │ 年付/月   │ 折扣  │ 年省   │           │
│  ├──────────────────────────────────────────────────────────┤           │
│  │  Anthropic Build   │ $25/月   │ $20.83/月 │ 17%  │ $50   │           │
│  │  OpenRouter Pro    │ $20/月   │ $16.67/月 │ 17%  │ $40   │           │
│  │  火山引擎 Tier 1   │ ¥99/月   │ ¥79/月    │ 20%  │ ¥240  │           │
│  │                    │          │           │      │       │           │
│  │  💡 火山引擎年付折扣最大 (20%)，且含免费 token 额度        │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│                                                                          │
│  ── 🎫 相关优惠码 ───────────────────────────────────────────            │
│                                                                          │
│  🎫 SILICON20  硅基流动新用户送200万token  [复制] ✅已验证               │
│  🎫 VOLC50     火山引擎首充 ¥100 送 ¥50   [复制] ✅已验证               │
│  🎫 ORPRO10    OpenRouter Pro 首月9折     [复制] ⏳待验证               │
│                                                                          │
│  ── 📝 说明 ─────────────────────────────────────────────────            │
│                                                                          │
│  · 价格最后更新: 2026-02-26 14:30 UTC                                    │
│  · 汇率: 1 USD = 7.26 CNY (实时)                                        │
│  · "预估月费" 基于你填写的用量预估计算                                     │
│  · 实际费用可能因用量波动、缓存命中率等因素有所不同                          │
│  · 数据来源: 各平台官方定价页面 [查看来源链接]                              │
│  · 发现价格错误？[📮 反馈纠错]                                            │
│                                                                          │
│  [📤 分享此对比] [📥 导出 CSV] [🔔 价格变动提醒]                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  PlanPrice.ai — 全网 AI Plan 比价                                        │
│  [关于] [API] [博客] [联系] [Twitter] [GitHub]                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 四、交互细节设计

### 核心交互流程

```
用户旅程：

1. 入口
   ├── 首页搜索 "Claude Sonnet" → 跳转对比页
   ├── API 价格表 → 点击某模型 "对比全部 Plan" → 跳转对比页
   ├── SEO 直达：Google 搜 "Claude Sonnet pricing compare" → 对比页
   └── 直接 URL: planprice.ai/compare/plans/claude-3.5-sonnet

2. 对比页
   ├── 默认按价格升序排列
   ├── 官方 Plan 置顶（灰底高亮）带 "🏛️ 基准" 标签
   ├── 第三方 Plan 自动计算 vs 官方差异
   ├── 用户可选填"我的用量" → 实时计算每个 Plan 的预估月费
   └── 表格 + 散点图 + 推荐 三种视图

3. 决策
   ├── 查看推荐方案
   ├── 点击 "购买" → 跳转渠道官网（走 affiliate 链接）
   ├── 复制优惠码
   ├── 设置价格警报
   └── 分享对比结果
```

### 响应式设计

```
桌面端 (≥1024px):
  - 完整表格视图，所有列可见
  - 散点图展示在表格下方
  - 侧边栏显示筛选面板

平板端 (768-1023px):
  - 表格横向可滚动
  - 筛选面板折叠为下拉菜单
  - 散点图缩小

移动端 (<768px):
  - 切换为卡片视图（每个 Plan 一张卡片，竖向排列）
  - 筛选面板为底部弹窗
  - 隐藏散点图，仅保留推荐
  - 价格对比用进度条可视化
```

### 移动端卡片视图

```
┌─────────────────────────────┐
│ 🏛️ Anthropic API (官方基准)  │
│ ─────────────────────────── │
│ 💰 按量计费                  │
│    输入: $3.00/百万token     │
│    输出: $15.00/百万token    │
│    📊 预估月费: $45.00       │
│ ─────────────────────────── │
│ 🔢 RPM: 50 │ ⚡ QPS: 5     │
│ 📦 TPM: 40K │ 单次出: 8192  │
│ ─────────────────────────── │
│ 🌍 需科学上网 · Visa/MC     │
│              [查看详情 →]    │
└─────────────────────────────┘
        ⬇️ vs 官方

┌─────────────────────────────┐
│ ⭐ 硅基流动 (最低价)          │
│ ─────────────────────────── │
│ 💰 按量计费                  │
│    输入: ¥15/百万 ($2.06)   │
│    输出: ¥75/百万 ($10.34)  │
│    📊 预估月费: ¥225 ($31)  │
│    🟢 比官方便宜 31%         │
│ ─────────────────────────── │
│ 🔢 RPM: 60  │ ⚡ QPS: 5    │
│    RPM +20%  │   持平       │
│ 📦 TPM: 50K │ 单次出: 8192  │
│ ─────────────────────────── │
│ 🇨🇳 国内直连 · 支付宝/微信   │
│              [查看详情 →]    │
└─────────────────────────────┘
```

---

## 五、组件拆分

```typescript
// ============================================
// 对比页核心组件树
// ============================================

// app/compare/plans/[model]/page.tsx
<CompareLayout>
  <ModelInfoCard model={model} />
  
  <CompareFilters 
    region={region}
    billingType={billingType}
    sortBy={sortBy}
    currency={currency}
    showYearly={showYearly}
  />
  
  <UsageEstimator
    monthlyRequests={est.requests}
    avgInputTokens={est.input}
    avgOutputTokens={est.output}
    onEstimateChange={handleEstimateChange}
  />
  
  {/* 桌面端: 表格 | 移动端: 卡片 */}
  <CompareTable 
    officialPlans={officialPlans}
    thirdPartyPlans={thirdPartyPlans}
    currency={currency}
    usageEstimate={estimate}
    showYearly={showYearly}
  />
  
  {/* 仅桌面端 */}
  <PriceScatterChart 
    plans={allPlans}
    xAxis="rpm"
    yAxis="outputPricePer1m"
  />
  
  <SmartRecommendation
    plans={allPlans}
    usageEstimate={estimate}
    region={region}
  />
  
  <YearlyDiscountSummary 
    plans={plansWithYearly}
    currency={currency}
  />
  
  <RelatedCoupons 
    model={model}
    channels={channels}
  />
  
  <CompareFooter
    lastUpdated={lastUpdated}
    exchangeRate={rate}
    sources={sources}
  />
</CompareLayout>


// ============================================
// 关键子组件
// ============================================

// CompareTable 内部
<CompareTable>
  {/* 官方 Plan 区域 */}
  <TableSection title="🏛️ 官方基准 (BASELINE)" highlighted>
    {officialPlans.map(plan => (
      <PlanRow 
        plan={plan} 
        isBaseline={true}
        currency={currency}
        usageEstimate={estimate}
        showYearly={showYearly}
      />
    ))}
  </TableSection>
  
  {/* 第三方渠道区域 */}
  <TableSection title="🌍 第三方渠道">
    {thirdPartyPlans.map(plan => (
      <PlanRow 
        plan={plan}
        isBaseline={false}
        baselinePlan={officialBaseline}
        currency={currency}
        usageEstimate={estimate}
        showYearly={showYearly}
      />
    ))}
  </TableSection>
</CompareTable>

// PlanRow 内部
<PlanRow>
  <ChannelCell channel={plan.channel} />
  <PriceCell 
    pricing={plan.pricing} 
    currency={currency}
    showYearly={showYearly}
    estimatedCost={plan.estimatedCost}
  />
  <RequestLimitCell limits={plan.limits} vsOfficial={plan.vsOfficial} />
  <QpsCell performance={plan.performance} vsOfficial={plan.vsOfficial} />
  <TokenCell limits={plan.limits} />
</PlanRow>

// PriceCell — 最复杂的单元格
<PriceCell>
  {/* 按量计费 */}
  {pricing.billingModel === 'pay_as_you_go' && (
    <>
      <div>输入: {formatPrice(pricing.inputPer1m, currency)}/1M</div>
      <div>输出: {formatPrice(pricing.outputPer1m, currency)}/1M</div>
    </>
  )}
  
  {/* 订阅计费 */}
  {pricing.billingModel === 'subscription' && (
    <>
      <div>月付: {formatPrice(pricing.monthly, currency)}/月</div>
      {showYearly && pricing.yearly && (
        <YearlyDiscount 
          monthly={pricing.monthly}
          yearlyMonthly={pricing.yearlyMonthly}
          discountPercent={pricing.yearlyDiscountPercent}
          currency={currency}
        />
      )}
      {pricing.inputPer1m && (
        <div className="text-sm text-muted">
          + 按量: 入{formatPrice(pricing.inputPer1m)}/1M 
          出{formatPrice(pricing.outputPer1m)}/1M
        </div>
      )}
    </>
  )}
  
  {/* 预估月费 */}
  {estimatedCost && (
    <EstimatedCostBadge cost={estimatedCost} />
  )}
  
  {/* vs 官方 */}
  {!isBaseline && (
    <VsOfficialBadge diff={vsOfficial.priceDiffPercent} />
  )}
</PriceCell>

// VsOfficialBadge
<VsOfficialBadge>
  {diff < 0 && <span className="text-green-600">🟢 比官方便宜 {Math.abs(diff)}%</span>}
  {diff > 0 && <span className="text-red-500">🔴 比官方贵 {diff}%</span>}
  {diff === 0 && <span className="text-gray-500">= 与官方持平</span>}
</VsOfficialBadge>

// YearlyDiscount
<YearlyDiscount>
  <div className="border-t border-dashed mt-1 pt-1">
    <span className="text-green-600 font-medium">
      🏷️ 年付省 {discountPercent}%
    </span>
    <div>年付: {formatPrice(yearlyMonthly, currency)}/月</div>
    <div className="text-xs text-muted">
      ({formatPrice(yearlyMonthly * 12, currency)}/年)
    </div>
  </div>
</YearlyDiscount>
```

---

## 六、SEO 策略（对比页专属）

```typescript
// app/compare/plans/[model]/page.tsx

export async function generateMetadata({ params }): Promise<Metadata> {
  const model = await getModel(params.model);
  const planCount = await getPlanCount(params.model);
  const cheapest = await getCheapestPlan(params.model);
  
  return {
    title: `${model.name} 全网 Plan 对比 — ${planCount} 个方案横评 | PlanPrice.ai`,
    description: `对比 ${model.name} 在 ${planCount} 个平台的价格、请求限制、QPS。最低 $${cheapest.price}/百万token。含官方和第三方渠道（硅基流动、OpenRouter、AWS Bedrock等），年付折扣汇总。`,
    openGraph: {
      title: `${model.name} — ${planCount} 个 Plan 谁最划算？`,
      description: `官方 vs 第三方，价格差最高 ${cheapest.savingsPercent}%`,
      images: [`/api/og/compare/${params.model}`], // 动态生成 OG 图
    },
    alternates: {
      canonical: `https://planprice.ai/compare/plans/${params.model}`,
    },
  };
}

// 自动生成所有模型的对比页（SSG）
export async function generateStaticParams() {
  const models = await getAllModelsWithPlans();
  return models.map(m => ({ model: m.slug }));
}

// Schema 结构化数据
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": `${model.name} Plan Comparison`,
  "description": "...",
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": planCount,
    "itemListElement": plans.map((plan, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Offer",
        "name": `${plan.channel.name} - ${plan.plan.name}`,
        "price": plan.pricing.monthly || plan.pricing.inputPer1m,
        "priceCurrency": plan.pricing.currency,
        "seller": {
          "@type": "Organization",
          "name": plan.channel.name,
        },
      },
    })),
  },
};
```

### 对比页 SEO 关键词覆盖

```
每个模型自动生成的对比页能命中的搜索词：

/compare/plans/claude-3.5-sonnet
├── "claude 3.5 sonnet pricing"
├── "claude 3.5 sonnet api 价格"
├── "claude sonnet 各平台价格对比"
├── "claude sonnet openrouter vs 官方"
├── "claude sonnet 国内怎么用"
├── "claude sonnet 最便宜"
└── "claude sonnet api plan comparison"

/compare/plans/gpt-4o
├── "gpt-4o api pricing"
├── "gpt-4o 各渠道价格"
├── "gpt-4o azure vs openai 价格"
└── ...

预计可自动生成 50-100 个高质量对比页
→ 每个页面覆盖 5-10 个长尾关键词
→ 总计覆盖 250-1000 个搜索词
```

---

## 七、数据样例

```json
// data/seed/compare-claude-sonnet.json
// 用于种子数据和测试

{
  "model": {
    "slug": "claude-3.5-sonnet",
    "name": "Claude 3.5 Sonnet",
    "provider": "anthropic",
    "contextWindow": 200000,
    "maxOutput": 8192,
    "benchmarkArena": 1271
  },
  "plans": [
    {
      "channel": "Anthropic (Official)",
      "isOfficial": true,
      "planName": "API Pay-as-you-go",
      "billingModel": "pay_as_you_go",
      "pricing": {
        "inputPer1m": 3.00,
        "outputPer1m": 15.00,
        "cachedInputPer1m": 0.30,
        "currency": "USD"
      },
      "limits": {
        "rpm": 50,
        "rpd": null,
        "tpm": 40000,
        "monthlyRequests": null,
        "maxOutputTokens": 8192
      },
      "qps": 5,
      "concurrentRequests": 5
    },
    {
      "channel": "Anthropic (Official)",
      "isOfficial": true,
      "planName": "Build Plan",
      "billingModel": "subscription",
      "pricing": {
        "monthly": 25.00,
        "yearly": 250.00,
        "yearlyMonthly": 20.83,
        "yearlyDiscountPercent": 16.68,
        "currency": "USD",
        "inputPer1m": 2.50,
        "outputPer1m": 12.50
      },
      "limits": {
        "rpm": 100,
        "rpd": null,
        "tpm": 80000,
        "maxOutputTokens": 8192
      },
      "qps": 10,
      "concurrentRequests": 10
    },
    {
      "channel": "AWS Bedrock",
      "isOfficial": false,
      "planName": "On-Demand",
      "billingModel": "pay_as_you_go",
      "pricing": {
        "inputPer1m": 3.00,
        "outputPer1m": 15.00,
        "currency": "USD"
      },
      "limits": {
        "rpm": 100,
        "tpm": 100000,
        "maxOutputTokens": 8192
      },
      "qps": 10,
      "concurrentRequests": 10,
      "vsOfficial": {
        "priceDiff": 0,
        "rpmDiff": 100,
        "qpsDiff": 100
      }
    },
    {
      "channel": "硅基流动",
      "isOfficial": false,
      "region": "china",
      "accessFromChina": true,
      "paymentMethods": ["alipay", "wechat"],
      "planName": "按量计费",
      "billingModel": "pay_as_you_go",
      "pricing": {
        "inputPer1m": null,
        "outputPer1m": null,
        "inputPer1mLocal": 15.00,
        "outputPer1mLocal": 75.00,
        "currencyLocal": "CNY"
      },
      "limits": {
        "rpm": 60,
        "tpm": 50000,
        "maxOutputTokens": 8192
      },
      "qps": 5,
      "concurrentRequests": 5,
      "vsOfficial": {
        "priceDiff": -31,
        "rpmDiff": 20,
        "qpsDiff": 0
      }
    },
    {
      "channel": "火山引擎",
      "isOfficial": false,
      "region": "china",
      "accessFromChina": true,
      "paymentMethods": ["alipay", "wechat"],
      "planName": "Tier 1 订阅",
      "billingModel": "subscription",
      "pricing": {
        "monthlyLocal": 99.00,
        "yearlyLocal": 948.00,
        "yearlyMonthlyLocal": 79.00,
        "yearlyDiscountPercent": 20.20,
        "currencyLocal": "CNY",
        "includedTokens": 50

