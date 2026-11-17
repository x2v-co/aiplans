# Regional offer UI (PR3)

This is additive server-rendered presentation for the PR1 `OfferDTO`. Provider and model detail pages opt into their existing, bounded plan-offer loaders. Existing legacy prices, sorting, metadata, service availability, cache settings, and missing-table behavior remain intact. Empty, absent, null, or nonqualifying offers add no markup. Other database errors still propagate through PR1; this change does not disguise an outage as an empty table.

PR2 #372 is independently approved and published at `afa71da37fb2a65be02861b79507ec6c16d60e60`; PR1 #371 and PR2 remain unmerged dependencies. The five PR2 files retain their published bytes (including the curation file’s single final newline). Runtime UI imports none of their curation, archive, or dry-run data. The six quarantined candidates supply zero executable offers. The coordinator's November 17 public observations of both MiniMax monthly-offer documents describe a campaign that ended October 14, 2026. Historical regular amounts and half-price arithmetic establish no current purchasable quote. No new prices or fresh official verification were produced here.

## Display and comparison contracts

`presentOffers` revalidates the immutable PR1 contract with `normalizeOffer`, reconstructs the PR1 DTO with `offerDTO`, and checks its original price, actual charged period and derived monthly equivalent. Invalid derived data is refused; incoming optional conversion data is discarded. Duplicate stable IDs, complete business keys, or cross-offer source ownership collisions fail closed. Raw offers, archive wrappers and curation rows are not accepted read DTOs.

A displayed original price requires matching plan ID, positive revision, manual reviewed state, reviewed price scope with PR1's current scoped source evidence, explicit original amount/currency, and nonfuture observation/review timestamps. Explicit future starts and expired ends suppress the quote. No fixed stale-day rule is invented. Unknown validity is labeled unverified and cannot rank. Review of price alone does not approve market, rights, tax or purchase conditions. Those fields and their independent review states remain visible. Caller-controlled authority/reviewer strings are not production permission enforcement (N1).

The original decimal string and currency lead each quote. Region/channel labels derive from the offer identity and scoped reviews, never USD, visitor locale, provider region, availability or supported regions. International is a commercial scope with precise countries unverified. Actual billing, commitment and unit are separate. Annual and quarterly monthly equivalents use exact rational text, explicitly labeled derived rather than monthly billed. Repeating fractions remain fractions. Regular, introductory and renewal phases remain separate. Public account/residency, payment/card and seat conditions are shown with their review states. A renewal FK never supplies an amount or establishes semantic compatibility (N2).

All ranking delegates to PR1 `rankOffers` on normalized original offers. The component accepts an explicit `ComparisonContext`; it does not infer equivalent entitlements, eligibility, promotion, a freshness cutoff or an FX rate. Current pages supply no invented reviewer context, so their default is no cheapest badge. The reusable comparison path explains exclusions and shows a scoped lowest badge only with at least two PR1-comparable rows. Existing global legacy ranking is unchanged. Monthly Kimi context cannot rank an annual equivalent; different Build entitlement groups cannot rank together; GLM/Z.AI conflict rows remain hidden.

Optional secondary CNY conversion requires an explicit coherent FX bundle with validated pair, source, basis, valuation and observation times, complete original-currency coverage, and no duplicate pairs. It is recomputed with PR1 `offerDTO` using exact arithmetic, never trusted from the incoming DTO. Mixed-currency cheapest ranking independently requires PR1's complete coherent bundle, including a valid identity quote for any target-currency row. No fallback rate exists. Source observations, human reviews, FX valuation and FX observation have separate explicit-zone timestamps.

## Rendering and validation limits

The component uses Chinese/English project message namespaces and server markup with native keyboard-operable `details`/`summary`, visible focus styles, wrapping, bounded width and original-price emphasis. Documentary links pass PR1's safe public HTTPS rules and carry `noopener noreferrer`; public text is React escaped. No new client state, network acquisition, JSON/data endpoint, UI seed, metadata price or approval workflow is introduced.

DB-free presenter and SSR tests use clearly fictional synthetic fixtures. Query tests use injected row providers; adapter tests use limited statement doubles. They do not prove PostgreSQL behavior, production authorization, browser layout or accessibility tooling results. The coordinator must rerun fresh source-bound validation and independently inspect both locales at 390px, keyboard navigation, real cache/build traces and isolated startup. No build, server or DB was run in this worktree. N1 SQL role authority, N2 renewal semantics, N3 the previously missing standalone `server.runtime.prod.js`/unproven startup, N4 synthetic-PG and same-box dependency limits, plus production/merge/deployment/#370/Tailscale holds remain open.

## Private PR373 content compatibility candidate

This composition retains deployed PR373 promotion columns, `PlanOfferRow`, both
`PlanLimitedTimeOfferMark` surfaces, ISR300 and empty static params. The model loader
projects promotion metadata and optionally attaches PR1 offers to the same selected plans.
The provider price block keeps its legacy promotion mark alongside the additive regional
component. The deployed model pricing summary and its mobile tests are unchanged.
Synthetic SSR regressions pin zero-offer promotion HTML and exercise both paths together;
they are not browser, database or fresh full-build acceptance. Production routes still
supply no comparison context. Six MiniMax candidates remain quarantine, zero approved offers.

The private HEAD `908dc15aea842728fc2793138884766cb2759b9c` witnesses the same tree
`3378d377bce1c2e816b69959800f8293cd35f705` as deployed main
`e7ee90da40c40acb337afa3810d2ef54b5dc6d05`. Actual main ancestry is absent locally.
The working diff is a main-content delta, not a publishable GitHub merge-base delta.
Publication structure and fresh isolated full acceptance remain coordinator work.

Both `0017_plan_promotions.sql` and `0017_plan_price_offers.sql` retain their original
filenames and definitions. The former is registered as `040_plan_promotion_display_metadata`
in the existing accuracy runner; the offer DDL deliberately remains outside that runner
and the Drizzle journal. The shared numeric filename prefix is a rollout/registration
review requirement, not evidence that either migration is safe to run. No migration
registration, SQL execution or production authorization is added. N1–N4 remain open.
