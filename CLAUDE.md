# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project Overview

**aiplans.dev** is an AI pricing comparison platform. Two core value props:

1. **API Token Price Comparison** — same model across many channels (OpenAI
   official vs Azure vs AWS Bedrock vs OpenRouter vs SiliconFlow vs 火山引擎)
2. **Subscription Plan Comparison** — ChatGPT Plus vs Claude Pro vs Gemini
   Advanced, including free/pro/team/enterprise tiers and annual savings

Everything is keyed off three tables: `providers`, `models`, `plans`, with
`api_channel_prices` joining models × providers and `model_plan_mapping`
joining models × plans.

## Development Commands

```bash
# Frontend
npm run dev              # next dev (localhost:3000)
npm run build            # production build (webpack)
npm run start            # serve prod build
npm run lint             # eslint

# Data scraping (writes to production Supabase)
npm run scrape              # all API price scrapers (~20 providers, ~1 min)
npm run scrape:plans        # all plan scrapers (~12 providers, ~2 min)
npm run scrape:plans:dry-run

# Data accuracy — read-only audit, safe
npm run audit               # 13 checks, exits 1 on critical, 2 on warnings
npm run audit:verbose       # show all findings (not just first 8 per check)
npm run audit:json > out.json

# Data accuracy — surgical fixes
npm run fix:data:dry-run    # preview api_channel_prices fixes
npm run fix:data            # apply them (idempotent)
npm run fix:plans:dry-run   # preview plan fixes (reassign/update/delete/insert)
npm run fix:plans           # apply

# Schema migrations (idempotent postgres DDL)
npm run migrate             # adds price_history, plans.notes, plans.source, etc.

# Arena leaderboard ingestion (requires SUPABASE_SERVICE_KEY)
npm run ingest:arena        # writes top-60 ELO into model_benchmark_scores

# Provider logos
npm run fetch-logos
npm run fetch-logos:force

# Drizzle ORM (schema only — we don't use drizzle for queries)
npx drizzle-kit generate    # emit SQL migrations from schema
npx drizzle-kit studio      # DB GUI
```

## Technology Stack

- **Frontend**: Next.js 16 (App Router, webpack), TypeScript, TailwindCSS v4,
  Shadcn/UI, Recharts (price charts), Zustand (state), next-intl (i18n)
- **Backend**: Next.js API Routes + Supabase JS client (direct queries, not
  Drizzle — we only use drizzle-orm for its schema DSL)
- **Database**: PostgreSQL on Supabase
- **Deployment**: Vercel (with data-audit.yml + scrape-pricing.yml GitHub Actions)

## Database Schema (Core)

```
providers ──┬── api_channel_prices ── models
            │                             │
            └── plans ── model_plan_mapping
                                          │
           price_history ────── (audit trail, tied to api_channel_prices.id)

benchmarks ── benchmark_versions ── benchmark_tasks ── model_benchmark_scores
                                                              │
                                                         models ┘
```

Key tables:

- **providers** — OpenAI / Anthropic / aggregators / cloud / resellers.
  `type ∈ (official | producer | cloud | aggregator | reseller)`.
  `region ∈ (china | global)`, `access_from_china boolean`.
- **models** — GPT-4o, Claude Opus 4.6, etc. `provider_ids integer[]`.
- **api_channel_prices** — `(model_id, provider_id) → input/output_price_per_1m`.
  `currency`, `price_unit`, `is_available`, `last_verified`, `notes`.
- **plans** — subscription tiers. `source ∈ (scraper | manual)` — `manual` rows
  are protected from scraper cleanup (see "Plan safety" below).
- **model_plan_mapping** — `(model_id, plan_id)` junction with `priority`.
- **price_history** — audit trail from `logPriceChange()` in `queries.ts`.
- **model_benchmark_scores** — Arena ELO and other benchmark values, joined
  via `benchmark_tasks` + `benchmark_metrics` (filter `name='ELO'` for Arena).

Schema source of truth: `src/db/schema/index.ts` (Drizzle). Migrations
applied via `scripts/migrate-data-accuracy.ts` using raw SQL + `postgres`
client. Supabase MCP plugin is NOT required.

## Environment Variables

Required (in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
DATABASE_URL                   # for direct postgres migrations
SUPABASE_SERVICE_KEY           # optional — required for catalog writes
                               # (benchmark_metrics, etc. — RLS restricted)
```

## Page Routes (all under `/[locale]/` with `en` and `zh`)

| Route | Purpose |
|---|---|
| `/[locale]` | Landing page |
| `/[locale]/api-pricing` | **Core SEO** — API token price comparison across channels |
| `/[locale]/models/[slug]` | **Core SEO** — one page per model, all channels, Arena ELO |
| `/[locale]/plans` | All providers with plans (index) |
| `/[locale]/plans/[provider]` | One provider's full plan lineup |
| `/[locale]/compare/plans` | Plan comparison landing + FAQ |
| `/[locale]/compare/plans/[model]` | All plans that include a specific model |
| `/[locale]/coupons` | Community discount codes |

`src/proxy.ts` middleware redirects any non-locale path `/foo` → `/{locale}/foo`
where `{locale}` is from the `NEXT_LOCALE` cookie or defaults to `en`.

There are **no** non-locale fallback routes (`src/app/api-pricing`,
`src/app/plans`, etc.) — they were deleted in the 2026-04 cleanup because
middleware made them unreachable anyway.

## Core API Routes (used by frontend)

```
/api/products/grouped          # /api-pricing reads this — models + all channels, grouped
/api/products                  # full model listing with benchmarks
/api/products/[slug]/channels  # per-model channel prices (fallback route)
/api/channels/[productId]      # legacy alias of above
/api/compare/plans             # /compare/plans/[model] reads this
/api/plans                     # plan listing
/api/coupons                   # discount codes
/api/exchange-rates            # currency conversion data
/api/providers                 # provider metadata (static, 5m revalidate)
```

## Dynamic Scraper Architecture

### Write boundary — `scripts/db/queries.ts`

`upsertChannelPrice()` validates every write:
- rejects null / negative prices
- rejects `output < input` (physically impossible for LLM per-token pricing)
- writes `currency` + `price_unit` (long-standing bug pre-2026-04 was that
  these params were accepted but never written, so siliconflow CNY values
  ended up tagged as USD)

`logPriceChange()` writes to `price_history` on every significant change
(>20%) during a scrape run. Soft-fails so logging errors don't break the
pipeline.

### NO FALLBACK DATA principle

Every scraper returns `success: errors.length === 0 && prices.length > 0`.
No hardcoded price arrays, no fallback to stale data. If the source page
changes, the scraper fails loud and `audit-data.ts` surfaces the staleness.

### `KnownModelsExtractor` base class (`scripts/scrapers/lib/known-models-extractor.ts`)

5 core scrapers (openai, deepseek, qwen, hunyuan, mistral) use a shared
base that handles:
- KNOWN_MODELS list with regex pattern + min/max price ranges
- Playwright navigation + `domcontentloaded` wait
- Two extraction modes:
  - `labeled` — `Input:$X / Output:$X` style (OpenAI, Anthropic)
  - `positional` — find all numbers, match by range (CN vendors, Mistral)
- Currency tagging (USD / CNY)
- Collision dedupe (when multiple arena rows map to same DB slug)

Each subclass supplies: `getSourceName()`, `getSourceUrl()`, `models()`,
optionally `extractMode()`, `currency()`, `numberRegex()`, `labels()`,
`modelHeaderRegex()`, `waitAfterNav()`.

Adding a new scraper:
1. Extend `KnownModelsExtractor` (preferred) or `PlaywrightScraper`
2. Define KNOWN_MODELS with regex + price ranges
3. Register in `scripts/index-dynamic.ts` (or `index-plans-dynamic.ts`)

### `plan-*-dynamic.ts` scrapers

Plan scrapers use `fetchHTMLSmart` which auto-routes to Playwright for
JS-heavy domains (whitelist in `base-fetcher.ts` JS_HEAVY_DOMAINS).
`cleanupOutdatedPlans()` in queries.ts is **log-only** as of 2026-04 —
scraper misses never delete existing rows; the audit's `plans.stale`
check surfaces them after 30 days instead.

Disabled plan scrapers (return `{ success: true, plans: [] }`):
- `plan-moonshot-dynamic.ts` — API docs page, not subscription; Kimi+
  member center is auth-walled
- `plan-baidu-dynamic.ts` — ERNIE went fully free 2025-04-01
- `plan-volcengine-dynamic.ts` — prices load via JSON API post-hydration

## Plan safety: `source` column

The `plans.source` column was added to stop a destructive pattern: when a
plan scraper's regex failed to match a plan, `cleanupOutdatedPlans()` would
delete that row. It wiped 9 legit plans in one run (chatgpt-pro, claude-max,
etc.) before we caught it.

Now: every row is `source='scraper'` by default, and manually-curated rows
(via `fix-plans-audit.ts NEW_PLANS`) are `source='manual'`. Manual rows are
immune to `cleanupOutdatedPlans`. To add a new manual plan, put it in the
`NEW_PLANS` array in `fix-plans-audit.ts` and run `npm run fix:plans`.

## Data Accuracy Infrastructure

Three scripts form the feedback loop:

1. `scripts/audit-data.ts` — 13 read-only checks:
   `prices.zero_or_null`, `prices.output_lt_input`, `prices.input_eq_output`,
   `prices.cross_channel_outlier` (USD-normalized), `prices.stale`,
   `models.no_channel_price`, `models.no_producer_channel`,
   `models.unknown_provider_id`, `plans.stale`, `plans.missing_verified`,
   `providers.unknown_ref`, `mapping.orphan_model`, `mapping.orphan_plan`.
   Exit code 0 = clean, 1 = critical, 2 = warnings only.

2. `scripts/fix-data-audit.ts` — idempotent UPDATES / DISABLES /
   NEW_MODELS for api_channel_prices, from web-verified ground truth.

3. `scripts/fix-plans-audit.ts` — same pattern for `plans`:
   REASSIGN orphan `provider_id`, UPDATE prices, DELETE obsolete,
   INSERT missing (all `source='manual'`).

Fourth helper for CN-producer channels that aren't scraped directly:
`scripts/fix-cn-producer-channels.ts` — seeds GLM / Kimi direct-channel
rows from web ground truth so `/api-pricing` filter "🇨🇳 China" shows them.

### GitHub Actions

- `.github/workflows/scrape-pricing.yml` — hourly cron, runs `npm run scrape`
- `.github/workflows/data-audit.yml` — daily 02:00 UTC + PR-triggered,
  runs `audit-data.ts`; fails on critical; uploads output + JSON snapshot
  as artifacts

Both need these repo secrets: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`.

## SEO / GEO (done in 2026-04 session)

- Per-page `generateMetadata` via `buildMetadata()` in `src/lib/seo.ts`
  (canonical, hreflang `en`/`en-US`/`zh-CN`/`zh-Hans`/`x-default`, OG, Twitter)
- Root `/[locale]/layout.tsx` uses `generateMetadata({ params })` so `/en`
  and `/zh` roots get per-locale canonical + Chinese titles
- Per-route dynamic OG images via `opengraph-image.tsx` (next/og):
  `/[locale]`, `/[locale]/api-pricing`, `/[locale]/models/[slug]`,
  `/[locale]/plans`, `/[locale]/plans/[provider]`, `/[locale]/compare/plans`,
  `/[locale]/compare/plans/[model]` — each fetches real data (model name,
  ELO, lowest price, channel count) and renders a 1200×630 card
- JSON-LD on `/[locale]/models/[slug]`: `Product` + `AggregateOffer` +
  per-channel `Offer[]` (seller, price, currency) + Arena ELO as
  `additionalProperty` + `BreadcrumbList`
- JSON-LD on `/[locale]/plans/[provider]`: `BreadcrumbList` +
  `Product/Offer` per plan (with `is_contact_sales` for enterprise tiers)
- Baidu / 360 / Sogou rendering hints in layout.tsx `metadata.other`
  (`applicable-device`, `MobileOptimized`, `HandheldFriendly`). Baidu site
  verification is a placeholder in `metadata.other` comment — uncomment and
  add the token once the site is registered at https://ziyuan.baidu.com/
- Sitemap (`src/app/sitemap.ts`) fully DB-driven: every provider
  (`/plans/[provider]`) + up to 500 LLM models (`/models/[slug]`)

## Performance tuning (next.config.ts)

- `experimental.optimizePackageImports` for `lucide-react` + 12 Radix
  packages — saves ~150KB pre-gzip on every client bundle
- `compiler.removeConsole` in production (keeps error/warn)
- `images.remotePatterns` whitelists Supabase + vendor logo hosts so
  `next/image` can serve AVIF/WebP with Vercel's image CDN
- `poweredByHeader: false`

## Project Structure

```
src/
├── app/[locale]/              # all user-facing routes (i18n)
│   ├── layout.tsx             # root layout with generateMetadata
│   ├── page.tsx               # landing
│   ├── api-pricing/           # token price comparison
│   ├── compare/plans/[model]/ # plan comparison per model
│   ├── coupons/
│   ├── models/[slug]/         # core model detail page
│   ├── plans/[provider]/      # provider plan lineup
│   └── opengraph-image.tsx    # per-route OG card generator
├── app/api/                   # API routes
├── app/sitemap.ts             # DB-driven sitemap
├── components/                # shadcn/ui
├── db/schema/index.ts         # Drizzle schema (source of truth)
├── lib/
│   ├── db.ts                  # postgres + drizzle client
│   ├── supabase.ts            # anon-key client for API routes
│   ├── currency.ts            # format helpers
│   ├── currency-conversion.ts # exchange-rate cache
│   ├── schema-adapters.ts     # provider attachment helpers
│   ├── seo.ts                 # buildMetadata + JSON-LD builders
│   └── og-template.tsx        # shared OG image React template
├── proxy.ts                   # next-intl locale redirect middleware
└── i18n.ts                    # next-intl config

scripts/
├── index-dynamic.ts           # all API price scrapers
├── index-plans-dynamic.ts     # all plan scrapers
├── audit-data.ts              # read-only accuracy audit
├── migrate-data-accuracy.ts   # idempotent schema migrations
├── fix-data-audit.ts          # surgical fixes for api_channel_prices
├── fix-plans-audit.ts         # surgical fixes for plans
├── fix-provider-regions.ts    # one-shot region classification
├── fix-cn-producer-channels.ts # GLM/Kimi direct channel seeds
├── fix-siliconflow-currency.ts # one-shot historical repair
├── fix-currency-on-patched-rows.ts # one-shot currency alignment
├── ingest-arena-leaderboard.ts # ingest top-60 Arena scores
├── add-arena-missing-models.ts # stub models for arena coverage
├── add-model-plan-mappings.ts  # populate model_plan_mapping from config
├── debug-core-snapshot.ts      # ops snapshot
├── debug-plans-snapshot.ts     # ops snapshot
├── fetch-provider-logos.ts     # provider logo sync
├── config/plan-model-slugs.ts  # plan → [model slugs] registry
├── db/queries.ts               # shared upsertChannelPrice / logPriceChange
├── scrapers/
│   ├── base-fetcher.ts         # HTTP + Playwright + JS_HEAVY_DOMAINS
│   ├── base-parser.ts          # shared parsing utilities
│   ├── lib/
│   │   ├── playwright-scraper.ts    # Playwright wrapper base class
│   │   └── known-models-extractor.ts # refactored base (5 scrapers use it)
│   ├── {openai,deepseek,qwen,hunyuan,mistral}-dynamic.ts  # uses KnownModelsExtractor
│   ├── {anthropic,google-gemini,grok,seed,siliconflow,…}-dynamic.ts
│   ├── plan-{openai,anthropic,mistral,qwen,...}-dynamic.ts
│   └── openrouter.ts           # separate API-based scraper
└── utils/                      # model-normalizer, validator, plan-validator

messages/
├── en.json
└── zh.json
```

## Channel Types (taxonomy)

- **official / producer** — model creator's own API (OpenAI, Anthropic,
  DeepSeek). `producer` is the legacy spelling; both are normalized to
  `official` at render time.
- **cloud** — Azure OpenAI, AWS Bedrock, Google Vertex AI
- **aggregator** — OpenRouter, SiliconFlow, Together AI, Fireworks,
  Replicate, Anyscale
- **reseller** — DMXAPI, 阿里云百炼 (via seed provider), etc.

## Key Comparison Flows

1. **Same model across channels** (core SEO):
   - `/api/products/grouped` → rollup by base slug → frontend table
2. **Subscription plan comparison**:
   - `/api/compare/plans?model=X` → model_plan_mapping join → tiers
3. **Provider plan lineup**:
   - `/[locale]/plans/[provider]` server component directly queries Supabase

## China-specific behaviour

- `providers.region` classifies each provider as `china` or `global`.
  `fix-provider-regions.ts` has the curated list.
- `providers.access_from_china` reflects whether a user physically in
  mainland China can reach the API. The "China Access Only" filter on
  `/api-pricing` also falls back to the model's primary producer region,
  so GLM / Kimi surface even when only aggregator channels are tracked.
- `formatPrice()` in `src/lib/currency.ts` handles CNY ⇄ USD conversion
  using `lib/exchange-rates.ts`'s cached rates.

## When adding new entities

- **New model**: insert into `models`, set `provider_ids: [producerId]`.
  If you know its ELO, also insert into `model_benchmark_scores` with
  `metric_id = ELO metric id` and `benchmark_task_id = Arena Text task id`.
- **New provider**: insert into `providers`, classify `region` and
  `access_from_china`, add to `fix-provider-regions.ts` if it should be
  curated going forward.
- **New plan**: add the slug + model list to `scripts/config/plan-model-slugs.ts`
  AND to `fix-plans-audit.ts NEW_PLANS`, then run `npm run fix:plans`.

## Common gotchas

- **`upsertChannelPrice` rejects `output < input`** — if a scraper's regex
  accidentally swaps columns, the write fails and you see it in logs. Fix
  the scraper, don't work around the check.
- **`model_plan_mapping` has only `(id, model_id, plan_id, priority)`** —
  no override columns. Plan-level overrides were never materialized.
- **`provider_ids` is a PostgreSQL integer array** on `models`, not a
  foreign-key scalar. Use `provider_ids?.[0]` in TS and `contains` in SQL.
- **The `model_offical` table is misspelled** in the schema (`offical` not
  `official`). Don't "fix" it — the Supabase client queries it by name.
- **`api_channel_prices.model_id`**, not `product_id`. Older code may still
  reference `product_id`; it's a legacy alias.
- **Arena ELO lives in `model_benchmark_scores`**, joined via
  `benchmark_metrics!inner(name).eq('name','ELO')`. Don't join through
  `benchmark_tasks.benchmark_id` — that column doesn't exist.

## Memory for future sessions

`~/.claude/projects/-Users-kl-workspace-x2v-planprice/memory/` contains
persistent notes from prior sessions. Load them when picking up work:

- `data_accuracy_audit.md` — audit infrastructure, known scraper bugs
- `MEMORY.md` — index
