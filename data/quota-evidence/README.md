# Community quota evidence

Keep one evidence object per `.json`, `.yaml` or `.yml` file here. Default discovery is non-recursive and excludes `.sample` files. `example.json.sample` contains fictional data only; never rename/import it as real evidence.

```bash
npm run quota:evidence                            # dry-run, no DB required
npm run quota:evidence -- data/quota-evidence/report.yaml
npm run quota:evidence -- --apply                  # explicit DATABASE_URL required
npm run quota:evidence -- --review 123 accept --apply
npm run quota:evidence -- --review 124 reject --apply
```

The CLI does not load `.env` or credential files. When `DATABASE_URL` is supplied, dry-run checks hashes inside read-only transactions. Every planned insert is printed as exact parameterized SQL plus its ordered parameter array. Apply executes that same statement with `ON CONFLICT (content_hash) DO NOTHING`. No source URLs are fetched.

## Format

The strict Zod schema is in `scripts/utils/quota-evidence.ts`. Unknown keys, unsafe integer token counts, invalid dates and invalid percentages fail validation before writes. Required fields:

| Field | Meaning |
| --- | --- |
| `plan_slug`, `source_name` | Plan identity and source (e.g. `ccusage`, `reddit`, `x`, `v2ex`, `linux.do`, `self`). |
| `url` and/or `screenshot_url` | At least one HTTP(S) source link or screenshot link. |
| `observed_at` | ISO timestamp with timezone when the sample was taken. |
| `captured_at` | ISO `YYYY-MM-DD` date when we captured the source; cannot precede the UTC observation date. |
| `raw_value` | Original claim or raw measurement text. |
| `confidence` | Requested `low`, `medium` or `high`; intake applies the rules below and records the request in notes. |

Optional `notes` defaults to empty. `author_handle` identifies the reporter. `independent_source_id` is a curator assertion of original reporter identity: retain it across reposts/platforms. Different URLs or platform names alone do not establish independence. The key is preserved in notes and used only for suggestions within the current intake batch.

For a measurement, provide `tokens: {input, cached_input, output}` as nonnegative safe integers in mutually exclusive categories, both `quota_pct_before` and `quota_pct_after` as **consumed** percentages (0–100, increasing), and `window` (`5h`, `daily`, `weekly`, `monthly`). Convert remaining percentages before submission. Readings must bracket exactly those tokens within one reset window with no other shared-pool activity.

To derive a monthly range, also supply `usage_mix_id` and `calculation`:

```json
{
  "list_prices": { "input": 1, "cached_input": 0.1, "output": 5 },
  "mix": { "cache_read_pct": 97, "input_pct": 2.5, "output_pct": 0.5 },
  "windows_per_week": 5,
  "pct_rounding_uncertainty": 0.5
}
```

These are synthetic prices in USD per million tokens, not vendor facts. Mix percentages sum to 100 and must match the referenced `usage_mixes` row. `windows_per_week` is required for `5h`/`daily`; choose a justified usage cadence. Weekly/monthly windows need no cadence. Optional rounding uncertainty defaults to ±0.5 percentage points per reading. Document model, price provenance/date, mix choice, reset assumptions and cache-write treatment in notes. The engine rejects samples too small for their meter uncertainty. The full calculation and unrounded monthly range are appended to persisted notes; this is an extrapolation, not an established weekly cap.

## Confidence and review

- A single oral/community claim, including a requested `high`, stays **low**. Tokens/percentages without explicit calculation assumptions also stay low and print “unavailable” for the range.
- A valid `measuredQuota` derivation with tokens and meter readings receives **medium**. Intake never assigns high, including to ccusage/self reports.
- Two distinct attested independent origins with matching plan/window/mix/calculation assumptions and monthly-range midpoints within 30% (`larger / smaller <= 1.3`) print a **medium suggestion** for manual review. Same-author reports and duplicate hashes do not qualify. The suggestion makes no updates.
- Every insert starts `pending`. Review is apply-only, sets `accepted`/`rejected` plus the database review timestamp, and only acts on pending rows. It never changes confidence or quota estimates. Missing/already-reviewed IDs fail explicitly.

The SHA-256 hash covers observation identity, provenance, token counts and percentage readings with normalized timestamp and sorted keys. Capture date, notes, requested confidence, independence assertion and calculation annotations are excluded so recaptures dedupe. An annotation change does not update an already ingested observation; resolve corrections manually during review.

## ccusage drafts

```bash
ccusage daily --json > /tmp/ccusage.json
npm run quota:evidence -- --from-ccusage /tmp/ccusage.json \
  --plan your-plan-slug --pct-before 10 --pct-after 30 \
  --date 2026-10-14 --output /tmp/evidence-draft.json
```

Without `--output`, the command prints just the draft JSON. It never contacts a DB and refuses `--apply`. `--output` creates a new file and refuses to overwrite one. Use `--date` when the export has multiple days; combining days could cross reset windows. Optional `--url`/`--screenshot-url` attach source links.

The draft preserves the selected raw daily record (cost and models included), maps `inputTokens` to fresh input, `cacheReadTokens` to cached input, and `outputTokens` to output. `cacheCreationTokens` are retained in raw data/notes and excluded from the three-category engine; justify a treatment before derivation. No prices are inferred from `totalCost` or model names. The date-only export uses midnight UTC as a draft placeholder: replace it with the actual observation time, verify meter scope, add source links, reset window and calculation assumptions before moving the draft into this directory. Until links are added, the draft deliberately fails intake validation.

The read-only review list is `/{locale}/internal/quota-evidence` (`en`/`zh`); it is noindex and absent from navigation/sitemap. Apply manual migrations 0005 then 0012 through the documented operator workflow before writes. Implementation and unit tests do not apply migrations.
