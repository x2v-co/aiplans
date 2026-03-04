# aiplans.dev

[English](#english) | [中文](#中文)

---

## English

### Overview

**aiplans.dev** is an AI pricing comparison platform that helps users compare AI subscription plans and API token prices across providers. Compare GPT-4, Claude, DeepSeek, Gemini, and other AI models to find the best deals.

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
- **Database**: PostgreSQL (Supabase)
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics

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

### Data Scraping

```bash
# Run all dynamic scrapers (28+ providers)
tsx scripts/index-dynamic.ts

# Individual scrapers
tsx scripts/scrapers/openai-dynamic.ts
tsx scripts/scrapers/anthropic-dynamic.ts
tsx scripts/scrapers/deepseek-dynamic.ts
```

### Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_connection_string
```

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
- **数据库**: PostgreSQL (Supabase)
- **部署**: Vercel
- **分析**: Vercel Analytics

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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_connection_string
```

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
