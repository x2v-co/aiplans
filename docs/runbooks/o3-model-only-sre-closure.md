# Legacy superseded read-only closure proposal for PR370

Use the [fresh check](o3-model-only-sre-check.md) and its shipped SQL as the recommended review. This historical check intentionally cannot approve metadata: its six missing baseline expectations remain blockers. It is retained for regression coverage, not recommended approval. No production action is authorized.

This proposal is unexecuted and grants no production authorization. The parent
and SRE must review its exact hash, SQL and expectations before choosing a live
connection outside Codex. No SRE message has been sent. A successful proposal
check would still require a fresh executor preview/freeze and separate approval.

Scope is model3014 `o3-(batch)` to3192 `openai-o3-batch`, provider59 and channels
15031 OFF /15334 LIVE. It preserves both offers, every other channel field,
target metadata, quota and history. It does not establish contract equivalence,
choose a survivor or authorize other pairs.

The SQL opens REPEATABLE READ READ ONLY, pins pg_catalog/public and UTC, sets
15s statement/1s lock/60s idle limits, and ends with explicit ROLLBACK. Every gate
failure completes ROLLBACK, emits a fixed O3_REJECT_<gate>_ROLLED_BACK marker,
then runs fixed SELECT 1 / 0; ON_ERROR_STOP produces exit3/SQLSTATE22012.
Every other nonzero exit is failure. ON_ERROR_STOP also aborts on SQL
errors; connection close rolls back that read-only transaction. Run with psql-X,
no echo-all or statement logging to an exported transcript. SQL errors use PG17 VERBOSITY sqlstate,
context disabled. Do not replace false gates, relax timeouts or automatically
query more objects. The proposal has no bootstrap, temporary table, DML, lock
acquisition, function execution by discovered name or operational SRE action.

Structure expectations are the audited profile's 55 columns/11 constraints/
7 indexes on three write tables, ten incoming model-FK families, and explicit
24 columns/33 indexes on 12 read dependencies. The SQL compares actual definitions
inside the DB to literal prelisted expectations, including both reviewed PG17
currency-check deparses. Only match booleans leave the DB. It checks builtin
type I/O/collation, index opclasses/support/operators, RI operators, recursive
constraint/index function dependencies, ordinary relation kinds, no RLS/policy/
rule/inheritance, and no unreviewed effects on the write tables or zero-row
model_plan_mapping cascade. New/missing/unsafe objects stop before row reads.
Trusted PG17 builtins/catalog ownership remain assumptions for SRE verification.

Unused defaults are neither read nor evaluated: the executor uses sparse
UPDATE/DELETE and explicitly supplies every column of both INSERTs. This does
not audit all defaults, all 33 fixture tables, unrelated enums or all public
functions. There is no pg_get_functiondef/prosrc/proconfig or function-body,
configuration, unknown-expression/hash export. pg_get_constraintdef/indexdef
results exist only in internal comparison CTEs. Read-dependency columns beyond
the prelisted24 are not compared or exported.

Row reads are limited to fixed model/channel IDs/slugs and model FK predicates,
source15031/target15334 history counts, provider59, the two served_model labels
and the two known usage mixes. No provider expansion beyond59 or sample payload
read is proposed. Source reference counts must be1 for api_channel_prices and0
for every other family. There must be exactly two identity-bound offers, no
third quote or conflicting alias, and source history0. Target history is a
count to freeze, not a demand for the fixture's71 events.

Quota reads return old-label0/canonical-current2, two distinct mixes, exact
payg:openrouter/monthly/plan_idNULL identity, numeric public source ID15334 and
known payg-list-price/numeric version1 classification. Unknown notes anywhere
in these two labels stop; notes/raw payloads and their hashes never leave DB.
Known mixes must be97/2.5/0.5 and0/75/25. Current duplicate/identity/provenance
anomalies fail the count/distinct-mix/all-row binding predicates. Historical
quota values are not migrated or exported.

The 29 MODEL columns are an explicit allowlist for comparison only:
`id`, `name`, `description`, `slug`, `type`, `provider_ids`, `context_window`,
`max_output_tokens`, `open_source`, `license`, `license_url`, `offical_link`,
`features`, `input_type`, `output_type`, `parameters`, `active parameters`,
`model_category`, `input_modalities`, `output_modalities`, `capabilities`,
`created_at`, `released_at`, `updated_at`, `pricing_unit`, `shutdown_date`,
`replacement_model`, `deprecation_source_url`, `deprecated_at`.
They are necessary to assess public identity and the executor's exact source
restoration projection. This proposal exports no field values. It emits one
prelisted label, baseline-match enum and source/target equality boolean per
field per model. Different source/target identity fields are expected; no
metadata is coalesced. The historical public fixture lacks `description`,
`created_at`, `offical_link` for BOTH models. Those six outputs are deliberately
`not_prelisted_stop`, so this unsigned proposal cannot return a final match.
Changed historical timestamps/other metadata similarly yield `different_stop`.
Parent/SRE must supply a fresh, explicit reviewed expectation for these same
allowlisted fields before approval. Do not fabricate NULLs, export unknown
values, broaden the projection or reuse historical values as a live freeze.

Static per-output-column review:

| Output | Domain and review |
| --- | --- |
| environment_ok | bool: PG17 and origin replication role only; no setting values |
| columns_ok, constraints_ok, indexes_ok, incoming_ok | bool: exact known inventory and safety; no actual object names/definitions |
| relations_ok, effects_ok, structure_ok | bool: known relation/effect checks; unknown objects only cause false |
| object_label for source_reference.* | ten literal labels from profile; no catalog-derived labels |
| row_count | count: only those model3014 refs, fixed-pair third quote/alias, two history channel counts |
| pair_ok | bool: fixed IDs/slugs/ownership/OFF/LIVE/no-third/no-alias/source ref/history guards |
| quota_rows_ok | bool: scoped identity/current/knownkind/source15334 guards |
| old_label_count, canonical_current_count | counts over exactly two served_model labels |
| current_unknown_kind_count, current_wrong_source_count | counts of current anomalies, never unknown notes content |
| notes_class | enum: known_payg_list_price_v1 or unknown_no_export; no text/hash |
| mixes_ok | bool: only two fixed mix IDs and exact numeric ratios |
| object_label for model3014.*, model3192.* | 58 literals: fixed model IDs crossed with the explicit29 columns |
| expected_class | enum: matches_prelisted / different_stop / not_prelisted_stop |
| pair_equal | bool per allowlisted field, evaluated entirely inside DB |
| metadata_ok | bool; false for absent/changed expectations |
| result | fixed terminal enum; unreachable until every expectation is signed and matches |

Expected result classes: any structure/new-object mismatch stops before business
reads; any pair/quota/mix mismatch stops before later phases; missing/changed
MODEL expectations stop at the end. This draft is expected to stop on at least
six missing baseline fields, even if structure/pair/quota happen to match. No
SQL syntax, catalog result or live equivalence has been verified by execution
in this round. The coordinator must review and validate the SQL separately.

Parent/SRE remaining requirements are concrete: review/publish a supporting
writer commit, deploy that exact writer build through the normal process, and
prove the running scraper process version; coordinate all writers and a freeze
window; verify role/catalog/marker/bootstrap privileges and private durable
journal ownership0700/files0600/fsync/storage; identify a backup and tested
restore point; estimate protected full-table scans/temporary space and a short
15-table lock window within existing15s/1s limits; review the fresh complete
public restoration expectations and same-snapshot refs/quota; obtain a new
preview digest and approve that exact freeze. A late legitimate writer/history
change means stop and re-review; do not force restore or retry apply blindly.
The proposal does not take locks to measure impact or run a writer as a probe.

Reviewed-source SHA256 (file bytes; not unknown live content):

| Source | SHA256 |
| --- | --- |
| adapter.ts | a577d5f47f6888fc5abbee42d934cd652fab1c04259d2c764787d3570e265505 |
| structure.ts | 60f054e244b4c0d1df53eb460a7b62e86fac539548e9c58660ec72047a10a85f |
| supported-affected-profile.json | 886016b232cd215ba77cec6dc466a5523c473017ada0206ec396391a60519af8 |
| public-models.json | 130dda16a80460f31f022c4511048c975efb2d1f671078fcae87b165e217e3fa |
| sre-readonly-closure.sql | a931d439a9b2430726aad5b58fe567c4d5cd8c0a26e58978cbfa12b2f2b7d20d |
