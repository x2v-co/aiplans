# MiniMax website curation: PR2 offline candidate materials

PR2 adds six **quarantined M Plan candidates**, not current published offers. The original
MiniMax CN/global provider and plan slugs are preserved. MiniMax Build (the separate product)
is not M Plan Build. No legacy prices, availability, PR1 contract/schema/writer/adapter,
UI or dependencies change. Parent: PR1 #371, `e9a0bef6ac00095c99bc173640163a0f5b16f6ac`.

The sanctioned web-access check could not execute under the additional read/write/process
restrictions: Node rejected entrypoint realpath access before the workflow body. This does
not establish a MiniMax outage or that its public pages require login. No official-site request
was made. Fresh official verification remains pending. The bounded existing official-document
fixtures are archive material only. Their existing test names claim 2026-10-15; neither the
original observation instant nor source publication/update time nor redirected final URL is
established. `inspectedAt` records local inspection, never official observation or review.

## Inputs and offline command

`src/lib/price-offers/curation/minimax-candidates.json` holds source hashes, bounded original
language excerpts with line locators and the six logical candidate mappings. It references the
existing CN/global fixtures rather than duplicating their text or creating another price seed.
Historical amounts live only in `historicalListing` (regular monthly rows); current draft
amount/currency remain null/unknown. The yearless October 14 first-month offer has no executable
start/end/campaign or discounted amount. No annual charge, renewal offer, tax or FX is inferred.

From the repository root, with the existing exact-lock dependencies:

```sh
node --import tsx scripts/price-offers-minimax-dry-run.ts --dry-run
```

This CLI only reads the two fixed local fixture files and prints JSON. Any option other than
`--dry-run` refuses. There is no apply, DB URL, client, environment loader, source fetching,
seed, migration or manual-review switch. A zero exit means the report ran; it does not approve
candidate data. The current report contains six quarantines, zero resolved offers and zero
approvals. No production IDs or current revisions are fabricated.

## Pure input and report contract

`dryRunMinimax(bundle, assets, mapping?, existing?, context?)` accepts all content and logical
plan-ID mappings explicitly. It performs no I/O. `mapping` rows are
`{providerSlug, planSlug, planId}` with an already-existing positive plan ID. Missing mappings
quarantine; duplicate logical mappings or reused IDs refuse. No provider/product IDs are
inferred, no fuzzy name lookup and no create-plan path exists. Production mapping presence or
a caller-provided number is not database existence/FK proof. Only the six exact M Plan slug
pairs are allowed.

Draft fields derive from PR1's strict schemas. Runtime normalization runs **all** PR1 contract
refinements before any resolved `Offer` can be returned. Deferred validation uses a private
plan/time sentinel solely for checking unknown drafts; it never leaves the function as an
offer, observation or business key. Missing plan/time/archive prerequisites keep `offer` and
`businessKey` null. `logicalBusinessKey` replaces the plan-ID dimension with the explicit
provider/plan pair so unresolved duplicates can still be rejected. A resolved business key
is PR1's unchanged complete 17-dimensional key. Amount and source times remain outside it.
The candidate IDs reserve draft identities, not production offer registrations; unknown
identity completion must never be written over an existing stable ID under PR1's writer.

Evidence documents require exact SHA256 UTF-8 content, matching original excerpts/line ranges,
allowed official host and final-host ownership, source scope and independent observation,
inspection and optional source-update times. A fresh observation requires a final URL and zoned
observation instant. Archive claims cannot be relabeled fresh. A hash binds bytes, not official
origin or truth; public URL syntax/host checks do not authenticate the capture. A future capture
and independent human scope review remain necessary. Known tax/condition/validity/promotion
facts need their specific evidence scope even to remain unverified. No note or caller string
supplies manual approval. This PR2 path refuses all manual/reviewed assertions and all invented
entitlement groups/versions; it emits at most unverified PR1 contracts for future fresh inputs.
It is deliberately not a general import engine or a manual curation approval API.

Batch ID/key collisions reject both rows. Existing occupied identities refuse all overwrite
planning, including unchanged identities: re-curation must use a separately reviewed PR1 writer
workflow. Stable-ID mismatches and mutated per-offer source IDs refuse. Sharing one documentary
source ID across different offers is legitimate; source ownership remains per offer, never
transfer or replacement. `existing` is a supplied snapshot, not a concurrency/transaction proof.
There is no current/history/source mutation here.

Reports contain per-row status/reasons, logical/resolved key, optional normalized unverified
`offer`, and a separately named historical listing. They do not manufacture DB revisions or
stored DTOs. A consumer with actual stored revisions can later use PR1 `offerDTO`; the dry-run
is not that consumer. Quarantine is excluded before comparison. Optional comparison invokes
only PR1 `rankOffers`: state, independent tax/eligibility/entitlement/validity review, actual
period/unit/commitment and same promotion context still govern. No row from the current bundle
can rank. Cross-currency coherent FX is never guessed; original amount/currency stay primary.

## Commercial scopes and remaining review

`mainland-website` and `international-website` name commercial website scopes. The mainland
market remains unknown pending price-market evidence; international retains unknown precise
country coverage. Neither site label, CNY/USD, locale nor supported_regions certifies country
eligibility, merchant identity, account residence or payment acceptance. No country list,
App Store scope or service-availability field is added.

Go/Explore equivalence is unreviewed. Local classification comments record M Plan Build CN
12x versus global 7.5x: keep them separate pending actual current rights evidence; never put
them in a shared comparison group by name. Kimi monthly, GLM/Z.AI quarterly-versus-guessed-annual
quarantine and incoherent FX are preserved as **synthetic negative safeguards**; no new collection
for these products is included.

Before PR3 can use approved offers, obtain fresh official price and period/commitment/unit
facts, separate rights/quotas and versions, precise merchant/site-market evidence, qualification
and tax terms, current promotion eligibility, explicit zoned validity, and independently checked
renewal linkage/rights. PR1 N1 authority/other-writer permissions, N2 renewal semantic proof,
N3 startup artifact completeness and N4 platform/production limits remain open. PR3 must retain
legacy/no-offer paths and use the safe ranker, not legacy global cheapest. Production migration,
apply/merge/deploy, #370 and Tailscale holds remain unchanged.

Tests in `curation/minimax.test.ts` are DB-free structural/curation and synthetic comparison
checks. In-memory writer and carrier-only driver regressions are not real PostgreSQL proof.
Source hashes and green unit tests are not current price verification or independent approval.
