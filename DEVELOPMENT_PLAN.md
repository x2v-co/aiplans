# 🚀 PlanPrice.ai 开发计划

> 最后更新：2026-02-27
> 当前状态：✅ P0-1 完成 + Arena 爬虫完成

---

## 📊 项目概览

**PlanPrice.ai** — AI 定价比较平台
核心功能：比较 AI 订阅套餐和 API token 价格

**技术栈**：
- Frontend: Next.js 15 (App Router), TypeScript, TailwindCSS, Shadcn/UI
- Backend: Next.js API Routes, Drizzle ORM
- Database: PostgreSQL (Supabase)
- Deployment: Vercel

---

## ✅ 已完成功能（Phase 1-2）

### 1. 数据库架构 ✅

**核心表结构**：
```
providers (12条记录)
  ├── id, name, slug, logo_url, website_url, region

products (18+ LLM 模型)
  ├── id, name, slug, type, provider_id
  ├── context_window, benchmark_arena, benchmark_mmlu

plans (9条记录)
  ├── id, name, slug, tier, pricing_model
  ├── price (monthly), annual_price
  ├── daily_message_limit, requests_per_minute, qps, tokens_per_minute
  ├── provider_id, product_id

channels (10+ 渠道)
  ├── id, name, slug, type (official/cloud/aggregator/reseller)
  ├── region, access_from_china, website_url
  ├── provider_id (⚠️ 待执行迁移)

channel_prices (57条记录)
  ├── id, product_id, channel_id
  ├── input_price_per_1m, output_price_per_1m
  ├── cached_input_price_per_1m, rate_limit
  ├── is_available, last_verified

price_history
  ├── 价格变化追踪（未来功能）

coupons (6条记录)
  ├── 优惠码社区
```

**迁移文件位置**：`scripts/db/migrations/`
- ✅ `final_fix.sql` — 已执行，修复 plans 表结构
- ⚠️ `add_channel_provider.sql` — 待执行（可选，为 channels 添加 provider_id）

---

### 2. 数据抓取系统 ✅

**抓取脚本位置**：`scripts/scrapers/`

**API 价格抓取器（8个）**：
- ✅ `api-openai.ts` — OpenAI 官方 API 定价
- ✅ `api-anthropic.ts` — Anthropic 官方 API 定价
- ✅ `api-deepseek.ts` — DeepSeek 官方 API 定价
- ✅ `api-together.ts` — Together AI 聚合平台
- ✅ `api-siliconflow.ts` — 硅基流动（国内聚合）
- ✅ `api-google-gemini.ts` — Google Gemini API
- ✅ `api-grok.ts` — Grok/X.AI API
- ✅ `api-mistral.ts` — Mistral AI API
- 🔄 `api-openrouter.ts` — OpenRouter（需要更新）

**订阅套餐抓取器（3个）**：
- ✅ `plan-openai.ts` — ChatGPT Plus/Pro/Team/Enterprise
- ✅ `plan-anthropic.ts` — Claude Pro/Team/Enterprise
- ✅ `plan-google-gemini.ts` — Google One AI Premium

**Benchmark 抓取器（1个）**：
- ✅ `benchmark-arena.ts` — Arena AI Leaderboard ELO 分数 **🆕 2026-02-27**

**运行命令**：
```bash
npm run scrape              # 运行所有抓取器（包括 Arena）
npm run scrape:api          # 仅 API 价格
npm run scrape:plans        # 仅订阅套餐
npm run scrape:arena        # 仅 Arena Leaderboard **🆕**
npm run test:scraper        # 测试单个抓取器
```

**当前数据**：
- 57 条 API 价格记录
- 9 条订阅套餐记录
- 15+ 个模型的 Arena ELO 分数 **🆕**
- 0 错误

---

### 3. Logo 系统 ✅

**Logo 自动抓取**：`scripts/fetch-provider-logos.ts`

**工作原理**：
1. 从 providers 表读取 website_url
2. 尝试多个服务获取 logo：
   - Icon Horse: `https://icon.horse/icon/{domain}`
   - Clearbit: `https://logo.clearbit.com/{domain}`
   - Google Favicon: `https://www.google.com/s2/favicons?domain={domain}&sz=128`
3. 验证 URL 可访问性
4. 保存到 `providers.logo_url`

**运行命令**：
```bash
npm run fetch-logos         # 仅更新缺失的 logo
npm run fetch-logos:force   # 强制更新所有 logo
```

**状态**：
- ✅ 12 个 provider 都有 logo_url
- ✅ API 端点返回 logo_url
- ✅ 前端页面显示真实 logo（不再是 emoji）

---

### 4. API 端点 ✅

**核心 API**：

| 端点 | 功能 | 返回数据 |
|------|------|---------|
| `GET /api/providers` | 供应商列表 | `id, name, slug, logo_url` |
| `GET /api/products?type=llm` | 产品列表 | 包含 `providers.logo_url` |
| `GET /api/products/[slug]/channels` | 某模型的所有渠道价格 | 渠道 + 价格 |
| `GET /api/channels/[productId]` | 某产品的渠道价格 | 包含 nested `providers.logo_url` |
| `GET /api/plans` | 订阅套餐列表 | 筛选：type, tier, region, provider |
| `GET /api/compare/plans?model={slug}` | 套餐对比 | 官方 vs 第三方 |
| `GET /api/coupons` | 优惠码列表 | 社区提交的优惠码 |

**API 特性**：
- ✅ 支持查询参数筛选（provider_id, type, region）
- ✅ 返回 logo_url 供前端直接使用
- ✅ 嵌套查询（products join providers）
- ✅ 排序优化（按价格升序）

---

### 5. 前端页面 ✅

**已实现页面**：

| 路由 | 页面 | 状态 |
|------|------|------|
| `/` | 首页 | ✅ |
| `/[locale]/api-pricing` | API 价格总表 | ✅ Logo 已修复 |
| `/[locale]/compare/plans` | 订阅套餐对比 | ✅ TypeScript 已修复 |
| `/[locale]/coupons` | 优惠码中心 | ✅ |
| `/open-model/[slug]` | 开源模型渠道价格 | ✅ |
| `/plans/[provider]` | 供应商所有套餐 | ✅ |

**组件库**：Shadcn/UI
- ✅ Card, Badge, Button, Input, Select, Tabs, Checkbox
- ✅ LanguageSwitcher（中英文切换）

**i18n 系统**：
- ✅ 自定义翻译系统（替代 next-intl）
- ✅ 支持中文/英文
- 文件位置：`src/lib/translations/`

---

### 6. 构建系统 ✅

**构建状态**：
- ✅ TypeScript 编译通过
- ✅ 无类型错误
- ✅ 生成 14 个静态/动态路由
- ✅ 开发服务器正常运行

**已修复的构建错误**：
1. ✅ `api-pricing/page.tsx` — 恢复函数声明
2. ✅ `compare/plans/page.tsx` — 添加类型注解
3. ✅ `api/compare/plans/route.ts` — 修复 providers 类型转换

---

## 🔄 Phase 3：待实现功能

### 优先级 P0（核心功能完善）

#### 3.1 完善 API Pricing 页面 ✅ **P0-1 完成**

**完成状态**：✅ 已完成
**完成时间**：2026-02-27
**详细文档**：`P0-1_COMPARE_PLANS_COMPLETE.md`

**已完成任务**：
- [x] 增强 Products API，支持 `featured` 和 `include_plan_count` 参数
- [x] 实现 Compare Plans 页面数据加载逻辑
- [x] 加载热门模型（8个）及套餐数量
- [x] 按供应商分组展示模型
- [x] 使用真实 logo_url 替代 emoji
- [x] 添加翻译键（中英文）
- [x] 构建测试通过，无错误

**API 端点**：
```bash
# 获取热门模型及套餐数量
GET /api/products?featured=true&include_plan_count=true&type=llm

# 按供应商筛选产品
GET /api/products?provider_id={id}&include_plan_count=true&type=llm
```

**剩余任务**（可选优化）：
- [ ] 执行数据库迁移 `add_channel_provider.sql`（可选）
- [ ] 添加价格历史图表（使用 Recharts）
- [ ] 添加「按使用量计算成本」工具
- [ ] 添加「官方价格基准线」对比
- [ ] 优化移动端响应式布局

**文件位置**：
- `src/app/api/products/route.ts` ✅ 已增强
- `src/app/[locale]/compare/plans/page.tsx` ✅ 数据加载完成
- `messages/en.json` ✅ 翻译已添加
- `messages/zh.json` ✅ 翻译已添加

---

#### 3.2 完善 Compare Plans 页面

**任务**：
- [x] 实现真实数据加载（✅ 已完成）
- [ ] 添加「热门模型」快捷入口（✅ 已完成，可优化）
- [ ] 添加「按供应商」分组展示（✅ 已完成）
- [ ] 实现「年付 vs 月付」成本对比
- [ ] 添加「比官方便宜 X%」标签

**API 端点**：`/api/compare/plans?model={slug}`

**参考设计**：`PLAN_COMPARE.md`

**关键对比维度**：
```typescript
{
  💰 价格: price, annual_price, effectiveMonthly
  🔢 限制: daily_message_limit, requests_per_minute, qps
  📦 配额: tokens_per_minute, context_window
  🏷️ 折扣: vs_official (比官方便宜/贵 X%)
}
```

---

#### 3.3 添加价格历史追踪

**任务**：
- [ ] 创建 `price_history` 表的抓取逻辑
- [ ] 实现「价格变化检测」功能
- [ ] 添加价格趋势图（Recharts）
- [ ] 实现「价格下降提醒」（邮件通知）

**数据库表**：
```sql
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  channel_id INTEGER REFERENCES channels(id),
  input_price_per_1m DECIMAL,
  output_price_per_1m DECIMAL,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

**抓取脚本**：
- 修改 `scripts/index.ts` 添加历史记录逻辑
- 每次抓取时对比上次价格，有变化则插入历史记录

---

### 优先级 P1（增强功能）

#### 3.4 添加更多数据源

**待添加的抓取器**：

**API 价格抓取器**：
- [ ] `api-azure-openai.ts` — Azure OpenAI Service
- [ ] `api-aws-bedrock.ts` — AWS Bedrock
- [ ] `api-vertex-ai.ts` — Google Vertex AI
- [ ] `api-hunyuan.ts` — 腾讯混元
- [ ] `api-qwen.ts` — 阿里通义千问
- [ ] `api-baichuan.ts` — 百川智能
- [ ] `api-minimax.ts` — MiniMax
- [ ] `api-zhipu.ts` — 智谱 GLM

**订阅套餐抓取器**：
- [ ] `plan-deepseek.ts` — DeepSeek
- [ ] `plan-perplexity.ts` — Perplexity Pro
- [ ] `plan-cursor.ts` — Cursor Pro
- [ ] `plan-github-copilot.ts` — GitHub Copilot

**聚合平台**：
- [ ] `api-openrouter.ts` — 更新 OpenRouter 数据
- [ ] `api-huoshan.ts` — 火山引擎（字节）
- [ ] `api-aliyun-bailian.ts` — 阿里百炼

---

#### 3.5 成本计算器页面

**路由**：`/calculator`

**功能**：
- [ ] 输入每日请求量、token 使用量
- [ ] 自动计算各渠道月度成本
- [ ] 推荐最省钱的 Plan 或 API
- [ ] 支持「轻度/中度/重度」使用模板

**参考 API**：`/api/calculator/estimate`

---

#### 3.6 优惠码社区功能完善

**任务**：
- [ ] 添加优惠码「点赞/点踩」功能
- [ ] 添加「验证成功」标签
- [ ] 实现优惠码「过期提醒」
- [ ] 添加「用户提交」表单

**API 端点**：
- `POST /api/coupons` — 提交优惠码
- `POST /api/coupons/[id]/vote` — 投票

---

### 优先级 P2（未来功能）

#### 3.7 用户系统

**功能**：
- [ ] 用户注册/登录（Supabase Auth）
- [ ] 保存对比方案
- [ ] 价格提醒订阅
- [ ] 个人使用历史

---

#### 3.8 管理后台

**路由**：`/admin`

**功能**：
- [ ] 手动添加/编辑 Product
- [ ] 手动添加/编辑 Channel Price
- [ ] 审核用户提交的优惠码
- [ ] 查看抓取日志

---

#### 3.9 SEO 优化

**任务**：
- [ ] 添加结构化数据（Schema.org）
- [ ] 生成动态 sitemap.xml
- [ ] 添加 robots.txt
- [ ] Open Graph 优化
- [ ] 中文 SEO（百度搜索资源平台）

---

## 🛠️ 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行抓取器
npm run scrape

# 更新 Logo
npm run fetch-logos
```

### 环境变量

`.env.local` 文件：
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# (可选) Redis
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx
```

---

## 📂 项目结构

```
planprice/
├── src/
│   ├── app/
│   │   ├── [locale]/                 # 国际化路由
│   │   │   ├── page.tsx             # 首页
│   │   │   ├── api-pricing/         # API 价格总表 ✅
│   │   │   ├── compare/plans/       # 订阅套餐对比 ✅
│   │   │   └── coupons/             # 优惠码中心 ✅
│   │   ├── api/                     # API 路由
│   │   │   ├── products/            # 产品列表 ✅
│   │   │   ├── channels/            # 渠道价格 ✅
│   │   │   ├── plans/               # 套餐列表 ✅
│   │   │   ├── compare/plans/       # 套餐对比 ✅
│   │   │   └── coupons/             # 优惠码 ✅
│   │   ├── open-model/[slug]/       # 开源模型价格 ✅
│   │   └── plans/[provider]/        # 供应商套餐 ✅
│   ├── components/
│   │   ├── ui/                      # Shadcn/UI 组件
│   │   └── LanguageSwitcher.tsx     # 语言切换 ✅
│   ├── lib/
│   │   ├── supabase.ts              # Supabase 客户端 ✅
│   │   └── translations/            # i18n 翻译文件 ✅
│   └── db/
│       └── schema.ts                # Drizzle schema（未使用）
├── scripts/
│   ├── scrapers/                    # 数据抓取器 ✅
│   │   ├── api-openai.ts           # OpenAI API ✅
│   │   ├── api-anthropic.ts        # Anthropic API ✅
│   │   ├── api-deepseek.ts         # DeepSeek API ✅
│   │   ├── api-together.ts         # Together AI ✅
│   │   ├── api-siliconflow.ts      # 硅基流动 ✅
│   │   ├── api-google-gemini.ts    # Google Gemini ✅
│   │   ├── api-grok.ts             # Grok/X.AI ✅
│   │   ├── api-mistral.ts          # Mistral AI ✅
│   │   ├── plan-openai.ts          # OpenAI Plans ✅
│   │   ├── plan-anthropic.ts       # Anthropic Plans ✅
│   │   └── plan-google-gemini.ts   # Google Plans ✅
│   ├── db/
│   │   ├── migrations/              # SQL 迁移文件
│   │   │   ├── final_fix.sql       # ✅ 已执行
│   │   │   └── add_channel_provider.sql # ⚠️ 待执行
│   │   └── queries.ts               # 数据库查询工具 ✅
│   ├── fetch-provider-logos.ts      # Logo 抓取 ✅
│   └── index.ts                     # 主抓取脚本 ✅
├── CLAUDE.md                        # Claude 项目指引
├── MRD.md                           # 产品需求文档
├── PLAN_COMPARE.md                  # 对比功能设计文档
├── MVP-COMPLETED.md                 # MVP 完成清单
├── LOGO_REPLACEMENT_COMPLETED.md    # Logo 替换完成总结
└── DEVELOPMENT_PLAN.md              # 本文档 ⭐
```

---

## 🐛 已知问题

### 1. `compare/plans` 页面数据为空

**现象**：
- `hotModelsList` 和 `modelsByProvider` 是空数组
- 页面没有调用 API 加载数据

**解决方案**：
```typescript
// src/app/[locale]/compare/plans/page.tsx

useEffect(() => {
  async function loadData() {
    // 1. 加载热门模型
    const hotModelsData = await fetch('/api/products?featured=true');
    setHotModelsList(await hotModelsData.json());

    // 2. 加载按供应商分组的模型
    const providersData = await fetch('/api/providers');
    const providers = await providersData.json();

    const grouped = await Promise.all(
      providers.map(async (p) => {
        const res = await fetch(`/api/products?provider_id=${p.id}`);
        const models = await res.json();
        return { provider: p, models };
      })
    );

    setModelsByProvider(grouped);
    setLoading(false);
  }

  loadData();
}, []);
```

---

### 2. Channels 表缺少 `provider_id`（可选修复）

**现象**：
- `channels` 表没有 `provider_id` 列
- 无法直接查询 channel 的 provider logo

**影响**：
- 当前不影响功能，因为可以通过 `channel_prices` join `products` join `providers` 获取 logo
- 但直接从 channels 关联 providers 更高效

**解决方案**：
```bash
# 在 Supabase SQL Editor 执行
psql < scripts/db/migrations/add_channel_provider.sql
```

---

## 📝 下次开发建议

### 立即任务（1-2小时）

1. **✅ 完善 Compare Plans 数据加载** — 已完成 ✅
   - ✅ 修改 `src/app/[locale]/compare/plans/page.tsx`
   - ✅ 添加 API 调用逻辑
   - ✅ 测试页面展示

2. **添加价格历史追踪** — 下一个 P0 任务
   - 创建 `price_history` 表
   - 修改抓取脚本记录历史
   - 添加价格趋势图

3. **添加成本计算器页面**
   - 创建 `/calculator` 路由
   - 实现成本估算逻辑
   - 推荐最优方案

### 中期任务（1周）

1. **添加更多数据源**
   - 国内平台：通义千问、混元、百川
   - 云厂商：Azure OpenAI, AWS Bedrock, Vertex AI
   - 聚合平台：火山引擎、阿里百炼

2. **优化 SEO**
   - 结构化数据
   - 动态 sitemap
   - Open Graph 标签

3. **优惠码社区功能**
   - 投票系统
   - 验证标签
   - 用户提交表单

### 长期任务（1个月）

1. **用户系统**
   - Supabase Auth 集成
   - 个人中心
   - 价格提醒订阅

2. **管理后台**
   - CRUD 界面
   - 抓取日志查看
   - 优惠码审核

3. **移动端优化**
   - 响应式布局优化
   - 触摸交互优化
   - 性能优化

---

## 🎯 核心指标

**当前数据规模**：
- ✅ 12 个供应商
- ✅ 18+ 个 LLM 模型
- ✅ 57 条 API 价格记录
- ✅ 9 条订阅套餐记录
- ✅ 10+ 个渠道
- ✅ 6 个优惠码

**目标数据规模（3个月）**：
- 🎯 30+ 供应商
- 🎯 100+ LLM 模型
- 🎯 500+ API 价格记录
- 🎯 50+ 订阅套餐
- 🎯 30+ 渠道
- 🎯 100+ 优惠码

---

## 📚 参考文档

- `CLAUDE.md` — Claude 开发指引
- `MRD.md` — 产品需求文档
- `PLAN_COMPARE.md` — 对比功能设计
- `MVP-COMPLETED.md` — MVP 完成清单
- `LOGO_REPLACEMENT_COMPLETED.md` — Logo 系统总结
- `FIX_API_PRICING_LOGO.md` — Logo 修复指南

---

## 🚦 当前状态总结

### ✅ 完成
- 数据库架构和迁移
- 8个 API 抓取器 + 3个 Plan 抓取器
- **✅ 1个 Benchmark 抓取器（Arena Leaderboard）🆕**
- Logo 自动抓取系统
- 核心 API 端点（8个）
- 核心前端页面（6个）
- i18n 系统
- 构建系统无错误
- **✅ P0-1: Compare Plans 数据加载（2026-02-27）**
- **✅ Arena Leaderboard 爬虫（2026-02-27）🆕**

### 🔄 进行中
- 无（当前暂停，等待下次开发）

### ⚠️ 待处理（按优先级）
1. **P0-2: 价格历史追踪** — 下一个任务
2. **P0-3: 成本计算器页面**
3. P1: 更多数据源（国内平台、云厂商）
4. P1: SEO 优化
5. P2: 用户系统、管理后台

### 🎯 下次启动任务
**建议从 P0-2 开始**：
1. 添加价格历史追踪功能
2. 创建 `price_history` 表
3. 实现价格变化检测和趋势图

---

**📌 重要提示**：
- 下次开发时，直接参考本文档，不需要重新打开当前 context
- 所有核心代码和逻辑都已记录在文档中
- 按照优先级 P0 → P1 → P2 依次推进
- 遇到问题查看「已知问题」章节

🚀 **准备就绪，随时可以继续开发！**
