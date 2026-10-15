# Quota estimates and official text monitoring

This is internal data infrastructure. It adds no pages, displayed estimates, plan prices, automatic migration registration, or scheduled jobs. Plan quotas must come from evidence reviewed for this project. The external methodology reference informed the calculation approach only; none of its vendor quota values, prices, multipliers, or adoption decisions are imported.

## Calculation method

The comparison assumes full utilization and defines one month as exactly four weeks. Real unit price is monthly subscription fee in USD divided by usable monthly tokens, multiplied by one million. It describes the cost when the allowance is used fully; it does not predict an individual's consumption.

`src/lib/quota/engine.ts` is pure and uses explicit inputs:

- `blendedPricePerMTok(prices, mix)` weights fresh input, cached input and output list prices, all USD per million tokens. Mix fields `cacheReadPct`, `inputPct`, and `outputPct` are percentages summing to 100. Categories are mutually exclusive: cached input must not be counted again as fresh input.
- `realUnitPrice(fee, monthlyTokens)` returns USD per million tokens. A zero fee is valid; a zero token denominator is not.
- `weeklyToMonthly(value)` multiplies by four. `windowToWeekly(value, windowKind, windowsPerWeek?)` requires an explicit positive `windowsPerWeek` for both `5h` and `daily` windows. Choose and record a realistic usage assumption; the engine supplies no implied daily count or back-to-back reset count. A monthly window converts to weekly by dividing by four.
- `measuredQuota({...})` accepts token counts by category, list prices, a target mix, and **consumed** quota percentages before and after a measurement within the same reset window. Convert a remaining-percentage display to consumed percentages first. It values the measured tokens at list prices, divides by the percentage-point increase to obtain USD per 1%, multiplies by 100 for the window value, converts to weekly and then monthly value, and divides by the target blended price for monthly tokens. It returns `{low, high}` for monthly tokens plus the intermediate USD ranges. The measured mix and the target comparison mix need not match.
- Rounding uncertainty defaults to ±0.5 percentage points **per reading**. The two readings therefore permit up to ±1 point in their difference, clipped to the meter's 0–100 bounds. A delta whose uncertainty reaches zero is rejected; take a larger sample or supply a justified smaller uncertainty. This interval covers meter rounding only, not account variation, shared-pool activity, missing token categories, model changes or uncertainty in list prices.
- `applyMultiplier({value, windowKind}, {factor, windowKind})` preserves the reset window and throws on a mismatch. A vendor's short-window multiplier cannot establish a weekly multiplier. Keep independent constraints separate; a short-window extrapolation alone cannot establish an account's weekly cap.
- `toRange(low, high?)` rounds endpoints to two significant figures for presentation; `orderOfMagnitude(value)` labels the nearest decade, such as `~10M` or `~100M`. Keep full precision for calculations and persisted estimates.

The migration seeds two project assumptions requested for comparison: high-cache coding (97% cache reads, 2.5% fresh input, 0.5% output), and typical chat (0%, 75%, 25%). The chat mix is our own assumption, not a vendor claim or measured population average. Neither seed is a subscription quota. Cache-write fees are not separately modeled in this three-category engine; record their omission or an explicitly justified input-price treatment in the estimate notes.

## Tables and review workflow

`drizzle/0005_quota_estimates.sql` creates four tables, with matching Drizzle exports in `src/db/schema/quota.ts`:

| Table | Purpose |
| --- | --- |
| `usage_mixes` | Named comparison workloads; nonnegative percentages must sum to 100. |
| `quota_estimates` | Versioned token ranges by plan slug, served model, reset window and mix. Optional `plan_id` references existing `plans.id`; retain `plan_slug` for traceability. Confidence is `high`, `medium` or `low`; `verified_at` records actual review. |
| `quota_evidence` | Measurements, official absolute allowances, official text, community reports and derivations, with source URL, capture date, raw value, optional screenshot and notes. Both estimate link and plan slug may be null for pending source-level evidence spanning multiple plans. |
| `quota_text_snapshots` | Unique normalized content versions per source and SHA-256 hash, with last observation time, change flag and optional successful-alert timestamp. |

Keep estimates as history. In a transaction, lock the current row for the same plan/model/window/mix, insert its replacement with `is_current=false`, set the old row's `is_current=false` and `superseded_by` to the replacement ID, then set the replacement's `is_current=true`. If no row exists, insert the initial current row. The partial unique index permits only one current row per identity (null served model is treated as empty). Concurrent initial inserts may need to retry on a unique violation. Do not overwrite historical token ranges. Attach supporting evidence to the relevant version and explain derivations and assumptions in its notes.

Use confidence to express evidence quality: direct controlled measurements or explicit official allowances can justify high; reproducible but incomplete measurements may justify medium; community statements and unverified derivations remain low. Record conflicting evidence instead of silently selecting a favorable value. Automated text changes create evidence for review; they do not update estimates or establish a quota.

## Manual monitor

```bash
npm run quota:monitor                         # default dry-run
npm run quota:monitor:dry-run -- --source=claude-usage
npm run quota:monitor -- --apply --source=claude-usage
```

The source IDs and official URLs live in `scripts/config/quota-text-sources.ts`. Fetch uses a 30-second timeout. HTML extraction removes scripts, styles and hidden payload containers, keeps block boundaries and table rows, normalizes whitespace and metadata dates/nonces, then selects quota-related lines in English or Chinese. Dates in quota and promotion prose are preserved so a changed expiry can be reviewed. Full client rendering is not attempted; errors and empty quota extractions are logged, skipped and return a failing status. Operators should inspect failures and revise extraction or the official URL. Plain fetch may miss client-rendered content even on a successful page.

Dry-run makes no DB writes and sends no Telegram messages. If `DATABASE_URL` is available, it reads the latest snapshot for diffs and deduplication; otherwise it prints a preview without a stored baseline. An existing DB must have migration 0005 before DB-backed monitoring. Do not use production dry-run as a substitute for migration review.

For `--apply`, provide `DATABASE_URL` and `AIPLANS_TG_BOT_TOKEN` through the operator's environment. `AIPLANS_TG_CHAT_ID` defaults to `6217573976`. The existing `.env.local` loader and audit PostgreSQL client are reused. No env files are created or edited. A missing token logs a skip and exits zero before database access or fetching.

The first snapshot is a silent baseline. A new hash after the baseline inserts a changed snapshot and one `official_text` evidence row with notes exactly `pending review`; its estimate link and plan slug await human review. Telegram messages start with `[aiplans]`, identify the source and URL, and include a bounded line diff. Content versions are unique by `(source_id, content_hash)`. Revisiting an already-alerted hash or the baseline does not alert again; it refreshes `fetched_at` so the next diff uses the last observed text. Thus `fetched_at` means last observation, not immutable first-capture time.

An advisory transaction lock serializes runs per source. Failed Telegram deliveries leave a pending alert and commit evidence; a later observation of that hash retries without duplicating evidence. Delivery failures log and do not fail the run, following the audit-alert convention. As with the existing alert pattern, a process/DB failure after Telegram accepts a message but before its timestamp commits can cause a retry delivery; Telegram's API offers no transactional exactly-once guarantee.

## SRE rollout (manual, approval required for applying SQL)

1. Review the additive SQL locally. A safe, offline dry-run is to print the exact migration and run its SQL-structure test:

   ```bash
   cat drizzle/0005_quota_estimates.sql
   npx tsx --test src/db/schema/quota.test.ts
   ```

   This does not connect to any database. The migration contains only new tables/indexes and conflict-safe seeds into the new mixes table. Like 0003/0004, it has no Drizzle journal entry. Unlike those migrations, it is deliberately absent from `scripts/migrate-data-accuracy.ts` so the production auto-deploy runner cannot apply it.

2. Obtain the user's explicit confirmation for applying **0005 to the named target database**, after reviewing the dry-run SQL. No database migration was executed during implementation. Do not run the general `npm run migrate` as part of this rollout.

3. Only after confirmation, an operator with the target database credentials can apply just this file atomically:

   ```bash
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction --file=drizzle/0005_quota_estimates.sql
   ```

4. Preview a selected official source with `quota:monitor:dry-run`, inspect extracted lines, then manually invoke `quota:monitor -- --apply` to establish the silent baseline. Review later pending evidence before creating or superseding estimates. The schema can remain unused by the app safely.

5. Keep monitoring manual for this change. An optional timer can be considered in a separate, explicitly approved deployment change. This change installs/enables no timer and does not alter anything under `deploy/`.

## Offline validation

```bash
npx tsc --noEmit
npx tsc --noEmit -p scripts/tsconfig.quota.json
npx tsx --test src/db/schema/quota.test.ts src/lib/quota/engine.test.ts scripts/utils/quota-text-monitor.test.ts scripts/quota-text-monitor.test.ts
npm run lint -- src/db/schema/index.ts src/db/schema/quota.ts src/db/schema/quota.test.ts src/lib/quota/engine.ts src/lib/quota/engine.test.ts scripts/config/quota-text-sources.ts scripts/utils/quota-text-monitor.ts scripts/utils/quota-text-monitor.test.ts scripts/quota-text-monitor.ts scripts/quota-text-monitor.test.ts
```

The dedicated script TypeScript config covers the new monitor files because the app's root config excludes `scripts/`. Tests use synthetic arithmetic, HTML fixtures and injected clients; they require no network or database. CI runs all new test files and both TypeScript checks.
