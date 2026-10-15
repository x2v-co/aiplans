# Gemini 4 Argon introductory prices

The official Google pricing HTML saved on 2026-10-14 (page updated 2026-10-13)
is the source for `scripts/scrapers/fixtures/google-gemini-promos.html`. The fixture
contains only Argon and Gemini 3.8 Flash Standard tables, including cache storage
charges that must not become token cache-read prices.

## Release / PR note

Google does not specify a timezone for its introductory pricing dates. We assume
Pacific midnight: Argon's first regular-price instant is **2026-12-01T08:00:00Z**.
The UI displays the inclusive last promotional date, **Nov 30, 2026 / 2026-11-30**,
and labels it Pacific time. Other dated Gemini prices use the same Pacific rule,
including daylight saving time when applicable.

Standard input/output/cache is $2/$10/$0.10 per 1M until the cutoff, then
$4/$20/$0.20. Argon cache is implicit only. Batch and Flex are
$1/$5/$0.05 → $2/$10/$0.10; Priority is $3.60/$18/$0.18 → $7.20/$36/$0.36.
The Google scraper publishes Standard prices. Google does not currently populate
`api_channel_price_variants` for tiers, so the seed records those other tiers in
notes. It does not create Free API pricing or AI Pro / Free plan entitlements.

## Migration

`drizzle/0002_api_channel_introductory_prices.sql` adds four nullable columns to
`api_channel_prices`: `promo_ends_at` (timestamptz) and the three
`regular_*_price_per_1m` columns (real). All four statements use
`ADD COLUMN IF NOT EXISTS`. Existing rows retain their prices with NULL metadata.

Production uses `scripts/migrate-data-accuracy.ts`, called by the Compose
`migrate` service in `deploy/production/rollout.sh` **before** replacing the app.
Migration `029_add_api_channel_introductory_prices` reads this SQL file. Apply it
before serving the new application or running the seed. This deployment path
does not use Drizzle's journal. The old Drizzle snapshots still describe legacy
table names (including `channel_prices`); do not generate a full snapshot diff
or use `drizzle-kit push` for this change. `scripts/sql/` contains standalone
maintenance/repair SQL rather than the rollout schema migrations.

Local / direct operator commands (DATABASE_URL must identify the intended DB):

```bash
npx tsx scripts/migrate-data-accuracy.ts --dry-run
# Operator executes the migration runner, which applies all registered migrations:
npx tsx scripts/migrate-data-accuracy.ts
npx tsx scripts/seed-gemini-4-argon.ts
# Operator executes only after reviewing the field-level dry-run:
npx tsx scripts/seed-gemini-4-argon.ts --apply
```

Production Compose equivalents, after building images from this commit:

```bash
cd /opt/x2v/planprice
sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production run --rm --no-deps migrate npm run migrate -- --dry-run
sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production run --rm --no-deps migrate
sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production run --rm --no-deps scraper npx tsx scripts/seed-gemini-4-argon.ts
sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production run --rm --no-deps scraper npx tsx scripts/seed-gemini-4-argon.ts --apply
```

The migration preview includes `-- 029_add_api_channel_introductory_prices` and
all four additive statements. Applying prints that migration's `✓ applied`.
The seed's default mode sets `SET TRANSACTION READ ONLY`; its JSON lists every
changed field with `from` / `to`, plus the table, action, target, and existing ID.
Changed rows receive `updated_at` on apply. There is no write for an equal row.
An absent model is printed as an insert; new channel `model_id: null` refers to
the ID that the model insert will return inside the transaction.

With no Argon model, no Cursor API provider, and both Google Free / AI Pro plans
present with broad selectors, expect four row changes: a model insert, a Google
channel insert, and two selector updates adding `gemini-4-argon` to `exclude`.
Existing erroneous links to those plans are printed as deletes. The seed fails
without writes if Google is missing / not an official producer, or if duplicate
model/channel rows make the operation ambiguous. `--apply` is atomic.

## Scraping and reads

The scraper already auto-creates valid unknown models from official producers.
`gemini-4-argon` normalizes unchanged and passes the identity guard. Gemini maps
to the existing Google producer ID 35, which is on the auto-create allowlist;
`createProducts` defaults to true. The seed is useful for immediate listing,
the exact display name and producer/context correction, and plan exclusions,
but is not required for future scraper discovery in the existing catalog.

The cell parser chooses prices with an injectable date and retains the scheduled
regular prices. Both scraper inserts and updates persist the schedule. A later
plain price clears all four promotion fields, so stale schedules cannot override
new data.

`effectivePrice` resolves current input/output/cache values at read time on model
detail, metadata, model lists, comparisons, API pricing, calculator, both public
channel JSON endpoints, grouped JSON, pricing guides, the price index, and model
Open Graph images. It switches at `now >= promo_ends_at`, independently for each
non-null finite regular price (including zero), without modifying the stored row.
Missing/invalid cutoff data or absent regular prices retain the stored rates.
Current price pages render dynamically per request to avoid persistent static
prices across the cutoff. An already-open browser page updates on reload.

If scraping fails, successfully persisted rows still switch on later reads. The
protected immutable v1 publisher also resolves prices using this helper and caps
snapshot lifetime at any pending price boundary. At that boundary the current
catalog endpoint returns 503 until a fresh snapshot is published, rather than
serving an expired introductory price. Historical snapshots remain immutable.
Normal publication is skipped by `run-scrapers.sh` when a scraper fails.

## Cursor

The repository currently has no Cursor API channel provider. Cursor is a surface
of xAI's X Subscription bundles, whose third-party models are billed separately
and whose selectors include Grok models. Do not add Argon as an included plan
model. The seed skips Cursor unless an existing `cursor` or `anysphere` provider
already has API channel rows; in that case it upserts the verified $2/$10 rates,
with NULL cache price and NULL future schedule because neither is verified for
Cursor. It never creates a Cursor provider or invents a December price change.

## Duplicate slug

The reproducible source of `google-gemini-gemini-4-argon` is
`scripts/scrapers/openrouter.ts`, specifically `generateOpenRouterSlug`.
`PROVIDER_NORMALIZATION` maps OpenRouter's `google` / `google-ai` vendor to
`google-gemini`; the generator then joins that prefix to `slugify(model)`.
Thus `google/gemini-4-argon` produced `google-gemini-gemini-4-argon`, and
`google/gemini-4-argon:batch` produced `google-gemini-gemini-4-argon-batch`.
The display-name helper separately strips `Google: `, so these IDs can carry
the same display title as the seeded canonical model.

Before this fix, `resolveProduct` in `scripts/index-dynamic.ts` used
`price.modelSlug || normalizeSlug(price.modelName)`: OpenRouter's explicit slug
bypassed the shared normalizer entirely. Gemini names infer Google's official
producer ID 35, allowing auto-creation even though the channel is OpenRouter.
`getOrCreateProduct` selected an existing exact slug before checking names,
and its creation guard accepted the doubled prefix. A missing canonical model
could therefore be created under the provider-prefixed slug; the Argon seed
only looks up `ARGON_SLUG = 'gemini-4-argon'` and can later insert a separate
canonical row. Name matching cannot reconcile two rows already present.
This identifies the generating code path; the actual insertion order is not
verified because no database or production logs were accessed.

The current `fix-add-variant-models.ts` inserts only its explicit `VARIANT_SLUGS`
with `name = slug`; Argon was absent from that list before this fix, so that
version of the script does not explain the Argon batch duplicate. The earlier
2026-10-12 repair documents similar malformed batch slugs for other models.
The OpenRouter generator directly reproduces both reported Argon slugs.

`canonicalizeModelSlug` now resolves the verified Argon base/batch names,
OpenRouter IDs, and legacy slugs to `gemini-4-argon` and
`gemini-4-argon-batch`. It runs in OpenRouter's generator, the shared name
normalizer, the scrape resolver (including price-variant lookup), and
`getOrCreateProduct` before the exact-slug query. The map is deliberately
limited to Argon: unverified provider IDs, dated snapshots, and other pricing
suffixes retain their identity. The identity guard requires manual review for
any other vendor/family/family prefix instead of guessing a canonical model,
even when no canonical row exists. The variant list includes the canonical
Argon batch slug. Local regression tests cover display names, provider IDs,
legacy slugs, batch forms, distinct SKUs, the OpenRouter generator, and the guard.

`scripts/sql/2026-10-15-merge-gemini-4-argon-dup.sql` is a standalone manual
repair, with no automatic migration registration. Its opening SELECTs list all
four possible model rows, dependency counts, live foreign keys and uniqueness
rules, and conflicting channel prices. The current schema's model dependencies
are `api_channel_prices`, `api_channel_price_variants`, `model_plan_mapping`,
`model_offical` (existing spelling), `model_benchmark_scores`, `evaluation_run`,
`usage_prices`, `coding_agent_scores`, `external_price_references`, and
`model_slug_redirects`. `price_history` depends on channel IDs rather than
model IDs; quota tables reference plans and do not add a model FK.

After reviewing the preview, an operator can run the transaction in a
persistent session with scrapers/writers stopped. It locks the affected tables,
backs up both canonical and duplicate rows and all their dependencies to
`model_merge_backup_20261015`, and resolves IDs by slug. Canonical metadata and
prices win conflicts, including introductory-price schedules. Conflicting
channel rows are deleted only after their history is reattached to the surviving
channel; all history events remain, so merged histories may contain prices
different from the retained canonical price. Conflicting variant keys retain
canonical rows, while a distinct moved variant loses its headline flag if an
available canonical headline already exists. Plan/producer/benchmark key
conflicts retain canonical rows; other dependencies move without deletion.

The batch row is renamed in place when no canonical batch exists, otherwise
merged into it. Existing redirects move before duplicate model deletion, and
both old Argon slugs point to the canonical IDs for the existing 308 redirect
handler. The transaction aborts for missing required models, unrelated redirects,
unexpected FKs, or ambiguous per-model channel rows. Verification checks models,
redirects, dependency moves, and preserved history. The SQL deliberately ends
without COMMIT: inspect the results and issue manual `COMMIT` or `ROLLBACK` in
the same session. The repair was not executed against any database.

Local validation: 36 relevant `tsx --test` tests passed (normalizer, identity
guard, OpenRouter, Google pricing, Argon seed data, price-history selection,
and shutdown normalization). `npx tsc --noEmit` passed; the project excludes
scripts, so a separate script check was compared with HEAD and showed the same
40 existing diagnostics. Focused typechecking of the new normalizer test and
identity guard passed. ESLint on touched TypeScript files reported zero errors
and five existing unused-symbol warnings in `index-dynamic.ts`. PostgreSQL SQL
and PL/pgSQL syntax parsing passed locally without a database connection.
