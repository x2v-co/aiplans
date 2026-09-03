# aiplans.dev

[English](#english) | [中文](#中文)

---

## English

### Overview

**aiplans.dev** is an AI pricing comparison platform that helps users compare AI subscription plans and API token prices across providers. Compare GPT-4, Claude, DeepSeek, Gemini, and other AI models to find the best deals.

### Live pricing research

- [AI API Price Index](https://aiplans.dev/en/reports/api-price-index) - current model, channel, provider, and price-change coverage
- [Complete API price table](https://aiplans.dev/en/api-pricing) - search and filter all tracked model channels
- Pricing guides: [GLM / ChatGLM](https://aiplans.dev/en/guides/glm-chatglm-api-pricing), [Claude / Anthropic](https://aiplans.dev/en/guides/claude-anthropic-pricing), [Grok](https://aiplans.dev/en/guides/grok-pricing), and [Kimi / Moonshot](https://aiplans.dev/en/guides/kimi-api-pricing)
- [Subscription plan comparison](https://aiplans.dev/en/compare/plans) - compare monthly and annual AI product plans

The price index and guides are generated from the same audited pricing data as the comparison pages. Prices retain the vendor's billing currency and are normalized to USD only for cross-channel ranking.

### Features

- **Subscription Plan Comparison** - Compare ChatGPT Plus, Claude Pro, DeepSeek, and other AI subscription plans
- **API Price Comparison** - Compare API prices for the same model across different channels (official, Azure, OpenRouter, SiliconFlow, etc.)
- **Multi-currency Support** - Prices in USD and CNY
- **China-Optimized** - Track domestic payment methods and accessibility (Alipay/WeChat)
- **Benchmark Integration** - View Chatbot Arena ELO scores alongside pricing
- **Coupon Community** - Submit and vote on discount codes

### Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS v4, Shadcn/UI
- **Backend**: Next.js API Routes, Drizzle ORM
- **Database**: PostgreSQL (self-hosted Docker volume)
- **Deployment**: Docker Compose on a VPS, behind host-level Nginx
- **Analytics**: No hosting-provider analytics dependency; add an
  infrastructure-level analytics tool separately if needed

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Data scraping and accuracy

```bash
npm run scrape              # all API price scrapers (~20 providers)
npm run scrape:plans        # all plan scrapers (~12 providers)

npm run audit               # read-only data accuracy check
npm run fix:data:dry-run    # preview api_channel_prices fixes
npm run fix:plans:dry-run   # preview plan fixes
npm run migrate             # apply idempotent DB migrations
```

See `scripts/README.md` and `CLAUDE.md` for the full data-layer
architecture (write-boundary validation, NO FALLBACK principle,
`plans.source` protection, Chatbot Arena ELO ingestion).

### Environment variables

Create `.env.local`:

```
DATABASE_URL=postgresql://planprice:password@localhost:5432/planprice
DB_POOL_MAX=10
DB_PREPARE=true
```

For the VPS Compose deployment, copy
`deploy/production/.env.production.template` to
`deploy/production/.env.production` and set a long random
`POSTGRES_PASSWORD`. The application runtime connects directly to PostgreSQL;
it does not require Supabase URL or API keys.

The GitHub-hosted scraper can continue using the source `DATABASE_URL` during
migration preparation. At final cutover, disable its schedule and run
`deploy/production/run-scrapers.sh` from VPS cron or systemd instead. The new
PostgreSQL port stays private and is not exposed for GitHub-hosted runners.

### Supported Providers

- OpenAI (GPT-4, GPT-4o, o1, o3-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Google Gemini
- DeepSeek
- Moonshot (Kimi)
- Minimax
- Zhipu (GLM)
- Qwen (Tongyi)
- And 20+ more providers

### API Channels

- **Official** - Direct API access
- **Cloud** - AWS Bedrock, Google Vertex AI, Azure OpenAI
- **Aggregator** - OpenRouter, SiliconFlow
- **Reseller** - Volcengine, Alibaba Cloud

### License

MIT

---

## 中文

### 概述

**aiplans.dev** 是一个 AI 价格对比平台，帮助用户比较不同供应商的 AI 订阅套餐和 API 令牌价格。对比 GPT-4、Claude、DeepSeek、Gemini 等 AI 模型，找到最优惠的方案。

### 实时价格研究

- [AI API 价格指数](https://aiplans.dev/zh/reports/api-price-index)：汇总当前模型、渠道、供应商和价格变化
- [完整 API 价格表](https://aiplans.dev/zh/api-pricing)：搜索并筛选全部已追踪模型渠道
- 专题指南：[GLM / ChatGLM](https://aiplans.dev/zh/guides/glm-chatglm-api-pricing)、[Claude / Anthropic](https://aiplans.dev/zh/guides/claude-anthropic-pricing)、[Grok](https://aiplans.dev/zh/guides/grok-pricing)、[Kimi / Moonshot](https://aiplans.dev/zh/guides/kimi-api-pricing)
- [订阅套餐对比](https://aiplans.dev/zh/compare/plans)：对比 AI 产品月付与年付套餐

价格指数、专题指南与站内对比页面使用同一套经审计的数据。页面保留供应商原始结算币种，仅在跨渠道排序时统一换算为美元。

### 功能特性

- **订阅套餐对比** - 对比 ChatGPT Plus、Claude Pro、DeepSeek 等 AI 订阅套餐
- **API 价格对比** - 对比同一模型在不同渠道的 API 价格（官方、Azure、OpenRouter、硅基流动等）
- **多币种支持** - 支持 USD 和 CNY 价格显示
- **国内优化** - 跟踪国内支付方式和访问方式（支付宝/微信）
- **排行榜集成** - 结合 Chatbot Arena ELO 分数展示
- **优惠券社区** - 提交和投票折扣码

### 技术栈

- **前端**: Next.js 16 (App Router), TypeScript, TailwindCSS v4, Shadcn/UI
- **后端**: Next.js API Routes, Drizzle ORM
- **数据库**: VPS 上的 PostgreSQL Docker 容器
- **部署**: VPS Docker Compose + 宿主机 Nginx
- **分析**: 不依赖云厂商的分析组件；如有需要可单独接入基础设施级分析

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

### 数据爬取

```bash
# 运行所有动态爬虫 (28+ 提供商)
tsx scripts/index-dynamic.ts

# 单独爬虫
tsx scripts/scrapers/openai-dynamic.ts
tsx scripts/scrapers/anthropic-dynamic.ts
tsx scripts/scrapers/deepseek-dynamic.ts
```

### 环境变量

创建 `.env.local`:

```
DATABASE_URL=postgresql://planprice:password@localhost:5432/planprice
```

VPS 生产环境中，数据库不开放公网端口。正式切流时停用 GitHub 托管的定时
爬虫，改由 VPS 的 cron 或 systemd 调用
`deploy/production/run-scrapers.sh`。

### 支持的供应商

- OpenAI (GPT-4, GPT-4o, o1, o3-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Google Gemini
- DeepSeek
- Moonshot (Kimi)
- Minimax
- Zhipu (GLM)
- Qwen (通义千问)
- 以及 20+ 更多供应商

### API 渠道

- **官方** - 直连 API
- **云厂商** - AWS Bedrock, Google Vertex AI, Azure OpenAI
- **聚合平台** - OpenRouter, 硅基流动
- **转售商** - 火山引擎, 阿里云百炼

### 许可证

MIT
