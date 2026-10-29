# OpenAI API lifecycle data

The seed now covers audit A2 #1 / A3 P0, dated 2026-10-15, plus the
2026-10-19 deprecations-page check, as well as the previously reviewed batches
in `scripts/data/openai-shutdowns.ts`. Prices and new shutdown dates are taken
from the official deprecations page, not guessed.

`shutdown_date`, `replacement_model`, and `deprecation_source_url` already exist
in migration 0003. Migration 0005 adds nullable `deprecated_at`, the announcement
day. Status is derived: no shutdown day = active, a future day = retiring, and
shutdown day <= the current UTC day = retired. Unknown announcement dates and
replacements remain null; existing reviewed announcements/replacements are kept.

All matching is by exact model slug. No redirects, name matching, or model-name
normalization runs during the seed. GPT-4o's May snapshot and its undated alias
therefore keep distinct shutdown dates. Missing exact rows are printed for SRE;
no model inventory was inspected in this workspace. The four audit-listed Codex
models retire on 2026-07-23. `gpt-5.1-codex-mini` is listed on the deprecations
page (checked 2026-10-19) with shutdown 2026-07-23 and replacement `gpt-5.6-terra`.
The 2026-10-15 pricing SQL no longer appends a verification sentence for it.
`openai-o4-mini-high` (o4-mini at reasoning effort high) and `openai-o4-mini-batch`
(o4-mini's Batch API SKU) are not separate model ids on that page. Since
2026-10-20 they follow `o4-mini` (shutdown 2026-10-23, replacement `gpt-5.6-terra`),
the same rule as `openai-gpt-3-5-turbo-batch`. Production aliases `openai-gpt-3-5-turbo`,
`openai-gpt-3-5-turbo-batch` and `openai-gpt-4` follow the official aliases
`gpt-3.5-turbo` (replacement `gpt-5.6-terra`) and `gpt-4` (replacement `gpt-5.6-sol`),
shutdown 2026-10-23. The batch slug is that alias's batch SKU; the page does not
list a separate `-batch` id.

2026-10-29 (Intel audit P0-1): the 2026-06-11 table lists each row as
`alias | snapshot` (e.g. `gpt-5 | gpt-5-2025-08-07`), so the undated aliases
`gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro` and their production Batch
SKUs (`openai-gpt-5-batch`, `openai-gpt-5-mini-batch`, `openai-gpt-5-nano-batch`,
`openai-gpt-5-pro-batch`) shut down 2026-12-11 (announced 2026-06-11).
Replacements: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`,
`gpt-5.6-sol (reasoning.mode: pro)`. `openai-gpt-4o-mini-batch`,
`openai-gpt-4-1-mini` and `openai-gpt-4-1-mini-batch` follow the 2026-10-14
batch (2027-01-14, `gpt-6-luna`).

The seed defaults to a serializable READ ONLY transaction and prints model field
diffs plus channel/variant rows to disable. `--apply` writes all changes in one
transaction. It disables every channel and variant whose model's shutdown day
has arrived, including unchanged model rows on repeat runs. The daily API scraper
also disables those rows after scraping. Public default lists, price rankings,
search, both model/plan-comparison sitemap entries, and channel readers filter by
shutdown day at query time. Model detail URLs remain available with en/zh lifecycle
badges and source links; their retired channels are no longer offered for sale.

## SRE procedure

Run from the repository root **on the private production network**, with
`DATABASE_URL` already provisioned in the environment or `.env.local`. Never push
main just to run these steps: main auto-deploys. No database commands below were
executed during implementation.

```bash
# 1. Migrate (includes 0003, 0005 and existing variant-table migrations).
npm run migrate

# 2. Review dry runs. SQL makes provisional changes and rolls them all back.
npm run seed:openai-shutdowns -- --dry-run
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/2026-10-15-p0-pricing.sql

# 3. Apply only the reviewed data. SQL uses one transaction; --apply is explicit.
npm run seed:openai-shutdowns -- --apply
sed 's/^ROLLBACK;$/COMMIT;/' scripts/sql/2026-10-15-p0-pricing.sql > /tmp/aiplans-2026-10-15-p0-apply.sql
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/aiplans-2026-10-15-p0-apply.sql

# 4. Recheck idempotency and reconcile plan links.
npm run seed:openai-shutdowns -- --dry-run
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/2026-10-15-p0-pricing.sql
npm run mappings:materialize:dry-run
npm run mappings:materialize:apply
npm run audit:verbose
```

`npm run seed:catalog-2026-10-19` is separate from the steps above and is not part of
rollout. It stays a dry-run until `--apply`. That command updates Claude Team
Standard/Premium seat prices, `grok-code-fast-1` shutdown fields, and removes the
stale Codex Mini verification sentence if a previous run of the pricing SQL wrote it.

The migration script loads `.env.local`; `psql` requires the exported URL. The
SQL refuses missing official providers and duplicate target channels / conflicting
Ultra rows. Review any exception before retrying; no partial changes commit.
The second SQL rollback run shows final values and should not create duplicates.
Intentional unknown prices remain warnings in the accuracy audit.

## Optional manual synchronization

```bash
npm run sync:openai-deprecations
npm run sync:openai-deprecations -- --apply
```

This is **not scheduled**. With `OPENAI_API_KEY`, it reads `GET /v1/models` and
validates optional `shutdown_date` fields. Without the key, it fetches
<https://platform.openai.com/docs/deprecations> and parses explicit shutdown/model
table columns best-effort. The optional field is documented in the
[official List models reference](https://developers.openai.com/api/reference/resources/models/methods/list).
Missing fields/model IDs never clear existing notices, and zero parsed notices
fail before opening the database. Unmatched source IDs are printed; markup changes
may require parser maintenance. Runtime sync intentionally reads future official
updates; the checked-in one-time seed uses only reviewed catalog values.
