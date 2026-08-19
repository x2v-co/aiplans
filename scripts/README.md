# scripts/

All data-side tooling for aiplans.dev: scrapers, audits, one-shot fixes,
migrations. See `../CLAUDE.md` for the full system overview.

## Setup

```bash
npm install
cp .env.example .env.local   # or create it manually
# .env.local needs:
#   DATABASE_URL               (required for reads, writes, and migrations)
```

## Routine commands

```bash
npm run scrape             # all API-price scrapers, ~1 min
npm run scrape:plans       # all plan scrapers, ~2 min
npm run audit              # read-only accuracy audit
```

Add `:dry-run` to `scrape:plans` to preview without writes.

## Data accuracy tools

The 2026-04 cleanup introduced a full feedback loop:

```
                 scraper → upsertChannelPrice (hardened) → DB
                                  │
                                  └── logPriceChange → price_history
                                                           │
                                                           ▼
                                     audit-data.ts (scheduled read-only check)
                                                           │
                                     ┌─────────────────────┤
                                     ▼                     ▼
                        fix-data-audit.ts       fix-plans-audit.ts
                        (surgical UPDATES)      (REASSIGN + UPDATE +
                                                 DELETE + NEW_PLANS)
```

- **`audit-data.ts`** — 17 read-only checks (zero/null, output<input,
  input==output, cross-channel outliers with USD normalization,
  staleness, orphan mappings, missing producer channel, unclassified
  plans, plans with no models, selectors that resolve to nothing, etc.).
  Exit code 1 on critical findings, 2 on warnings.

- **`fix-data-audit.ts`** — idempotent surgery on `api_channel_prices`.
  Three sections: UPDATES (ground truth from web research),
  DISABLES (`is_available=false` for unfixable rows), NEW_MODELS
  (create missing core models + their producer prices).

- **`fix-plans-audit.ts`** — same idea for `plans`:
  REASSIGN orphan `provider_id`, UPDATE prices, DELETE obsolete rows,
  INSERT new plans with `source='manual'` protection.

Both fix scripts support `--dry-run`.

## Migrations

`migrate-data-accuracy.ts` runs idempotent schema/data migrations against
`DATABASE_URL` via the `postgres` client. They currently cover:

1. `price_history` and `clicks` tables
2. `plans.notes`, `plans.is_contact_sales`, and `plans.source`
3. plan metadata backfills and manual-source protection
4. SGD currency constraints and seed rates
5. retirement or correction of known stale provider/model rows

Re-run any time; all steps use `IF NOT EXISTS` / no-op guards.

## Arena leaderboard

`ingest-arena-leaderboard.ts` reads the live Chatbot Arena Agent leaderboard
with Playwright and upserts Net Improvement percentages into
`model_benchmark_scores`. It falls back to the bundled snapshot only for
`--dry-run`; a production live-fetch failure leaves the previous scores intact.
The homepage and compare page select hot models from these Agent scores and
available model-plan mappings, so no model slug list needs manual maintenance.

Companion: `add-arena-missing-models.ts` creates stub `models` rows
for top-60 entries that don't exist in DB yet, so the ingestion's
slug matcher can link them.

## File layout

```
scripts/
├── audit-data.ts                 # read-only 13-check audit
├── migrate-data-accuracy.ts      # idempotent schema migrations
├── fix-data-audit.ts             # api_channel_prices fixes
├── fix-plans-audit.ts            # plans fixes
├── fix-provider-regions.ts       # one-shot provider region classification
├── fix-cn-producer-channels.ts   # GLM/Kimi direct-channel seeds
├── fix-siliconflow-currency.ts   # historical CNY currency repair
├── fix-currency-on-patched-rows.ts  # historical currency alignment
├── ingest-arena-leaderboard.ts   # Agent Arena score ingestion
├── add-arena-missing-models.ts   # arena stub creation
├── materialize-model-plan-mappings.ts # derives model_plan_mapping from selectors
├── fix-plan-kinds.ts             # backfills plan_kind/line/tier_rank/selector
├── debug-core-snapshot.ts        # ops snapshot of hot models + channels
├── debug-plans-snapshot.ts       # ops snapshot of plans table
├── fetch-provider-logos.ts       # logo sync
├── index-dynamic.ts              # scraper runner for api_channel_prices
├── index-plans-dynamic.ts        # scraper runner for plans
├── config/
│   └── plan-classifications.ts   # plan → kind/line/rank + model_selector
├── db/
│   └── queries.ts                # upsertChannelPrice + logPriceChange
├── scrapers/
│   ├── base-fetcher.ts           # HTTP + Playwright + JS_HEAVY_DOMAINS
│   ├── base-parser.ts            # HTML parsing helpers
│   ├── lib/
│   │   ├── playwright-scraper.ts       # Playwright wrapper base
│   │   └── known-models-extractor.ts   # refactored base for 5 scrapers
│   ├── openrouter.ts             # OpenRouter API scraper
│   ├── *-dynamic.ts              # per-provider API price scrapers
│   └── plan-*-dynamic.ts         # per-provider plan scrapers
└── utils/
    ├── validator.ts              # ScrapedPrice + validatePrice
    ├── plan-validator.ts
    └── model-normalizer.ts
```

## Write boundary contract

`scripts/db/queries.ts` `upsertChannelPrice()` validates every write:

```ts
if (input == null || output == null)        throw
if (input < 0 || output < 0)                 throw
if (output > 0 && output < input)             throw  // physically impossible
write({ currency, price_unit, ... })          // actually persists currency
```

If your scraper gets a legitimate `output < input` case (some image /
audio models), handle it explicitly in the scraper instead of bypassing
the check.

`logPriceChange()` writes to `price_history` on >20% changes. It
soft-fails so logging errors don't break the pipeline.

## Writing a new scraper

Preferred: extend `KnownModelsExtractor` from
`scripts/scrapers/lib/known-models-extractor.ts`. You supply a
`KNOWN_MODELS: KnownModel[]` with regex + min/max price ranges and
override `getSourceName()`, `getSourceUrl()`, `models()`, and
optionally `extractMode()`, `currency()`, `numberRegex()`, `labels()`,
`modelHeaderRegex()`, `waitAfterNav()`. See `openai-dynamic.ts` (68
lines, labeled mode, USD) or `qwen-dynamic.ts` (75 lines, positional
mode, CNY) for minimal examples.

Register your new scraper in `scripts/index-dynamic.ts`.

**NO FALLBACK DATA**: return `success: errors.length === 0 && prices.length > 0`.
Never ship a hardcoded `prices` fallback — `audit-data.ts` is what
surfaces staleness, not in-scraper defaults.

## Scheduling

Production scheduling runs on the VPS through the checked-in systemd service
and timer:

- **`planprice-scraper.timer`** — daily at 03:15 Asia/Singapore (plus up to
  15 minutes randomized delay)
- **`run-scrapers.sh`** — refreshes API prices, plans, Agent Arena scores, and
  runs the data audit inside the private Compose network
- **`scrape-pricing.yml`** — manual recovery only
- **`data-audit.yml`** — pull-request and manual audit workflow

The deployment workflow installs and restarts the systemd timer after each
successful release. Do not expose PostgreSQL publicly for GitHub-hosted runners.
