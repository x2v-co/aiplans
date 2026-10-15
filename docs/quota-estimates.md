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

## Pay-as-you-go list-price baseline

`src/lib/quota/pay-as-you-go.ts` computes the baseline directly from a joined `api_channel_prices` row and a `usage_mixes` workload, using `engine.ts`'s `blendedPricePerMTok`. No subscription purchase or assumed monthly spend is involved:

```text
USD/MTok = (cache-read USD/MTok × cache_read_pct
          + ordinary-input USD/MTok × input_pct
          + output USD/MTok × output_pct) / 100
coding-high-cache: 97 / 2.5 / 0.5
chat:              0 / 75 / 25
```

The seed reads both mixes from `usage_mixes` and checks that they match these assumptions. It includes available, non-retired API channel rows across **all provider types**, including clouds and aggregators, using the same availability and UTC shutdown-date criteria as provider pages. It uses channel headline prices from `api_channel_prices`, not expanded route/tier variants or external model-producer prices. Per-million-token prices are used directly; per-thousand-token prices are multiplied by 1,000. Non-token billing units, unknown/null units or currencies, missing/invalid/negative prices, and missing/invalid/future source verification dates are explicitly reported as skipped. Zero prices are valid. There is no hardcoded provider list or fallback price catalog.

For non-USD rows (including CNY), the script supplies the existing `getExchangeRateSync(currency, 'USD')` rate snapshot to the pure function. Each price is multiplied by that rate and the unit factor before blending. The notes retain the exact factor, original currency/unit/rates, converted rates and conversion method. This reuses the project's synchronous FX cache; it does not fetch live FX or claim the cached rate is a newly verified market rate. Missing cache-read prices use the ordinary input price for the entire cached share, with an explicit note; an explicit zero cache price stays zero. Cache-write fees remain outside this three-category comparison. Introductory prices resolve through `effectivePrice` at the calculation time. Expired promotions require complete regular input/output rates; missing regular cache prices fall back to regular input, never the expired promotional cache rate.

### Representation without a new migration

Existing 0005 constraints are sufficient; no SQL or Drizzle constraint changes are needed:

| Field | PAYG meaning |
| --- | --- |
| `plan_id` | `NULL`; there is no purchased plan or synthetic `plans` row. |
| `plan_slug` | Reserved namespace `payg:<provider-slug>`, e.g. `payg:openrouter`. |
| `served_model` | Exact `models.slug`, retaining distinct models and variants. |
| `window` | `monthly`, solely the existing comparison dimension; no reset or monthly cap is asserted. No new `payg` window value. |
| `est_tokens_low`, `est_tokens_high` | Both exactly `1000000`: a **priced reference basket**, not a token allowance. These must never be displayed or processed as subscription quota. |
| `usage_mix_id` | `coding-high-cache` or `chat`. |
| `confidence` | `high` for direct arithmetic on the channel's stored official list prices; not confidence in a measured workload or allowance. |
| `verified_at` | Source `api_channel_prices.last_verified`, not the seed execution date. Rerunning cannot make an old price look freshly verified. |
| `notes` | JSON with `kind='payg-list-price'`, `version=1`, numeric `blended_price_usd_per_mtok`, formula and substitution, exact mix, currency/FX, cache treatment, source row ID/URL/notes/verification date and promotion basis. |

Consumers must recognize the `payg:` namespace / notes kind before interpreting token fields. Read the numeric USD/MTok baseline from `notes.blended_price_usd_per_mtok`; do not run `realUnitPrice` against a fictitious plan fee. This representation also supports free API list prices without dividing by zero. Existing pages and app queries gain no dependency on quota tables, so missing or empty 0005 tables cannot cause a new page error or HTTP 500. Any future display integration must check table availability, treat absent/empty estimates as no baseline, and retain the existing price display.

### Seed modes and version history

These are **operator commands requiring a database connection**, not offline validation commands. Supply `DATABASE_URL` through the environment; this seed deliberately does not load `.env` files or `postgres-admin`.

```bash
npm run seed:quota-payg                 # default: read-only transaction; counts + up to 3 samples
npm run seed:quota-payg -- --dry-run     # same read-only preview
npm run seed:quota-payg:db-dry-run       # serializable real writes, then ROLLBACK
npm run seed:quota-payg:apply            # serializable real writes, then COMMIT
```

The script probes `to_regclass` before querying quota tables and fails with **“需先应用 0005”** if `quota_estimates` or `usage_mixes` is absent. It does not run migrations. Preview/rehearsal/apply report new versions, superseded versions, unchanged rows, skipped source rows with reasons, and samples containing the complete proposed fields/notes. Rehearsal rolls back inserts and supersession links; PostgreSQL sequence values may still advance.

For writes it locks current PAYG rows and follows the transaction/version workflow above: insert the replacement noncurrent, mark the old version noncurrent with `superseded_by`, then activate the replacement. Historical prices, token fields, notes and verification timestamps remain intact. Identical inputs (including source verification, source notes and FX) are unchanged even on another day; changed inputs create new versions. Duplicate provider/model/mix source identities abort before writes. Concurrent initial inserts or serialization failures abort the entire transaction; rerun after the competing operation completes. Skipped, unavailable, removed or retired source rows do not silently delete or retire existing history; inspect their source/verification dates before using an older baseline.

Implementation and tests are DB-free. No database preview, rehearsal, apply or migration was executed during this change. Review 0005 status on the intended target before an operator runs these commands; production status is not inferred here.

## Quota text monitor (scheduled daily)

```bash
npm run quota:monitor                         # default dry-run
npm run quota:monitor:dry-run -- --source=claude-usage
npm run quota:monitor -- --apply              # what the daily timer runs
```

Production schedule: `deploy/production/aiplans-quota-monitor.service` + `.timer` (daily 09:30 SGT, `Persistent=true`), running `npm run quota:monitor -- --apply` in the scraper container, following the `planprice-*` timer pattern. Templates only; SRE installs them (see below).

Sources live in `scripts/config/quota-text-sources.ts`. A source may be `enabled: false` with a required `disabledReason`; it is listed but not fetched. Fetch uses browser-like headers with a 30-second timeout and retries once with alternate headers on HTTP 403/429. HTML extraction removes scripts/styles, keeps block boundaries and table rows, normalizes metadata, then keeps quota-related lines (EN/ZH). Full client rendering is not attempted.

Failure policy: a per-source failure (HTTP 4xx/5xx, timeout, no quota text) is a warning; the run continues and prints a per-source summary. Exit is non-zero only if every enabled source fails, or on DB/credential errors. With `QUOTA_MONITOR_STATE_FILE` set (the unit uses `/var/lib/planprice/snapshots/quota-monitor-state.json`, a writable volume), `--apply` full runs count consecutive failures per source and send one Telegram alert when a source reaches `QUOTA_MONITOR_FAIL_ALERT_DAYS` (default 3); success resets the count.

Dry-run makes no DB writes and sends no Telegram messages. If `DATABASE_URL` is available it reads the latest snapshot for diffs; otherwise it previews without a baseline. The DB must have migration 0005 first.

Telegram credentials: `AIPLANS_TG_BOT_TOKEN` / `AIPLANS_TG_CHAT_ID` if set, otherwise `BRAIN_TG_TOKEN` / `BRAIN_TG_CHAT_ID`, the same x2v alerts bot (`/root/.config/x2v-alerts/env`, mode 600 on prod; `/home/ubuntu/.config/x2v-alerts/env` as fallback) that `notify-audit-alert.sh` uses. The unit loads those files via `EnvironmentFile=-` and passes the two vars into the container. Chat ID defaults to `6217573976`. With no token, `--apply` logs a skip and exits zero before DB access or fetching. If that env file is absent on the host, SRE must provide a token (owner approval required).

The first snapshot is a silent baseline. A new hash after the baseline inserts a changed snapshot and one `official_text` evidence row with notes exactly `pending review`. Telegram messages start with `[aiplans]`, identify the source and URL, and include a bounded line diff. Content versions are unique by `(source_id, content_hash)`; revisiting a known hash does not alert again and refreshes `fetched_at` (last observation). An advisory transaction lock serializes runs per source. Failed Telegram deliveries leave a pending alert retried on a later run; delivery failures do not fail the run.

### Installing the timer (SRE, owner approval required)

```bash
cd /opt/x2v/planprice && git pull   # must include this change
sudo cp deploy/production/aiplans-quota-monitor.{service,timer} /etc/systemd/system/
# optional: same fleet failure drop-in as planprice-* units (10-notify.conf)
sudo systemctl daemon-reload
sudo systemctl start aiplans-quota-monitor.service && journalctl -u aiplans-quota-monitor -n 80 --no-pager
sudo systemctl enable --now aiplans-quota-monitor.timer
systemctl list-timers aiplans-quota-monitor.timer
```

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
npx tsx --test src/db/schema/quota.test.ts src/lib/quota/engine.test.ts src/lib/quota/pay-as-you-go.test.ts scripts/seed-quota-payg.test.ts scripts/utils/quota-text-monitor.test.ts scripts/quota-text-monitor.test.ts
npm test
npm run lint
```

The dedicated script TypeScript config covers the monitor and PAYG seed files because the app's root config excludes `scripts/`. Tests use synthetic arithmetic, HTML fixtures and injected clients; they require no network or database. `npm test` / `scripts/test-unit.mjs` recursively discovers both PAYG test files, and PR CI runs that command and both TypeScript checks. PAYG tests exercise both mixes, USD/CNY conversion, cache fallback/zero rates, promotion expiry, exclusions, read-only preview, pre-0005 errors, empty data, idempotence, supersession ordering and rollback on rehearsal/failure.
