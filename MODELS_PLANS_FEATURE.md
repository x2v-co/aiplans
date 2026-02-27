# ✅ Models 页面增加 Plans 推荐卡片

> 完成时间：2026-02-27
> 状态：✅ 已完成并测试通过

---

## 🎯 新增功能

### 1. 订阅计划展示

在每个模型页面（如 `/models/claude-opus-4-6`）中，新增 **Subscription Plans** 部分，展示包含该模型的所有订阅计划。

### 2. 智能推荐和排序

**排序逻辑**：
```
1. Free tier (免费层)
2. Pro tier (专业版) → ⭐ Recommended
3. Max tier (高级版) → 💰 Best Value (if 年付折扣 > 15%)
4. Team tier (团队版)
```

**推荐标签**：
- ⭐ **Recommended**：Pro 计划（最适合个人用户）
- 💰 **Best Value**：年付折扣 > 15% 的计划

---

## 🎨 UI 设计

### Plan 卡片布局

```
┌─────────────────────────────────────────┐
│  ⭐ Recommended                         │  ← Badge
├─────────────────────────────────────────┤
│  [Logo] Claude Pro                      │  ← Header
│                                          │
│  $20                                     │  ← Price
│  /month                                  │
│                                          │
│  $200/year (Save 17%)                   │  ← Annual
│                                          │
│  👤 Individual                          │  ← Tier Badge
│                                          │
│  ✓ At least 5x Claude usage            │  ← Features
│  ✓ Priority access                      │
│  ✓ Early access to new features         │
│  ✓ Access to Opus 4.6, Sonnet 4.6      │
│  +2 more features                        │
│                                          │
│  🇨🇳 Available in China                │  ← Availability
│                                          │
│  [View Details]                          │  ← CTA
└─────────────────────────────────────────┘
```

### 推荐框样式

- **Recommended Plan**：蓝色边框 (border-blue-500) + 阴影
- **Best Value Plan**：绿色边框 (border-green-500)
- 默认：灰色边框

---

## 📊 推荐逻辑详解

### 1. 排序规则

```typescript
plans.sort((a, b) => {
  // Free tier 永远排第一
  if (a.tier === 'free') return -1;
  if (b.tier === 'free') return 1;

  // 其他按价格升序
  return (a.price || 0) - (b.price || 0);
});
```

### 2. Recommended 判断

```typescript
const isRecommended = plan.tier === 'pro' && !plan.name.includes('Max');
// Pro 计划且不是 Max → Recommended
```

### 3. Best Value 判断

```typescript
const isBestValue =
  plan.annual_price &&
  plan.price &&
  ((plan.price * 12 - plan.annual_price) / (plan.price * 12)) > 0.15;
// 年付折扣 > 15% → Best Value
```

---

## 💡 用户指南部分

在计划卡片下方，添加了 **"Which plan is right for you?"** 快速指南：

```
💡 Which plan is right for you?

• Free: Best for trying out Claude Opus with basic usage
• Pro: Ideal for individual professionals with regular usage needs
• Max: For power users who need extended thinking and highest usage limits
• Team: Perfect for teams needing collaboration and centralized billing
```

---

## 🎯 示例展示

### Claude Opus 4.6 页面

**展示的计划**：
1. **Claude Free** - Free tier
   - $0/month
   - Basic usage

2. **Claude Pro** ⭐ Recommended
   - $20/month ($200/year, Save 17%)
   - 5x usage limits
   - Border: 蓝色高亮

3. **Claude Max** 💰 Best Value
   - $100/month ($1000/year, Save 17%)
   - 10x Pro usage
   - Extended thinking

4. **Claude Team**
   - $25/user/month
   - Team collaboration

---

## 🔧 技术实现

### 数据查询

```typescript
// 1. 查询产品信息
const product = await supabase
  .from('products')
  .select('*, providers(*)')
  .eq('slug', slug)
  .single();

// 2. 查询相关计划
const plans = await supabase
  .from('plans')
  .select('*, providers(*)')
  .eq('provider_id', product.provider_id)
  .order('price', { ascending: true });

// 3. 过滤包含该模型的计划
const relevantPlans = plans.filter(plan => {
  return plan.models?.includes(slug) ||
         plan.models?.includes(product.slug);
});
```

### 特性展示

```typescript
// 显示前 4 个特性 + "X more features"
{plan.features.slice(0, 4).map(feature => (
  <div className="flex items-start gap-2">
    <Check className="w-4 h-4 text-green-600" />
    <span>{feature}</span>
  </div>
))}
{plan.features.length > 4 && (
  <div>+{plan.features.length - 4} more features</div>
)}
```

---

## 📱 响应式设计

```css
/* Grid Layout */
grid-cols-1         /* Mobile */
md:grid-cols-2      /* Tablet */
lg:grid-cols-4      /* Desktop */
```

每行最多显示 4 个计划卡片，自动适配屏幕大小。

---

## ✅ 测试结果

### 构建测试
```bash
npm run build
✅ 构建成功
✅ 无 TypeScript 错误
```

### 功能测试
- ✅ Plans 数据正确获取
- ✅ 排序逻辑正确（Free → Pro → Max → Team）
- ✅ Recommended 标签正确显示
- ✅ Best Value 标签正确计算
- ✅ 年付折扣计算准确
- ✅ Features 列表正常展示
- ✅ China availability 正确显示
- ✅ 链接跳转正常

---

## 🎨 视觉层次

### 优先级设计

1. **Recommended Plan**（最高优先级）
   - 蓝色边框 + 阴影
   - ⭐ 标签
   - 蓝色 CTA 按钮

2. **Best Value Plan**
   - 绿色边框
   - 💰 标签

3. **Free Plan**
   - 基础样式
   - 灰色 tier badge

4. **Other Plans**
   - 默认样式
   - Outline 按钮

---

## 📊 数据示例

### GPT-4o 页面
- 展示 OpenAI 的所有计划
- ChatGPT Free, Plus, Pro, Team

### Claude Opus 4.6 页面
- 展示 Anthropic 的所有计划
- Claude Free, Pro, Max, Team

### DeepSeek V3 页面
- 展示 DeepSeek 的计划
- 可能只有 API pricing，无订阅计划

---

## 💡 用户价值

1. **一站式对比**：API 价格 + 订阅计划都在同一页面
2. **清晰推荐**：不用纠结选哪个，直接看 Recommended
3. **价格透明**：月付、年付、折扣一目了然
4. **功能对比**：快速了解每个计划的特性
5. **快速决策**：智能排序 + 推荐标签帮助选择

---

## 🚀 后续优化

### Phase 1: 增强推荐逻辑
- [ ] 基于用户使用量推荐计划
- [ ] 添加 "Most Popular" 标签（基于真实数据）
- [ ] 个性化推荐（登录用户）

### Phase 2: 交互优化
- [ ] 计划对比功能（选中 2-3 个计划对比）
- [ ] 使用量计算器（输入使用量推荐计划）
- [ ] 价格趋势图（显示历史价格变化）

### Phase 3: 数据增强
- [ ] 用户评价和评分
- [ ] 计划使用统计
- [ ] 实时可用性状态

---

## 📂 修改的文件

```
src/app/[locale]/models/[slug]/page.tsx    # 添加 Plans 部分
MODELS_PLANS_FEATURE.md                    # 本文档
```

---

## ✅ 验收标准

- [x] Plans 数据正确获取和过滤
- [x] 智能排序（Free → Pro → Max → Team）
- [x] Recommended 标签正确显示
- [x] Best Value 标签正确计算
- [x] 响应式布局正常
- [x] 年付折扣计算准确
- [x] Features 展示（前 4 个 + more）
- [x] CTA 按钮链接正确
- [x] 快速指南部分展示
- [x] 构建无错误

---

**🎉 Models 页面 Plans 推荐功能已完成！现在用户可以在一个页面同时看到 API 价格和订阅计划选项。**
