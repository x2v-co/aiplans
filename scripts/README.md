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
  Exit code 1 on critical findings; warnings pass (exit 2 only with `--strict`).
  C18 `plans.mapping_drift` is a warning with counts and example missing/stale
  models. Scheduled mappings are dry-run only; drift needs a reviewed manual
  run with `PLAN_MAPPINGS_APPLY=1` and does not fail the scheduled job.

- **`fix-data-audit.ts`** — idempotent surgery on `api_channel_prices`.
  Three sections: UPDATES (ground truth from web research),
  DISABLES (`is_available=false` for unfixable rows), NEW_MODELS
  (create missing core models + their producer prices).

- **`fix-plans-audit.ts`** — same idea for `plans`:
  REASSIGN orphan `provider_id`, UPDATE prices, DELETE obsolete rows,
  INSERT new plans with `source='manual'` protection.

Both fix scripts support `--dry-run`.

`npx tsx scripts/refresh-openai-plans.ts --fetch-only` reviews live official
OpenAI sources without database access. Without flags it previews database
changes; only `--apply` writes. See [OpenAI plan verification](../docs/openai-plan-verification.md)
for evidence capture, guarded replay, backups, and the current renewal path.
Plan freshness auditing includes manually curated rows; stale or missing
verification triggers alerts and can alert again after a resolved plan ages.

## Migrations

`migrate-data-accuracy.ts` runs idempotent schema/data migrations against
`DATABASE_URL` via the `postgres` client. They currently cover:

1. `price_history` and `clicks` tables
2. `plans.notes`, `plans.is_contact_sales`, and `plans.source`
3. plan metadata backfills and manual-source protection
4. SGD currency constraints and seed rates
5. retirement or correction of known stale provider/model rows

Re-run any time; all steps use `IF NOT EXISTS` / no-op guards.

The Gemini introductory-price migration and Argon seed are documented in
[`docs/gemini-4-argon.md`](../docs/gemini-4-argon.md), including rollout order,
field-level dry-run output, the Pacific cutoff assumption, and operator commands.
The optional `seed-google-ai-pro-argon-2026-10-17.ts` corrects existing Argon notes
and only the `google-ai-pro` selector for AI Studio Build/Playground access
(including trials; Gemini App unconfirmed). It defaults to read-only dry-run,
requires `--apply` for writes, and never changes prices. See the same document.

`npm run seed:glimpse-decider` previews the 2026-10-17 Elorian Glimpse and
Perplexity Decider V1.2 seeds (models and four channel-price rows). It uses a
serializable, read-only transaction by default; only `--apply` writes. Missing
providers appear as planned inserts, with negative preview IDs. Existing
`vercel` / `vercel-ai-gateway` identities are reused; ambiguous identities abort.
This optional seed is not wired into deployment or scraping. Glimpse's context
differs by channel (OpenRouter 262144, Vercel 220000), so both values are retained
in channel notes. Decider output is verified $0; cache/task rates stay unknown.

`seed-mistral-large-4-promo.ts` updates only the existing Mistral official
`mistral-large-4` channel (requires the introductory-price migration). Default
and `--dry-run` use a read-only serializable transaction with field-level changes;
only `--apply` writes. Missing or duplicate identities abort. Third-party channels
are untouched. The official model page's `originalPrice` fields were verified on
2026-10-17: current input/output/cache $0.68/$2.09/$0.07, regular
$1.36/$4.18/$0.14 per 1M tokens. The launch discount is 50%; its end date is
unpublished, so `promo_ends_at` stays null and notes defer to the official page.
Preview against an explicitly configured non-production database with
`npx tsx scripts/seed-mistral-large-4-promo.ts`.

Reflection Beam's optional Vercel channel seed is documented in
[`docs/reflection-beam.md`](../docs/reflection-beam.md). `npm run seed:reflection-beam`
defaults to a read-only database preview; only an explicit `--apply` writes.
It reuses the existing Beam model and records upstreams in price variants.

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

## Task benchmarks

`ingest-artificial-analysis-benchmarks.ts` reads the public Artificial Analysis
model leaderboard and imports GPQA Diamond, Humanity's Last Exam, SciCode,
Terminal-Bench Hard, IFBench, and MMMU-Pro as separate percentage metrics. It
does not import or calculate a composite score. Every row retains its benchmark,
version, task, metric, source URL, and snapshot date. Run `npm run
ingest:benchmarks -- --dry-run` to validate the upstream payload without a
database write.

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

- **`planprice-api-scraper.timer`** — API pricing and new-model refresh every
  4 hours at 01/05/09/13/17/21:15 Asia/Singapore (plus up to 10 minutes
  randomized delay)
- **`planprice-scraper.timer`** — full daily refresh at 03:15 Asia/Singapore
  (plus up to 15 minutes randomized delay)
- **`run-scrapers.sh`** — refreshes API prices, plans, Agent Arena scores, and
  runs the data audit inside the private Compose network; API-only timer uses
  skip flags to bypass plans, audits, and benchmark ingestions
- **`scrape-pricing.yml`** — manual recovery only
- **`data-audit.yml`** — pull-request and manual audit workflow

The OpenAI review pipeline has a separate `OPENAI_REVIEW_APPLY=1` opt-in,
independent of `SKIP_PLANS`. On October 28, production on `x2v-global` retains
`SKIP_PLANS=1` and has not enabled that opt-in because direct source fetches
intermittently return 403. A daily 04:00 Asia/Singapore Codex heartbeat collects
fresh official evidence locally and runs guarded production review operations;
see the [runbook](../docs/openai-plan-verification.md#scheduling) for prerequisites
and failure handling.

The deployment workflow installs and restarts the systemd timer after each
successful release. Do not expose PostgreSQL publicly for GitHub-hosted runners.
