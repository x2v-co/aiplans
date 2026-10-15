# Daily paid-plan self-measurement

Run this on the machine that holds the usage logs. Collection is local and offline by
default; it does not read Codex auth files, connect to a database, call vendor APIs,
or send Telegram messages. This change adds no timer, service, deployment change,
or automatic migration registration. Measurements do not update reviewed quotas.

```bash
npm run quota:collect                              # all collectors; unavailable ones skip
npm run quota:collect -- --collector codex-log
npm run quota:collect -- --collector codex-log --codex-dir /path/to/codex-home --account-label paid-a
npm run quota:collect -- --collector ccusage --ccusage-json /local/daily.json --ccusage-plan claude-max-5x --account-label paid-b
npm run quota:collect -- --collector codex-log --out /local/new-samples.jsonl
```

`--codex-dir` is a Codex **home directory**, containing `sessions/`; otherwise
`CODEX_HOME`, then `~/.codex`, is used. Only regular `sessions/**/*.jsonl` files are
read; symlinks are not followed. Never supply an auth file. Use one account's logs
per invocation and a stable opaque `--account-label` (letters, digits, `_`, `-`,
1–64 characters). Never use an email, actual account ID, or account name as a label.
The default label is `local-paid`; change it when collecting another account.

Every run prints sanitized samples, a UTC daily token summary, daily/reset-window
summaries and anomaly results. `--out` additionally creates a **new** JSONL file
with mode 0600; it refuses to overwrite an existing file. Output can still reveal
usage patterns, so keep it outside the repository. No real logs or measurements
belong in git. Only synthetic fixtures are checked in.

## Accounting and limitations

Codex `token_count` records provide `last_token_usage`, cumulative counters and
quota meters. Fresh input is `input_tokens - cached_input_tokens`; input includes
cache reads in this format. Stored `tokens_input` is fresh input. Reasoning is a
subset of output and is recorded separately without adding it to token totals.
Cache-write counts are recorded separately. Missing counts remain null.

Repeated cumulative counters in a session contribute zero new tokens. Identical
replayed events are deduplicated. Parallel sessions at the same millisecond with
agreeing plan/reset/meter readings are combined to fit the database identity;
their individual token event IDs/counts remain in sanitized `raw.usageEvents`.
Conflicting simultaneous meters fail collection instead of silently overwriting.
Daily usage deduplicates token events across short and weekly meters, including
partially overlapping simultaneous groups. Summary `events` includes meter-only
updates with zero new tokens. Unknown plan types are labeled `codex-unknown`, with
low confidence; update `scripts/quota-collect/config.ts` after reviewing the mapping.

Window summaries are grouped by UTC day, plan, collector, account, limit pool,
window duration and reset timestamp. They sum last usage and show consumed
percentage min/max. The measurement interval excludes the first reading's tokens,
because those tokens precede that baseline meter reading. The measured delta must
exceed one percentage point to allow the engine's ±0.5pp uncertainty per reading.
Meter decreases within an unchanged reset, unknown resets, missing token categories,
and missing/changing models prevent inference. Different resets and days are never
stitched into one measurement. UTC midnight can therefore leave short unmeasured
intervals; daily usage totals still include those tokens.

`measuredQuota` computes implied window USD from the interval's tokens and delta.
**CONFIG TO FILL:** `scripts/quota-collect/config.ts` contains illustrative
`gpt-5-codex` list prices, not verified vendor prices. Replace/add reviewed model
prices before interpreting values; there is no fallback for unknown models. Every
affected summary is marked `placeholderPrices` and includes a warning. Target mix
is the project's 97% cached / 2.5% fresh / 0.5% output comparison assumption. A
one-window/week assumption is supplied only to satisfy the engine; the collector
reports window value, not a claimed weekly/monthly allowance. Cache-write fees are
omitted by the existing three-category engine and noted in the summary. Missing
prices still allow a tokens-per-1% comparison. Shared account activity, absent logs,
mixed models and stale meters can invalidate an estimate; it is not vendor evidence.

The ccusage collector accepts standard `daily[]` or `type: "daily", data: []`
exports from [`ccusage daily --json`](https://ccusage.com/guide/json-output).
It requires `--ccusage-plan` because that export does not identify a subscription.
Its input tokens are already fresh; cache read/write fields remain separate. It
does not infer quota percentages or resets from daily token totals. Project-grouped
exports are rejected rather than risking duplicate totals. Multi-model daily rows
have a null model. Export dates are retained as reported, represented at UTC
midnight; configure ccusage's reporting timezone as UTC for cross-source comparison.
Arbitrary export fields, project/session paths, prompts and identities are discarded.

## Anomalies and optional database writes

The anomaly detector computes observed `(fresh + cached + cache-write + output)
tokens / consumed percentage-point increase`, excluding reasoning double counting.
Multiple valid reset-window intervals in one day are weighted by their percentage
deltas. A drop **strictly greater than 25%** against the median of available days
in the previous seven UTC calendar days is flagged. Today and future days are not
in the baseline. Sparse history is allowed; the alert reports its observed-day
count. Comparisons stay within the same plan, model, collector, opaque account,
window and limit pool so model/meter changes do not masquerade as quota reductions.
ccusage alone has no percentage meter and cannot generate these anomalies.

```bash
# Explicit operator action against the intended database, after migration review:
npm run quota:collect -- --collector codex-log --account-label paid-a --apply
# Additional explicit opt-in to Telegram delivery:
npm run quota:collect -- --collector codex-log --account-label paid-a --apply --alert
```

`--apply` requires `DATABASE_URL` in the process environment. The runner never loads
`.env` or credentials files and never applies SQL. An operator must separately review
and manually apply **only** `drizzle/0013_quota_usage_samples.sql` to an approved
target database. The file is additive, has no journal entry, and is deliberately
absent from `scripts/migrate-data-accuracy.ts`. It is independent of parallel `0012`
evidence-review work. No database or migration is touched during dry-run.

Apply upserts only `quota_usage_samples`, atomically for an invocation, using
`(collector, account_label, observed_at, window)`. This makes repeat collection
idempotent and lets ccusage's current-day cumulative row grow. A conflicting plan
mapping rolls back the invocation. Keep complete logs for simultaneous events:
upserts reflect the currently available local readings at a given identity.
Stored history from the previous seven days is included for anomaly baselines
when older local logs have rotated out. Dry-run uses local history only, even if
`DATABASE_URL` is set. Real collector failures prevent partial writes; missing
inputs and the three credential stubs report `skipped` and are not failures.

Alerts reuse `sendTelegram` and `telegramCredentials` from
`scripts/quota-text-monitor.ts`: `AIPLANS_TG_BOT_TOKEN` / `AIPLANS_TG_CHAT_ID` take
precedence over `BRAIN_TG_TOKEN` / `BRAIN_TG_CHAT_ID`, with the existing chat default.
No token handling is duplicated. Neither `--apply` alone nor `--out` sends messages.
`--alert` without `--apply` is rejected. Delivery failures give a nonzero exit after
samples have committed; rerunning retries collection/alerts. Alerts have no durable
deduplication state: repeated runs over the same days may repeat an alert. Review
these signals manually; they do not create quota evidence or modify estimates.

## Scheduling on the log-holding machine

Choose a local daily time after the machine's normal usage. For example, an operator
could configure their existing scheduler to run:

```bash
cd /path/to/aiplans
npm run quota:collect -- --collector codex-log --account-label paid-a
```

Run as the user who owns the session logs, set an explicit working directory and
`CODEX_HOME` if needed, keep private scheduler output outside the repository, and
avoid overlapping runs. This default schedule remains a dry-run. After schema and
destination review, the operator can explicitly add `--apply`, then optionally
`--alert` and supply environment variables through their existing secret manager.
For ccusage, first generate its daily JSON locally, then pass that file and an
explicit plan slug. This document installs/enables no schedule; no `deploy/` files
are changed.

## Credentials and input checklist

| Collector / action | Required local input or environment | Status |
| --- | --- | --- |
| `codex-log` | Readable `CODEX_HOME/sessions/**/*.jsonl`; paid plan type in meters; optional opaque label | Working; no credentials required |
| `ccusage` | User-created `ccusage daily --json` file, `--ccusage-json`, `--ccusage-plan`, optional opaque label | Working; no credentials read by collector |
| `cursor-dashboard` | User-authorized dashboard export/session and plan mapping | Stub; skipped with required-input error |
| `grok-bot` | User-authorized Grok usage endpoint, bot credentials and plan mapping | Stub; skipped with required-input error |
| `claude-usage` | User-authorized Claude usage endpoint/session and plan mapping | Stub; skipped with required-input error |
| DB apply | `DATABASE_URL` supplied by operator; migration 0013 applied separately | Only `--apply` connects |
| Telegram alert | Existing monitor's Telegram token/chat environment variables | Only `--apply --alert` sends |

Do not fetch or read Codex auth, browser cookies, vendor sessions or any credential
files to configure these stubs. Their requirements describe future implementation;
providing environment variables does not enable them today.

## Offline validation

```bash
npx tsc --noEmit
npx tsc --noEmit -p scripts/tsconfig.quota.json
npm test
npm run lint -- src/db/schema/quota.ts src/db/schema/quota-usage-samples.test.ts scripts/quota-collect.ts scripts/quota-collect.test.ts scripts/quota-collect/*.ts
```

Tests use tiny synthetic fixtures, temporary local directories, injected Telegram
transport and subprocess dry-runs with unusable database URLs. They read no real
usage or credentials and require no database/network. The dedicated scripts
TypeScript config includes the framework, runner and tests; `npm test` discovers
all nested test files.
