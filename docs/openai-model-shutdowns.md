# OpenAI model API shutdowns

Scope: the two requested batches announced 2026-10-14 and 2026-04-22,
checked against [OpenAI's deprecation page](https://platform.openai.com/docs/deprecations)
on 2026-10-14. Other announcements on that page are outside this seed's scope.

## Implementation

- `drizzle/0003_model_shutdown.sql` adds three nullable `models` columns:
  `shutdown_date` (date), `replacement_model` (text), and
  `deprecation_source_url` (text). NULL means no announcement is recorded.
- `src/db/schema/index.ts` declares those columns. Migration hook
  `030_add_model_shutdown` in `scripts/migrate-data-accuracy.ts` reads the SQL
  file, following PR #104. The rollout runner uses this idempotent hook;
  these targeted SQL files do not require a Drizzle journal/snapshot update.
- Model detail pages show an English/Chinese notice, replacement, and official
  source link when a shutdown date is set. The date stays the same in either
  locale. Copy becomes “Removed from the OpenAI API” after the announced UTC
  calendar day passes; no shutdown time of day is assumed. This does not assert
  that Azure, OpenRouter, resellers, or subscription plans remove the model on
  the same day, and does not change their prices or availability flags.
- `scripts/data/openai-shutdowns.ts` is the single data source. Batch A uses
  2027-01-14 / `gpt-6-luna`; batch B uses 2026-10-23 and the replacements below.
  Fine-tunes follow their base schedule, but no fine-tune rows are invented.
- `scripts/seed-openai-shutdowns.ts` defaults to a serializable **read-only**
  transaction. It prints every API ID's match, unmatched IDs, and old/new values
  for each changed model row. Only explicit `--apply` writes, in one transaction.
  Unknown/conflicting flags fail before loading DB configuration. It never
  inserts rows, resolves redirects, matches display names, or calls the model
  normalizer. Repeating the seed against unchanged data produces zero updates.

## Identity investigation and mapping

`models.slug` is unique. `getOrCreateProduct` in `scripts/db/queries.ts` first
matches exact slugs, then redirects and names. The shutdown seed uses only exact
slugs: a redirect/name match could land on a broader family. The identity guard
accepts syntactically valid dated IDs but does not establish whether their row
represents a snapshot or an alias.

There is **no checked-in JSON export of model DB rows**. The JSON files in this
checkout contain leaderboard/pricing data, messages, or Drizzle metadata;
`migrations/seed-sample-data.sql` only illustrates subscription plan inserts.
The table therefore describes repository evidence and safe seed targets, not a
live inventory. No database was inspected for this change. SRE's dry run is the
authoritative present/missing report for the deployed catalog.

Evidence:

- `scripts/fix-data-audit.ts` references existing prices for `gpt-3.5-turbo`,
  `gpt-4-turbo`, `o1`, and `o3-mini`, and creates the GPT-4.1 family including
  `gpt-4.1-nano`. `scripts/fix-add-variant-models.ts` includes `o4-mini`.
- `gpt-4` is a supported canonical slug in the normalizer. Its current DB
  presence, and that of `o1-pro`, cannot be confirmed from a row export.
- No materialized model seed for `gpt-image-1` was found. OpenRouter explicitly
  skips models without text output; mentions in scraper documentation are not
  evidence of a model row.
- OpenRouter skips dated snapshots when their undated ID exists. The normalizer
  collapses GPT-4o snapshots and maps `gpt-4.1-2025-04-14` to `gpt-4`; its substring
  rules preserve some other dated IDs. None of those transformations authorize
  a shutdown update.

“Mark” below means eligible **if the target row exists**, not already applied.
Every exact API-ID slug takes precedence over the fallback in the table; if both
an alias and its dated row exist, both receive their own update. All explicitly
removed aliases in batch B are eligible. “Ambiguous” means an exact snapshot row
is required and its broader family must stay unmarked. “Not present in repo” means
no model-row evidence was found; the seed still checks the exact slug at rollout.

### Batch A: removal 2027-01-14, replacement `gpt-6-luna`

| API ID | Existing normalizer result | Safe seed target | Repository assessment |
| --- | --- | --- | --- |
| `gpt-4o-2024-08-06` | `gpt-4o` | Exact dated slug only | Ambiguous; leave `gpt-4o` unmarked |
| `gpt-4o-2024-11-20` | `gpt-4o` | Exact dated slug only | Ambiguous; leave `gpt-4o` unmarked |
| `gpt-4o-mini-2024-07-18` | `gpt-4o-mini` | Exact dated slug only | Ambiguous; leave `gpt-4o-mini` unmarked |
| `gpt-4.1-2025-04-14` | `gpt-4` | Exact dated slug only | Ambiguous; leave `gpt-4.1` unmarked; do not use normalizer |
| `gpt-4.1-mini-2025-04-14` | unchanged | Exact dated slug only | Ambiguous; leave `gpt-4.1-mini` unmarked |

### Batch B: removal 2026-10-23

| API ID | Existing normalizer result | Safe fallback after exact slug | Replacement | Repository assessment |
| --- | --- | --- | --- | --- |
| `gpt-3.5-turbo-0125` | `gpt-3.5-turbo` | `gpt-3.5-turbo` | `gpt-5.6-terra` | Mark removed alias |
| `gpt-3.5-turbo` | unchanged | `gpt-3.5-turbo` | `gpt-5.6-terra` | Mark |
| `gpt-3.5-turbo-completions` | `gpt-3.5-turbo` | `gpt-3.5-turbo` | `gpt-5.6-terra` | Mark removed alias |
| `gpt-4-0613` | `gpt-4` | `gpt-4` | `gpt-5.6-sol` | Mark removed alias if present |
| `gpt-4` | unchanged | `gpt-4` | `gpt-5.6-sol` | Mark if present; supported slug |
| `gpt-4-0613-completions` | unchanged | `gpt-4` | `gpt-5.6-sol` | Mark removed alias if present |
| `gpt-4-completions` | unchanged | `gpt-4` | `gpt-5.6-sol` | Mark removed alias if present |
| `gpt-4-1106-preview` | `gpt-4` | None | `gpt-5.6-sol` | Not present in repo; exact row only |
| `gpt-4-turbo` | unchanged | `gpt-4-turbo` | `gpt-5.6-sol` | Mark |
| `gpt-4-turbo-2024-04-09` | `gpt-4-turbo` | `gpt-4-turbo` | `gpt-5.6-sol` | Mark removed alias |
| `gpt-4-turbo-completions` | `gpt-4-turbo` | `gpt-4-turbo` | `gpt-5.6-sol` | Mark removed alias |
| `gpt-4.1-nano` | unchanged | `gpt-4.1-nano` | `gpt-5.6-luna` | Mark |
| `gpt-4.1-nano-2025-04-14` | unchanged | `gpt-4.1-nano` | `gpt-5.6-luna` | Mark removed alias |
| `gpt-4o-2024-05-13` | `gpt-4o` | None | `gpt-5.6-sol` | Ambiguous; leave `gpt-4o` unmarked |
| `gpt-image-1` | unchanged | None | `gpt-image-2.5-sunburst` or `gpt-image-2.5-flare` | Not present in repo; exact row only |
| `o1-2024-12-17` | unchanged | `o1` | `gpt-5.6-sol` | Mark removed alias |
| `o1` | unchanged | `o1` | `gpt-5.6-sol` | Mark |
| `o1-pro-2025-03-19` | unchanged | `o1-pro` | `gpt-5.6-sol` (`reasoning.mode: pro`) | Mark removed alias if present |
| `o1-pro` | unchanged | `o1-pro` | `gpt-5.6-sol` (`reasoning.mode: pro`) | Mark if present; row unconfirmed |
| `o3-mini-2025-01-31` | `o3-mini` | `o3-mini` | `gpt-5.6-sol` | Mark removed alias |
| `o3-mini` | unchanged | `o3-mini` | `gpt-5.6-sol` | Mark |
| `o4-mini-2025-04-16` | unchanged | `o4-mini` | `gpt-5.6-terra` | Mark removed alias |
| `o4-mini` | unchanged | `o4-mini` | `gpt-5.6-terra` | Mark |

In addition to the snapshot-only IDs above, there is no independent row evidence
for completion aliases or dated `o1`, `o1-pro`, `o4-mini` IDs. Their explicitly
removed alias fallbacks let the seed update the canonical row without inventing
a snapshot row. The seed logs `exact`, `removed-alias`, `not-present`, or
`ambiguous` for each of the 28 IDs.

OpenAI's page also lists `gpt-4-1106-preview` under a historical 2026-03-26 removal.
This seed retains the requested 2026-04-22 batch's 2026-10-23 date for that exact
ID; review that duplicate announcement if a separate snapshot row is found.

## Scraper preservation

No scraper change is needed. `modelsdev.ts` is a read-only reference catalog;
skipping `status=deprecated` there does not mutate models. OpenRouter emits
prices into `index-dynamic.ts`, which uses `getOrCreateProduct`. Existing model
rows are returned; release-date backfills only update `released_at` and
`updated_at`. Channel upserts/retirement operate on channel price tables.
The vertical model seed also updates an explicit payload without these columns.
None of these paths copies a full model record with new nullable fields or
resets shutdown metadata to NULL. Future model upserts must preserve these
curated fields unless deliberately updating an announcement.

## Rollout

1. Merge follows the existing auto-deploy workflow. Its migration service runs
   `migrate-data-accuracy.ts` before the updated app takes traffic, adding the
   nullable columns. Merge does **not** seed shutdown values.
2. SRE runs the seed in the normal deployment environment with its configured
   `DATABASE_URL`: `npm run seed:openai-shutdowns:dry-run` (equivalently
   `npm run seed:openai-shutdowns`). Save its full output and check exact model
   slugs, old/new fields, unmatched IDs, and ambiguous snapshot-only families.
3. The owner confirms the proposed rows and mappings. Missing models remain
   missing; do not map batch A to `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, or
   `gpt-4.1-mini` just to obtain a visible notice.
4. After confirmation, SRE runs `npm run seed:openai-shutdowns -- --apply`.
   Re-run the dry run; unchanged rows should produce zero proposed updates.
5. Check `/en/models/o1` and `/zh/models/o1` (or another confirmed target) for the
   scheduled notice, replacement, and source link. Batch A notices appear only
   if separate snapshot rows actually exist. Historical channel offers remain.

No seed, migration, or script with `--apply` was run while implementing this
change; no production DB was accessed. Validation uses pure in-memory rows.
The new data/date tests are included in `.github/workflows/pr-check.yml`.

## Validation

- `npm run lint`: pass, zero errors; 39 pre-existing warnings, unchanged from
  the baseline run.
- `npx tsc --noEmit`: pass. Scripts are excluded by the repo's tsconfig, so the
  new seed/data tests also passed a separate TypeScript check with ES2022,
  ESNext modules, bundler resolution, skipLibCheck, and esModuleInterop.
- The exact six-file test command in `pr-check.yml`, plus the two new test
  files: 46 passed. The shutdown tests cover all 28 IDs, both dates,
  replacements, exact/alias matching, missing rows, snapshot ambiguity,
  duplicate slugs, dry-run flags, idempotency, and localized date boundaries.
- All 33 `*.test.ts` files: 144 passed, one opt-in DB integration test skipped.
  Run with `NODE_ENV=production` for the existing production-only HTTPS proxy
  tests; without it, two proxy redirect assertions fail. The full suite command
  was `env -u ARGON_TEST_DATABASE_URL NODE_ENV=production
  DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci bash -c 'npx tsx --test $(rg
  --files src scripts -g "*.test.ts")'` (join the wrapped command into one line).
- `DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci npm run build`: pass, following
  CI's unreachable loopback DB configuration. No live DB was used.
