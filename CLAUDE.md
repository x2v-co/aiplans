# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**planprice.ai** is an AI pricing comparison platform that helps users compare AI subscription plans and API token prices across providers. The core value proposition is comparing similar-tier AI plans and same-model pricing across different channels/vendors.

## Development Commands

```bash
# Development
npm run dev          # Start Next.js dev server on localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Data Scraping - Dynamic Scrapers (recommended)
tsx scripts/index-dynamic.ts  # Run all dynamic scrapers (28+ providers)

# Individual Dynamic Scrapers
tsx scripts/scrapers/deepseek-dynamic.ts
tsx scripts/scrapers/openai-dynamic.ts
tsx scripts/scrapers/anthropic-dynamic.ts
tsx scripts/scrapers/google-gemini-dynamic.ts
tsx scripts/scrapers/grok-dynamic.ts
tsx scripts/scrapers/mistral-dynamic.ts
tsx scripts/scrapers/moonshot-dynamic.ts
tsx scripts/scrapers/minimax-dynamic.ts
tsx scripts/scrapers/zhipu-dynamic.ts
tsx scripts/scrapers/qwen-dynamic.ts
tsx scripts/scrapers/seed-dynamic.ts
tsx scripts/scrapers/hunyuan-dynamic.ts
tsx scripts/scrapers/baidu-dynamic.ts
tsx scripts/scrapers/siliconflow-dynamic.ts
tsx scripts/scrapers/fireworks-dynamic.ts
tsx scripts/scrapers/replicate-dynamic.ts
tsx scripts/scrapers/anyscale-dynamic.ts
tsx scripts/scrapers/stepfun-dynamic.ts
tsx scripts/scrapers/dmxapi-dynamic.ts
tsx scripts/scrapers/aws-bedrock-dynamic.ts
tsx scripts/scrapers/azure-openai-dynamic.ts
tsx scripts/scrapers/vertex-ai-dynamic.ts
tsx scripts/scrapers/together-ai-dynamic.ts

# Legacy Scrapers (deprecated, use dynamic scrapers instead)
npm run scrape       # Run all legacy scrapers
npm run scrape:arena        # Scrape Chatbot Arena benchmarks
npm run scrape:openrouter   # Scrape OpenRouter pricing
npm run scrape:openai-api   # Scrape OpenAI API pricing
npm run scrape:openai-plan  # Scrape OpenAI subscription plans
npm run scrape:anthropic-api # Scrape Anthropic API pricing
npm run scrape:deepseek     # Scrape DeepSeek pricing
npm run scrape:grok         # Scrape Grok pricing
npm run scrape:mistral      # Scrape Mistral pricing
npm run scrape:together     # Scrape Together AI pricing
npm run scrape:siliconflow  # Scrape SiliconFlow pricing
npm run scrape:gemini-api   # Scrape Google Gemini API pricing
npm run scrape:gemini-plan  # Scrape Google Gemini subscription plans

# Logos
npm run fetch-logos   # Fetch provider logos
npm run fetch-logos:force  # Force re-download all logos

# Database (Drizzle ORM)
npx drizzle-kit generate  # Generate SQL migrations from schema
npx drizzle-kit push      # Push schema changes to database
npx drizzle-kit studio    # Open Drizzle Studio (DB GUI)
```

## Technology Stack

```
Frontend:     Next.js 16 (App Router + SSG/ISR), TypeScript, TailwindCSS v4, Shadcn/UI
               Recharts (price charts), Zustand (state management)

Backend:      Next.js API Routes, Drizzle ORM, Zod (validation)

Database:     PostgreSQL (Supabase), Drizzle ORM, Supabase JS Client

Deployment:  Vercel (frontend + API), Supabase (database)

Analytics:   Plausible/Umami (privacy-friendly), Google Search Console, 百度搜索资源平台
```

## Database Schema (Core Entities)

```
Provider ──────< Product ──────< Plan
    │                           │
    └────< Channel ──────< ChannelPrice
                              │
                              └─< PriceHistory

Coupon ──────< User ──────< PriceAlert
    │
    └─< CouponVote

Comparison (user-saved comparisons with SEO content)
```

Key tables:
- **providers**: AI service vendors (OpenAI, Anthropic, DeepSeek, etc.)
- **products**: Models/products (GPT-4o, Claude Sonnet, etc.) with benchmark scores
- **plans**: Subscription plans and token packs (includes RPM/QPS limits, yearly pricing, overage)
- **channels**: Third-party渠道/aggregators (OpenRouter, Azure, 硅基流动, etc.)
- **channel_prices**: Token prices per channel for each model
- **price_history**: Price change tracking
- **coupons**: Community-submitted discount codes
- **model_plan_mapping**: Many-to-many relationship between products (models) and plans with model-specific overrides
  - overrideRpm, overrideQps: RPM/QPS limits specific to a model
  - overrideInputPricePer1m, overrideOutputPricePer1m: Token prices for this model under the plan
  - overrideMaxOutputTokens: Output token limit for this model

Database config: `drizzle.config.ts`, schema in `src/db/schema/index.ts`
Use Supabase MCP plugin for migrations: `mcp__plugin_supabase_supabase__apply_migration`

## Environment Variables

Required environment variables (create `.env.local` for development):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_connection_string

# (Optional) Scraper-specific keys
OPENROUTER_API_KEY=your_key
```

## Core API Routes

```
/api/plans              - Plan listing with filters (type, tier, region, provider)
/api/products           - Product listing with benchmark data
/api/products/:slug/channels - 同一开源模型API在不同供应商的价格对比 (核心)
/api/compare/plans     - Compare multiple subscription plans
/api/compare/api-pricing - 同一模型API跨渠道价格对比 (核心)
/api/compare/open-model/:model - 相同开源模型在不同供应商的价格对比
/api/channels/:productId - 某模型的所有渠道价格列表
/api/coupons           - Discount codes with voting
/api/calculator/estimate - Cost estimation based on usage patterns
/api/search            - Global search
/api/alerts            - Price drop notifications
/api/admin/*           - Admin CRUD operations
```

## Page Routes (SEO Optimized)

```
/                           - AI Plan comparison homepage
/api-pricing               - API Token 价格总表 (核心 SEO 页面)
/open-model/:model         - 同一开源模型API各供应商价格对比页 (核心)
/open-model/:model/channels - 具体某模型渠道价格的所有对比
/plans/chatgpt            - ChatGPT all plans
/plans/claude             - Claude all plans
/plans/deepseek           - DeepSeek plans
/compare/chatgpt-vs-claude - Subscription plan comparison
/compare/api/gpt4o-vs-claude-sonnet - API price comparison
/channels/:model          - Model channel price comparison
/calculator               - AI cost calculator
/rankings/cheapest-api   - Cheapest API ranking
/rankings/best-value-plan - Best value plan ranking
/coupons                  - Discount code center
/guides/buy-openai-in-china - China purchase guide
```

## Key Features

1. **Plan Comparison**: Compare subscription plans across providers (ChatGPT Plus vs Claude Pro)
2. **API Price Comparison** (核心): Same open-source model API prices across different vendors
   - Example: Claude 3.5 Sonnet via OpenAI official vs AWS Bedrock vs Google Vertex vs OpenRouter vs 硅基流动 vs 火山引擎
   - Show input/output per-1M token prices, rate limits, availability
3. **Cost Calculator**: Estimate monthly costs based on usage patterns
4. **Price History**: Track price changes over time
5. **Coupon Community**: Submit and vote on discount codes
6. **Benchmark Integration**: Combine pricing with model performance rankings (Chatbot Arena ELO)
7. **China-Optimized**: Track domestic payment methods and accessibility

## Development Notes

- Use SSG/ISR for SEO-critical pages (pricing tables, plan comparisons)
- i18n: English (en) and Chinese (zh) via `next-intl`, configs in `src/i18n.ts`, messages in `messages/*.json`
- Routes follow `/[locale]/` pattern (e.g., `/en/compare/plans`, `/zh/api-pricing`)
- `proxy.ts` middleware handles locale-based routing - redirects `/` to `/{locale}` for non-API paths
- `lib/currency.ts` and `lib/currency-conversion.ts` handle multi-currency price display (USD/CNY)
- Price data requires regular updates via scheduled scraping tasks
- Include benchmark scores (MMLU, HumanEval, Chatbot Arena ELO) in product data
- Track regional availability and payment methods (支付宝/微信 for China)

## Project Structure

```
src/
├── app/[locale]/         # Next.js App Router with i18n locale segment
│   ├── api/             # API routes
│   │   ├── products/[slug]/channels/  # Core: same model across channels
│   │   ├── compare/plans/            # Subscription plan comparison
│   │   ├── channels/:productId        # All channels for a model
│   │   └── exchange-rates/            # Currency conversion data
│   └── compare/plans/   # Plan comparison UI pages
├── components/          # React components (Shadcn/UI)
├── db/
│   └── schema/index.ts  # Drizzle ORM schema definitions
├── lib/
│   ├── db.ts            # Drizzle connection
│   ├── supabase.ts      # Supabase client for API routes
│   ├── currency.ts      # Currency utilities
│   └── exchange-rates.ts # Exchange rate fetching/caching
├── i18n.ts              # next-intl config
scripts/
├── scrapers/            # Provider-specific pricing scrapers
│   ├── base-scraper.ts  # Base scraper class
│   ├── base-fetcher.ts  # HTTP client with retry logic
│   ├── base-parser.ts   # HTML parsing utilities
│   ├── benchmark-arena.ts # Chatbot Arena scores
│   ├── *-dynamic.ts     # Dynamic scrapers (28+ providers)
│   └── openrouter.ts    # OpenRouter aggregator pricing
├── index-dynamic.ts     # Runs all dynamic scrapers
└── fetch-provider-logos.ts # Download provider logos
messages/
├── en.json              # English translations
└── zh.json              # Chinese translations
```

## Dynamic Scraper Architecture

The scraper system uses a base class pattern with built-in fallback to hardcoded data:

```
base-fetcher.ts     # HTTP client with retry logic and exponential backoff
base-parser.ts      # HTML parsing utilities (price parsing, card parsing, rate limiting)
base-scraper.ts     # Base scraper class for all provider scrapers
```

Scraper types:
- **API-based**: Fetch from `/v1/models` endpoints with auth, fallback to hardcoded data on 401/403
  - DeepSeek, OpenRouter, SiliconFlow, Together AI
- **HTML-based**: Parse pricing pages, fallback to hardcoded data on parse failure
  - OpenAI, Google Gemini, AWS Bedrock, Azure OpenAI, Vertex AI
- **Official providers**: Direct provider pricing pages
  - Anthropic, Mistral, Moonshot, Minimax, Zhipu, Qwen, Hunyuan, Baidu ERNIE, StepFun

To add a new scraper:
1. Extend `BaseScraper` from `base-scraper.ts`
2. Implement `fetchData()` method
3. Add fallback data for when fetch fails
4. Register in `scripts/index-dynamic.ts`

For detailed scraper documentation, see `scripts/scrapers/DYNAMIC_SCRAPERS.md`.

### 核心对比场景 (Same Open-Source Model API Comparison)

```
场景1: "我想用 Claude Sonnet，哪个渠道最便宜？"
  → 官方 API vs AWS Bedrock vs Google Vertex vs OpenRouter vs 硅基流动 vs 火山引擎

场景2: "DeepSeek V3 API 价格"
  → 官方 vs 硅基流动 vs 火山引擎 vs OpenRouter 价格对比

场景3: "Llama 3.1 405B 哪个渠道最便宜？"
  → 官方 vs Together AI vs Fireworks vs 硅基流动 vs OpenRouter

场景4: "国内有没有便宜的 GPT-4 级别 API？"
  → DeepSeek V3 / 通义千问 Qwen-Max 等国内平替方案 vs 硅基流动/火山引擎
```

### 供应商渠道类型 (Channel Types)

- **official**: 官方直连 (OpenAI, Anthropic, DeepSeek 官方)
- **cloud**: 云厂商 (Azure OpenAI, AWS Bedrock, Google Vertex AI)
- **aggregator**: 聚合平台 (OpenRouter, 硅基流动)
- **reseller**: 转售商 (火山引擎, 阿里百炼)

## Data Fields

Important entity fields to maintain:

- **Plans**: pricingModel (subscription/token_pack/pay_as_you_go), tier (free/basic/pro/team/enterprise), dailyMessageLimit, rateLimit, accessFromChina, paymentMethods
- **Products**: type (llm/subscription/coding_tool), contextWindow, benchmark scores
- **Channels**: type (official/cloud/aggregator/reseller), accessFromChina, region (global/china)
- **ChannelPrices**: inputPricePer1m, outputPricePer1m, cachedInputPricePer1m, rateLimit, isAvailable, lastVerified
  - 核心对比字段：同一模型在不同渠道的 input/output 价格对比
  - 计算字段：estimatedCost (轻度/中度/重度使用预估), savingsVsOfficial (比官方便宜%)

## Key Comparison Architecture

The core "same model across channels" comparison spans multiple layers:
1. **Scrapers** (`scripts/scrapers/*-dynamic.ts`) fetch pricing from provider APIs/websites with fallback to hardcoded data
2. **Database** stores `product_id` ↔ `channel_id` ↔ pricing via `channel_prices` table
3. **API** (`/api/products/[slug]/channels`) queries all channels for a given model slug
4. **Frontend** (`src/app/[locale]/api-pricing/page.tsx`) displays comparison table with:
   - Input/output per-1M prices
   - Rate limits (RPM, QPS)
   - Channel type badges (official/cloud/aggregator)
   - Savings vs official pricing
   - Regional availability (China access)

For API pricing queries, always check `channel_prices` table filtered by `productId` and `channel.isAvailable = true`.
