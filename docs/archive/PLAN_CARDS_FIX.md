# ✅ Models 页面 Plan Cards 显示问题修复

> 完成时间：2026-02-27
> 状态：✅ 已修复并测试通过

---

## 🐛 问题描述

用户报告：访问 `http://localhost:3000/en/models/claude-opus-4-6` 时没有显示 plan cards。

### 根本原因

有两个独立的问题：

1. **数据库 `models` 字段缺失**：
   - `plans` 表的 `models` 字段为 `null`
   - 导致过滤逻辑无法匹配包含该模型的计划

2. **数据库查询错误**：
   - 尝试 join `plans` 和 `providers` 表
   - 但数据库中没有这个外键关系
   - 导致查询失败，`plansData` 为 `undefined`

---

## ✅ 解决方案

### 问题 1：添加 `models` 字段支持

#### 1. 更新 `scripts/db/queries.ts`

在 `upsertPlan` 函数中添加 `models` 字段：

```typescript
export async function upsertPlan(data: {
  provider_id: number;
  name: string;
  slug: string;
  pricing_model: string;
  tier: string;
  price_monthly: number;
  price_yearly?: number;
  daily_message_limit?: number;
  requests_per_minute?: number;
  features?: string[];
  models?: string[];  // ✅ 新增
  region?: string;
  access_from_china?: boolean;
  payment_methods?: string[];
  is_official: boolean;
  last_verified: Date;
}) {
  const dbData = {
    provider_id: data.provider_id,
    name: data.name,
    slug: data.slug,
    pricing_model: data.pricing_model,
    tier: data.tier,
    price: data.price_monthly,
    annual_price: data.price_yearly,
    daily_message_limit: data.daily_message_limit,
    requests_per_minute: data.requests_per_minute,
    features: data.features,
    models: data.models,  // ✅ 新增
    region: data.region,
    access_from_china: data.access_from_china,
    payment_methods: data.payment_methods,
    is_official: data.is_official,
    last_verified: data.last_verified,
  };
  // ...
}
```

#### 2. 更新 `scripts/index.ts`

在调用 `upsertPlan` 时传递 `models`：

```typescript
await upsertPlan({
  provider_id: providerId,
  name: plan.planName,
  slug: plan.planSlug,
  pricing_model: plan.pricingModel,
  tier: plan.tier,
  price_monthly: plan.priceMonthly,
  price_yearly: plan.priceYearly,
  daily_message_limit: plan.dailyMessageLimit,
  requests_per_minute: plan.requestsPerMinute,
  features: plan.features,
  models: plan.models,  // ✅ 新增
  region: plan.region,
  access_from_china: plan.accessFromChina,
  payment_methods: plan.paymentMethods,
  is_official: plan.isOfficial,
  last_verified: new Date(),
});
```

#### 3. 重新运行抓取器

```bash
npm run scrape
```

**结果**：
```
✅ Anthropic-Plan Plan: Updated 4 plans, 0 errors
```

**验证**：
```bash
curl 'http://localhost:3000/api/plans' | jq '.[] | select(.name == "Claude Pro") | .models'

# 输出：
[
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5"
]
```

---

### 问题 2：修复数据库查询

#### 原始查询（失败）

```typescript
const { data: plansData } = await supabase
  .from('plans')
  .select(`
    *,
    providers (
      id,
      name,
      slug,
      logo_url
    )
  `)
  .eq('provider_id', product.provider_id)
  .order('price', { ascending: true });
```

**错误**：
```
PGRST200: Could not find a relationship between 'plans' and 'providers'
```

#### 修复后的查询

**文件**：`src/app/[locale]/models/[slug]/page.tsx`

```typescript
// 1. 简化查询 - 不 join providers
const { data: plansData } = await supabase
  .from('plans')
  .select('*')
  .eq('provider_id', product.provider_id)
  .order('price', { ascending: true });

// 2. 过滤相关计划
const relevantPlans = (plansData || []).filter((plan: any) => {
  if (plan.models && Array.isArray(plan.models)) {
    return plan.models.includes(slug) || plan.models.includes(product.slug);
  }
  return true;
});

// 3. 手动添加 provider 信息（从 product）
const plansWithProvider = relevantPlans.map((plan: any) => ({
  ...plan,
  providers: product.providers  // ✅ 使用 product 的 provider 信息
}));

return {
  product,
  channelPrices: channelPrices || [],
  plans: plansWithProvider || []
};
```

---

## 🧪 测试结果

### 数据验证

```bash
# 测试 API
curl 'http://localhost:3000/api/plans' | jq '.[] | select(.provider.slug == "anthropic")'

# 结果：
Claude Free    models: ["claude-sonnet-4-6"]
Claude Pro     models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
Claude Max     models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
Claude Team    models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
```

### 页面测试

访问：`http://localhost:3000/en/models/claude-opus-4-6`

**服务器日志**：
```
[DEBUG] Total plans from provider: 4
[DEBUG] Relevant plans after filtering: 3
[DEBUG] First plan: Claude Pro models: ["claude-opus-4-6", ...]
```

**展示的 Plans**：
1. ⭐ Claude Pro (Recommended) - $20/month
2. 💰 Claude Max (Best Value) - $100/month
3. Claude Team - $25/user/month

（Claude Free 被过滤掉了，因为它的 models 只有 claude-sonnet-4-6）

---

## 📊 过滤逻辑

```typescript
const relevantPlans = plans.filter((plan) => {
  // 检查 plan.models 是否包含当前模型
  if (plan.models && Array.isArray(plan.models)) {
    return plan.models.includes('claude-opus-4-6');
  }
  return true;  // fallback
});
```

**对于 Claude Opus 4.6**：
- ✅ Claude Pro → `models: ["claude-opus-4-6", ...]` → 匹配
- ✅ Claude Max → `models: ["claude-opus-4-6", ...]` → 匹配
- ✅ Claude Team → `models: ["claude-opus-4-6", ...]` → 匹配
- ❌ Claude Free → `models: ["claude-sonnet-4-6"]` → 不匹配

---

## 📂 修改的文件

```
scripts/db/queries.ts                           # 添加 models 字段支持
scripts/index.ts                                # 传递 models 参数
src/app/[locale]/models/[slug]/page.tsx        # 修复查询和过滤逻辑
PLAN_CARDS_FIX.md                              # 本文档
```

---

## 💡 技术细节

### 为什么不用 JOIN？

**问题**：`plans` 表没有到 `providers` 表的外键

**解决方案**：
1. `plans` 和 `products` 都有 `provider_id`
2. 从 `products` 查询获取 provider 信息
3. 手动将 provider 信息添加到每个 plan

**优势**：
- 避免修改数据库 schema
- 简化查询逻辑
- 利用已有的 product → provider 关系

---

## ✅ 验收标准

- [x] `models` 字段正确保存到数据库
- [x] Plans 查询成功（无 PGRST200 错误）
- [x] 页面显示 3 个相关 plan cards
- [x] 推荐标签正确显示（⭐ Recommended, 💰 Best Value）
- [x] Provider logo 正确显示
- [x] 过滤逻辑正确（只显示包含该模型的 plans）

---

**🎉 Plan Cards 显示问题已完全修复！现在用户可以看到包含该模型的所有订阅计划。**
