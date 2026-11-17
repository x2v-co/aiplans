# Subscription price offers: PR1 contract

PR1 introduces a separate, opt-in subscription offer path. No real offers, official prices,
legacy-price changes, collection, UI, global ranking changes, or migration execution are included.
Local MiniMax/GLM/Kimi material is historical context only. All new test data is **synthetic**.
The base is `dd8cf69ee8c47f5593b3688f3e2346868a31fa96`, reconciled against the checked-out source,
not the older checkout in the CTO evaluation.

## Identity and unknowns

`Offer.identity` is a strict runtime-validated structure. `businessKey` serializes an ordered
17-field tuple: existing plan ID; reviewed entitlement group/version; market scope/country;
merchant, purchase channel, storefront country; actual billing period/count; commitment
period/count; unit/count; promotion kind/campaign ID; eligibility class. Price, source time,
validity bounds and tax are not identity. Offer ID is separately stable. Never merge CN/global
plans by name, model selector or tier. `plans.product_id` remains a providers FK.

Every SQL identity column is NOT NULL. Null contract values map to `''` for text or `0` for
counts; these values cannot be supplied as known values by the runtime contract. The complete
SQL UNIQUE constraint includes all 17 dimensions. A CHECK ties the structured snapshot to
those columns. A different identity requires a different offer ID; reused identities/IDs refuse.
Unknown identity dimensions are deterministic placeholders, never unrestricted rights.

A market is `country` with an explicit country code, `international` with unknown precise
country coverage, or `unknown`. Storefront country is independent and applies to store channels.
Country strings are uppercase alpha-2 syntax; reviewers must confirm the actual ISO country
and source scope. No country coverage list is inferred. Merchant identifies the seller, not
service availability. Currency, locale, china/global/both defaults, supported_regions and
access_from_china never certify markets or purchase eligibility. Existing #327/#329 semantics
and plan/provider precedence remain untouched.

## Exact prices and evidence

`price.amount` is the **actual charge for the identity's period and unit count**. Decimal
strings are normalized without rounding. Money is limited to 12 integer digits and the
explicit supported currency scale: CNY/USD/EUR/GBP/HKD/SGD/CAD/AUD/INR two digits; JPY/KRW zero.
Other currencies need an explicit later contract extension. No currency default. Free is an
explicit zero; sales/unknown have no amount. SQL uses `numeric` without a precision typmod,
with scale/range checks to reject rather than round input. Pure calculations use bigint
integers and rational values; JSON DTOs contain decimal/integer strings, never bigint/float.

Annual and quarterly monthly equivalents are labeled exact rationals for display only.
Billing remains actual one year or three months. They never replace a monthly-billed rank.
Kimi consumers must keep the monthly billing context; PR1 leaves its existing presentation
and values intact. No annual charge, promotion, tax amount or renewal price is derived.

Unknowns remain independent for price, tax, account/payment/seat conditions, eligibility,
entitlements, channel/market, promotion and published validity. A reviewed price does not
review another field. Each reviewed scope needs evidence observed and reviewed at the current
snapshot's instants. Sources have immutable IDs, safe public HTTPS documentary URLs (no
userinfo/query/fragment/local/IP hosts), scope, public note and a non-secret reviewer identifier.
Reviewers must also ensure notes/paths/conditions contain only public evidence, never credentials.
The validator checks URL structure; it does not perform DNS requests or certify a domain's content.

All instants require explicit zones and normalize to UTC, with observed/reviewed/published
validity/FX valuation and FX observation kept separate. Reviewed open-ended validity requires
an explicit start and open-ended assertion. Missing bounds remain unknown. Promotions have
campaign IDs and explicit eligibility classes; intro ranking requires a renewal association.
SQL renewal IDs reference existing offers; data review must confirm the associated renewal
rights, price, validity and qualification. There is no guessed unrestricted promotion or TTL.

## Writer, transactions and races

`writeOffer(store, input, expectedRevision)` is dependency-injectable. Creation expects revision
0; replacement requires the current revision. Production wiring is deliberately not activated.
`createPostgresOfferStore(existingSql)` constructs no client and reads no environment. It uses
one `sql.begin` transaction, sorted transaction advisory locks on stable ID **and** full business
key (including absent rows), then row locks and CAS. SQL identity uniqueness backs creation.
A conflicting ID/key, duplicate/older observation, erased/older review, reviewed-scope downgrade,
manual-to-scraper replacement, immutable-source mutation or CAS race refuses. Scraper intake
cannot claim manual review. New observations require new immutable evidence. Known currency, tax,
public purchase descriptions, validity bounds/explicit no-end assertions and renewal associations
cannot be replaced or erased, even if incoming data claims quarantine. Within the same stable
ID and full business key, a manual reviewer can complete an unknown original price/currency,
tax fact/description, purchase description or validity bound, or upgrade unknown/unverified
field metadata to reviewed. Each completion/approval needs a NEW immutable reviewed source
for that scope at the incoming observation/review instants; other scopes remain independent.
Known text/instants stay fixed. Null end with false openEnded is unknown; true openEnded is an
explicit no-end fact, never replaced by an end. Review levels cannot decrease. Renewal linkage
(including null), unknown identity completion and a general known-terms-change lifecycle are
outside this path. Existing same-currency priced/free charge updates remain supported; sales
is distinct, and known charge/currency cannot be erased into unknown. A changed real business
context requires its own explicitly reviewed identity; never fabricate identity dimensions to
bypass the unique key for enrichment. The current unchanged terms can be explicitly flagged
conflict with new evidence. Conflict/withdrawn/stale/unverified snapshots cannot rank; resolving
a conflict requires a subsequent explicit reviewed write with matching terms.

Current snapshot, immutable revision and each new source are saved in that transaction.
Any failure must roll back all three. Current DTOs retain the source ledger; sources/revisions
are never deleted by this writer. The ledger is bounded at 1,000 entries: excess intake refuses,
never prunes. A later archival design is required before reaching that limit. Subscription
history does not use API `price_history`.

**Assumptions to prove on fresh local PostgreSQL:** default READ COMMITTED visibility after
advisory-lock acquisition, transaction-pool pinning, creation races across connections, unique
constraints with unknown dimensions, real driver parameter binding, CAS, FK checks and rollback
on source failure. SQL/check-shape doubles and the in-memory transaction model are DB-free
contract tests, not proof of PostgreSQL behavior. Independent direct SQL writers can bypass
application review policy; SRE must review append-only permissions and writer coordination
before enabling writes. This PR grants no production roles and adds no automatic retry.

## Compatible readers and comparison

`attachPriceOffers(plans, reader)` is a DB-free generic adapter. `getPlans`, `getModelPlans`,
and `getPlansByProvider` each accept opt-in `includePriceOffers`; default pages/APIs use their
unchanged legacy queries/order/prices. No UI consumes offers yet. Typed DTOs retain original
price, actual period, market/channel, tax/qualification, review states, scoped sources and
all time fields. `offerDTO(stored, fx?)` optionally exposes a separate exact rational conversion
with complete validated FX provenance. Invalid/mismatched FX refuses; conversion alone does
not authorize ranking.

The Postgres reader probes **only** `to_regclass('public.plan_price_offers')`. An absent exact
relation yields `missing-table` plus empty offers; an existing relation with zero offers yields
`available` plus empty offers. Neither fabricates verified offers from legacy defaults.
Permission, syntax, connection and other missing-relation errors propagate. Concurrent table
removal after the probe also propagates; migration is additive and readers never create tables.
Pure tests import no real client or credential loader. Opt-in reads assume a complete atomic
migration; invalid stored contracts fail visibly rather than being silently ignored.

`rankOffers` requires an explicit reviewed entitlement/version, actual billing/commitment/unit,
promotion/campaign/eligibility and exact public purchase-condition context. Included and
reviewed tax is required for payable-price ranking; excluded tax remains visible but does
not imply a known final charge. Unknown qualification, stale/conflicting/withdrawn/unverified
evidence, inactive/unknown validity, rights/period differences or unknown market/channel exclude
with reasons. The caller supplies a reviewed-since cutoff; null disables ranking, not a universal
expiry policy. Same original currency needs no FX. Mixed currencies require a complete set
of reviewed base/quote quotes (including an explicit rate-one identity quote) with one target,
source, valuation instant and basis. Malformed/unsupported/incomplete FX disables the entire
mixed-currency set. No rate-one fallback, inverse guess, locale mapping or partial-subset winner.
Ties sort by stable ID. Empty eligible sets return no cheapest. Existing global cheapest
logic is deliberately unchanged; PR3 must explicitly use this safe path.

Synthetic negative fixtures cover MiniMax Build CN 12x versus global 7.5x rights, GLM/Z.AI
quarterly-versus-guessed-annual conflict, Kimi actual monthly billing, unknown qualifications,
tax and validity, and unsupported FX. None claims current official prices were verified.

## Migration and later gates

`drizzle/0017_plan_price_offers.sql` defines only three additive tables. It is deliberately
absent from the automatic runner/journal, contains no seed/backfill and is not idempotent:
existing relations should stop execution for investigation, not silently accept an unknown
schema. A coordinator should execute it in a reviewed transaction only after independent
fresh-empty-local-Postgres acceptance. No migration ran in the Codex sandbox. Schema tests
check exported Drizzle names/columns/checks/unique keys/FK resolution, not SQL execution.

Future acceptance must use a newly created empty database named
`dedupe54_test_region_offers_pr1_*`, explicit loopback `127.0.0.1:55439`, synthetic local roles,
clean environment and no inherited/default connection strings. Refuse non-loopback, occupied
or reused evidence databases; never drop/reuse evidence DBs or clear unrelated tables. Do not
start servers/install tools as part of these checks. No DB harness is shipped/executed in PR1;
coordinator must prepare and review these guards before a separate real-PG run. Required cases:
missing-table/zero-offer legacy reads; migration + unknown-key uniqueness; distinct channels;
concurrent same-key IDs; concurrent older/newer/CAS writes; manual-vs-scraper protection;
forced source failure leaving all three tables unchanged; malformed numeric/FK rejection.

PR2 must obtain fresh limited official MiniMax evidence, review equivalence (Build remains
separate), tax/qualification/promotion/renewal/validity and resolve the GLM conflict before use.
PR3 depends on PR1 plus approved PR2 data and must cover Chinese/English/mobile details and
conservative ranking. App Store/global collection, price changes, production migration,
publication and #370/Tailscale/production holds remain outside this authorization.
