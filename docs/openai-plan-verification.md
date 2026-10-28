# OpenAI plan verification

The October 28, 2026 investigation found three independent failures:

- Production runs on `x2v-global`. Its daily scraper has an operator drop-in
  `20-skip-plans.conf` with `SKIP_PLANS=1` (installed October 16), so legacy plan
  scrapers do not run. Do not remove this override to enable unrelated writers.
- The ChatGPT page renders its plan names while the regional
  `backend-anon/checkout_pricing_config/configs/SG` request returns 403. Parsing
  Free and Enterprise names alone previously reported a successful refresh.
- Manually curated rows were exempt from freshness auditing, and stale-plan
  warnings were absent from the alert gate.

## Review pipeline

`npx tsx scripts/refresh-openai-plans.ts --fetch-only` reads current official
Help Center articles plus the Business pricing page. Each source gets a fresh
browser context so a challenge on one article does not contaminate the next.
Unresolved challenges, missing paid amounts, or changed table structure abort
before database writes. There is no automatic stale-data fallback.

Without flags the command previews a serializable, read-only database transaction.
`--apply` writes the reviewed OpenAI rows together in one transaction. Only the
new Business Premium row may be inserted; other missing/ambiguous identities abort.
The review clears unverified numeric message/token/context limits rather than
refreshing dates on old quota guesses. It never edits existing model selectors.

Monthly and annual amounts are distinct. Annual totals equal twelve times the
explicit annual monthly seat rate. Enterprise has a null price and contact-sales
flag. Team is marked as the historical name of Business. Go's current article
delegates pricing to checkout without a USD figure: the price remains unknown,
with no verification timestamp, instead of re-verifying the historical $8 launch
price. These are intentional unknowns, not free offers.

The precise official source is written in `[aiplans:review-source]` and used by
both price and entitlement trust labels. Only official OpenAI hostnames are allowed.

## Evidence and safe operations

Set `OPENAI_REVIEW_EVIDENCE_DIR` to a private operational directory to preserve
source URLs, capture timestamps, SHA-256 digests and the review result. Raw source
texts are operational evidence, not checked-in fixtures or a public mirror.

When the production network is challenged, an operator may collect fresh evidence
on a working browser host and explicitly pass `--evidence=/path/to/source.json`.
This path checks all source URLs, content hashes and the capture time (at most 24
hours old). It re-runs the parser and retains the original capture timestamp; it
never marks replayed evidence as newly verified. Timers do not use evidence replay.

Before an apply, save the preview and take a production PostgreSQL backup. After
apply, inspect the rows and the rendered provider page; publish the catalog using
the existing publisher if its preconditions pass.

## Scheduling

The existing daily `run-scrapers.sh` has an explicit `OPENAI_REVIEW_APPLY=1` opt-in.
This runs the reviewed OpenAI pipeline even when `SKIP_PLANS=1` protects other
legacy plan scrapers. An unsuccessful OpenAI review fails the service and retains
old rows; the existing host failure notification handles it. Audits now include
manual rows and alert on stale or missing verification, with the plan identity.

Enable the opt-in only after a successful preview/apply. Preserve operator pauses
and other providers' existing configuration. Do not claim a blocked scheduled
fetch is a successful verification.
