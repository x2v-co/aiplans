# o3 batch sparse executor

Only model3014 `o3-(batch)` → model3192 `openai-o3-batch` is supported. Both
provider59 offers remain: channel15031 OFF changes only its model FK; channel15334
LIVE keeps its existing feed. No archive, history reparenting, metadata merge,
quote/availability change, renumbering, sequence call or other model pair.

`O3Executor` in `scripts/o3-model-only/adapter.ts` exports real `preview`, `freeze`,
`rehearse`, `apply`, `repeat0`, `restoreRehearse`, `restore` and `resume` methods.
The CLI uses those methods with an explicit `O3_DATABASE_URL`, never dotenv or an
application DB singleton. The operator connection is caller-supplied; accepting
that URL grants no authorization and does not enforce a production-mode gate.
The strict loopback URL guard applies to synthetic test drivers only. No old
archive executor is imported. Required PG acceptance of this repair is pending in normal Shell. Live equivalence/approval is still separate work.

Every runtime entrypoint requires PostgreSQL17 and origin replication role,
matching the shipped SQL environment predicate. Setup remains SET-only; mutating
and repeat modes acquire the complete public/marker locks before their first
SELECT, including the environment check. Preview opens a read-only repeatable-read transaction. It creates no files, DDL,
markers or sequence effects. Its deterministic nonnull SHA256 covers exact public
models, safe channel fields, dependency/version witnesses, supported evaluated
structure and sparse mutation decisions. Timestamps use six-digit UTC text;
bigints/arrays travel as PostgreSQL text. Every restoration parameter first binds
as `::text` at the wire boundary, then casts to its fixed profile builtin type.
A direct `$1::timestamptz` is unsafe: postgres.js can route a string through its
Date serializer and truncate microseconds. Own redirect insert/comparison binds
also use `::text::timestamptz`. JavaScript Date objects and unsafe JS numbers
cannot enter canonical evidence.

An operator supplies the preview digest to freeze and every subsequent method.
Freeze persists only the complete source MODEL public restoration projection,
exact FK and own alias identities, schema/approval fingerprints. It does not save
channel/quota notes, payloads, their hashes, target beforeimages or unrelated rows.
Channel/quota opaque values remain server-side. Physical row-version witnesses
are public conflict fingerprints, not content hashes of those opaque fields.

An explicit, reviewed bootstrap creates only `o3_executor.commits`; preview and
freeze never bootstrap. All execution modes use READ COMMITTED. After SET LOCAL only, they acquire every
required public relation and o3_executor.commits in one SHARE ROW EXCLUSIVE LOCK
command, before any session/advisory/catalog/business SELECT. They then take the
transaction advisory and row locks, recheck evaluated schema, reread the
public inputs and rederive the digest before executing the same sparse method.
All model reference families, source history/variants, alias collisions, exact two
offers, OFF/LIVE and quota oldlabel0/canonical2 with channel15334 provenance must
hold. Supported unsupported-state errors are concrete failures, not a stub.

The prepared journal directory is owned by the operator with mode0700; files are
0600, canonical JSON, bounded, immutable and published with atomic no-clobber
link(2), file fsync and directory fsync. Symlinks, traversal, arbitrary hardlinks,
unsafe modes, replacement and tampering refuse. Restart removes only an orphan
staging hardlink to the exact published inode. The DB transaction inserts an
APPLIED marker containing the journal hash and exact poststate witnesses together
with the public changes. Before either success marker, the same transaction
proves conservation. Private temporary tables compare complete channel and
protected model/redirect multisets plus physical versions; history uses only
physical row witnesses for every row (no unaudited payload type I/O). Only
15031.model_id, source3014 insert/delete and the owned redirect may change.
Both channel IDs and all21 nonMODEL fields stay exact, including opaque notes;
server beforeimages never cross the wire, get hashed or enter the journal.
Existing reference/quota/mix/provider witnesses, evaluated shape and prerequisites
are checked again. These guards scan the protected tables under the existing
bounded lock/statement timeouts; large live tables may refuse within those limits.

Restore explicitly rereads all29 source fields using six-digit UTC timestamp
projections and text for other builtins, checks the exact column set and compares
every value with the journal. Only after this and conservation succeed does it
update the owned APPLIED marker to RESTORED. Any mismatch or omitted/coerced field
rolls back source/FK/alias and marker together. Reports return only after COMMIT
(or the deliberate rehearsal rollback).
A file alone never means committed. There is no fallible filesystem status write
after COMMIT. `resume` reads durable DB proof in a fresh process; PREPARED_ONLY
means the public transaction has no commit marker. A lost COMMIT response can be
reconciled without replaying mutations. Do not automatically retry apply.

Rehearsal performs the same mutations and validations, including marker DML, then
rolls back. It leaves the explicitly frozen prepared file and no applied marker.
Repeat0 validates committed evidence and exact poststate and makes zero DML/DDL
calls. Restore refuses row-version, quote, history, model, reference, quota, mix,
provider or alias drift, including an opaque-only update and legitimate new
scrape. Restoration explicitly inserts all29 source MODEL columns, reverses only
15031.model_id and removes only this executor's alias. It never overwrites target,
quotes or history to resolve a conflict. Row-version conflicts are conservative;
VACUUM FULL/rewrite or reverting a prior update can require fresh review.

The supported affected profile explicitly declares all55 columns with exact
0428 types/typmods/nullability/collation/identity/generated flags and authored
defaults or absence, 11 constraints, seven indexes and all ten incoming FK
families, including CASCADE families whose source row counts must be zero.
It also declares 24 read columns and33 indexes on12 dependency/read tables.
Runtime matches the evaluated structure, builtin type I/O/index/operator/FK
support, function dependencies and trigger/policy/rule/inheritance state.
Unlisted incoming FKs and indexes refuse. Statement triggers on the zero-row
model_plan_mapping cascade DELETE are checked too. Default expressions are not exported,
hashed, evaluated or compared: UPDATE/DELETE omit them, and both INSERTs supply
every column. Native assertions check sequence state across the lifecycle and
install an observable unused nextval default. All55 fixture defaults are authored
supported inputs, not claims about fresh production defaults/sequence ownership.

`fixtures/supported-public-schema.sql` retains the33-table scaffold and corrects
all captured types from0428; the three affected tables are complete under the
explicit profile. Unrelated tables/defaults/enum evidence are scaffolding, not a
full production mirror. No old partial fixture or archive dependency is needed.
An unrelated public function or plans enum does not create a universal blocker.
No user function bodies are exported by the executor.

The reviewed writer support in this tree carries exact OpenRouter upstream
`openai/o3:batch` identity to the existing model3192/provider59/channel15334.
`channel-write-target.ts` checks IDs, slugs, provider/model ownership, retained
channel15031 OFF and the exact candidate set. Unbound multirow writes, unbound fixed-target writes (including before merge
or missing quote), and writes to retained15031 refuse. Ordinary unrelated absent/single-row upserts keep their
existing behavior. Both scraper resolution and getOrCreate consult the exact
source alias before lossy canonicalization; missing/rebound identities refuse
creation. Lookup/update/history errors count as scrape failures and suppress
unseen price/variant retirement. Quote update and history insert still use
separate application transactions; a history failure can follow a price update. This remains an explicit residual:
atomicity is not needed for the sparse executor's correctness because a changed
price row version or a late history entry independently blocks restoration. The
real writer test injects a bound history CHECK failure after a committed price
update, requires an error result, zero history growth, retained15031 OFF, exactly
two offers, and inhibition of both quote and variant retirement. No all-atomic
claim is made. Unrelated absent/single-row behavior is preserved; ambiguity and
retirement failure tightening already existed in the starting tree.

Every shared production delta has a narrow purpose:

| Path | Necessary behavior |
| --- | --- |
| scripts/db/channel-write-target.ts | Stable exact feed binding; distinguish no row from multirow; preserve retained OFF quote |
| scripts/db/queries.ts | Use checked target in real upsert, scope update ownership, propagate bound history errors, refuse fixed identity recreation |
| scripts/index-dynamic.ts | Same target for comparison/update/history, resolve exact pair before normalization, suppress unsafe retirement, report caught entry errors correctly |
| scripts/scrapers/openrouter.ts | Carry the public upstream ID beside the existing generated slug |
| scripts/utils/validator.ts | Type the upstream ID without changing ordinary scraper data |
| src/lib/catalog-identity.ts | Resolve exact persisted aliases and reject conflicts/dangling targets; only fixed-pair writer callers are added |

The native harness executes these actual current source functions with injected
I/O and the existing PostgreSQL query builder, excluding only credential-loading
preludes and the main scraper scheduler. It imports the actual quota seed and
collector functions directly. It runs the existing two API SELECTs and model-page
quote/history SELECTs against PG, and the existing selector and chart helpers.
Under this pair's sourceOFF/history0/variants0 preconditions there is one visible
quote and no newly shared variant/history. Selector/materializer/host/frontend
production modules are unchanged. General multi-offer behavior is outside scope.
The existing seedQuotaPayg and pay-as-you-go implementation are unchanged; the
driver asserts actual before/after/repeated zero-write behavior.

Offline (no DB or network), with existing dependencies:

```sh
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/tsc --noEmit -p scripts/tsconfig.quota.json
node_modules/.bin/tsc --noEmit -p scripts/o3-model-only/tsconfig.json
for file in scripts/o3-model-only/*.test.ts; do node --import tsx "$file"; done
npm test
git diff --check
```

The narrow config strictly checks core/native/support modules; it does not claim
the broader unrelated index-dynamic import graph passes a global scripts check.
Do not suppress global diagnostics. Subprocess EPERM failures inside Codex must
be disclosed and rerun in normal Shell.

Coordinator only, NORMAL Shell: provision a NEW empty PG17 loopback cluster on
port55439 with no production environment. Create three distinct fresh databases
owned by synthetic role dedupe54. Supply these explicit URLs, substituting a new
lowercase alphanumeric/underscore suffix each run, then execute:

```sh
O3_TEST_DATABASE_URL="postgres://dedupe54@127.0.0.1:55439/dedupe54_test_o3_native_${RUN_ID}" \
O3_RACE_TEST_DATABASE_URL="postgres://dedupe54@127.0.0.1:55439/dedupe54_test_o3_race_${RUN_ID}" \
O3_CLOSURE_TEST_DATABASE_URL="postgres://dedupe54@127.0.0.1:55439/dedupe54_test_o3_closure_${RUN_ID}" \
bash scripts/o3-model-only/validate-normal-shell.sh
```

RUN_ID must be set explicitly. The script strips production DB variables, checks
all three URLs, runs full/focused units and all three typechecks, then runs the
real lifecycle, executable concurrency controls, and all shipped psql/runtime
parity cases. It provisions no DB and must refuse reused fixture databases.
The six existing subprocess cases and unrelated opt-in skips remain in the full
unit suite. No opt-in flag or skip was added for the new native regressions.

The driver fails on absent URL, wrong host/port/name, overrides, nonempty DB or
server identity mismatch. It prints each mode status/digest immediately, preserving
progress if a later mode fails; raw driver/SQL/assertion payloads are suppressed.
The final PASS includes the retained private journal path. It calls the same exported methods as operators, including
a fresh child process for resume. Independent server-side snapshots compare both
channels/all21 untouched fields, all71 history rows/epoch microseconds, all model
rows, quota and sequence states. No handwritten merge/delete/redirect SQL stands
in for the executor. After a complete restore-to-original cycle it applies again
solely to prove new-writer restore conflict; the dedicated fixture deliberately
ends APPLIED with a legitimate new scrape/history row for inspection.

Operator syntax (explicit connection supplied outside Codex): `cli.ts preview`,
`cli.ts bootstrap`, then `cli.ts MODE ABS_JOURNAL_DIR EXPECTED_DIGEST`. Bootstrap
must be reviewed before execution; inspect preview and approve that exact digest.
The timestamp/postcondition repair previously passed real PG in a broader local
tree. This clean PR's newly ported harness still requires coordinator execution
and remote CI before any clean-tree native PASS claim. The harness wraps
the real client solely in test code to reproduce the old timestamp codec, omit a
restore column, corrupt input/result and inject protected target/channel/history
writes during apply and restore. Each exported operation must refuse inside its
transaction, preserve public state and leave PREPARED_ONLY/APPLIED respectively;
a good executor then succeeds. Fresh lifecycles cover finite AD timestamp/date
boundaries, offsets, NULLs, sixth digits, bigint extremes and escaped/null arrays.
Unsupported timestamp ranges/types still refuse. Sequence/default nonexecution,
late legitimate scrape/history restore refusal and nonempty collector phases are
required. If native fails, stop and report; no automatic repair chain.

The clean PR now includes its self-contained native driver, test harness,
public-model fixture, six minimal shared writer/identity support paths and an
isolated `.github/workflows/o3-native.yml` check. It imports no old54/archive
source. The existing generic PR CI is unchanged. The native workflow runs on
every pull request and push to main. Before any separately authorized integration,
manual review must confirm both generic `Type-check, unit tests, build` and native
`o3 native PG17 lifecycle and rollback` success for the exact reviewed head and
actual checkout/tree recorded in the manifest. No repository settings change is
part of this work. There is no conditional
skip, optional integration flag or continue-on-error. CI uses an explicit Linux
Docker host-network PG17 container with listen_addresses=127.0.0.1 and port55439,
not GitHub service network options or bridge port publishing. Readiness, driver
and job timeouts are finite; always-cleanup removes the container and volume.
The strict actual `inet_server_addr()` guard stays enabled.

The recommended unsigned [fresh read-only check](../../scripts/o3-model-only/sre-readonly-check.sql)
and [output/scope review](o3-model-only-sre-check.md) specify remaining live
checks. The legacy [historical check](o3-model-only-sre-closure.md) intentionally
cannot approve metadata and is superseded. CI tests the shipped fresh and legacy
SQL with container PG17 psql in a second fresh synthetic database after the native
lifecycle. No proposal execution, production connection, writer deployment, merge
or production apply is authorized by fixture results. Fresh supported structure,
privileges, public restoration metadata, same-snapshot references/quota, backup,
writer coordination and approval of a fresh preview digest remain SRE/parent
requirements. Do not combine old snapshots or reuse any fixture digest.

Reviewed-head evidence replaces the old executable head/hash tables. After scope
review, the coordinator runs `node scripts/o3-model-only/review-manifest.mjs ABS_OUTPUT_JSON` from this checkout. It records the actual HEAD commit/tree,
tracked diff SHA256, hashes of every bounded source file, and whether the checkout
is dirty. An uncommitted repair is a candidate, not an approved reviewed head.
The coordinator attaches finite acceptance receipts (command, exit, PG version,
synthetic database, case/mode results) only after the corresponding normal-Shell
runs and regenerates the manifest after any change or commit. Never interpret
an old file hash table or a green CI badge as SRE approval.

The original SRE audit was unavailable during initial authoring. Its supplied
byte-identical copy, `SRE_AUDIT_ORIGINAL.md` in the parent evidence directory, was
read completely in the same-session 12:35 SGT continuation, together with
`SRE_INPUT_READ.md`, `SRE_TRANSCRIPT_HANDOFF.json` and the shared independent-audit
`INDEX.md`. Original report SHA256:
`ee97a3d700585d874f3ca8f6bbe62fc6f85d378a8572d7227396896860550666`.
This records the later read, without claiming an earlier read. The historical
CASCADE tool_result is missing; the preserved normal-Shell PG17.11 controls are
separate new evidence, not recovered historical receipts. The prior claim of
no bugs/readiness remains withdrawn. The 12:29 acceptance run stopped at a
synthetic fixture CHECK violation after ten offer/quota races; it did not reach
the moved-state or SQL/runtime parity cases. The corrected candidate still
requires a complete new normal-Shell run and independent SRE re-review. Keep
PR370 draft. These files grant no merge, deploy, production connection, implicit
bootstrap, production URL authorization or settings changes.

The mandatory native check also runs the real exported concurrent-writer races in
a third fresh database. A backend lock-wait witness precedes the actual third
offer/old-quota DML; lock timeouts do not count as a successful gate. Same-driver
SERIALIZABLE controls test LOCK snapshot behavior and CASCADE40001 independently
of the READ COMMITTED executor. The psql harness preserves its original89
invocations, then adds41 safety cases, for171 psql invocations plus actual runtime
preview/freeze/apply/rehearse coverage. The machine-readable safety-case inventory
explicitly maps the legacy historical-baseline refusal to fresh runtime success.
No production or normal-Shell acceptance follows from authoring these tests.
