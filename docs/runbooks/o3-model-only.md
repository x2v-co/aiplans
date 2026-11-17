# o3 batch sparse executor

Only model3014 `o3-(batch)` → model3192 `openai-o3-batch` is supported. Both
provider59 offers remain: channel15031 OFF changes only its model FK; channel15334
LIVE keeps its existing feed. No archive, history reparenting, metadata merge,
quote/availability change, renumbering, sequence call or other model pair.

`O3Executor` in `scripts/o3-model-only/adapter.ts` exports real `preview`, `freeze`,
`rehearse`, `apply`, `repeat0`, `restoreRehearse`, `restore` and `resume` methods.
The CLI uses those methods with an explicit `O3_DATABASE_URL`, never dotenv or an
application DB singleton. No old archive executor is imported. Native execution
has not been run inside Codex. Live equivalence/approval is still separate work.

Preview opens a read-only repeatable-read transaction. It creates no files, DDL,
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
freeze never bootstrap. Apply/rehearse take a transaction advisory lock, bounded
writer-excluding table locks and row locks, recheck evaluated schema, reread the
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
full production mirror. The old partial fixture/evidence is preserved untouched.
An unrelated public function or plans enum does not create a universal blocker.
No user function bodies are exported by the executor.

Existing exact upstream OpenRouter `openai/o3:batch` → channel15334 binding,
writer ambiguity refusal, alias-before-normalization, batch selector exclusion,
materializer/coding resolver, chart and variant protections remain. The native
driver uses the real application upsert/history path and quota seed; it verifies
zero-write quota before/after/repeat and a nonempty sample collector. The ordinary
writer's quote update and history insert remain separate transactions. General
multi-offer chart/variant behavior and the other53 pairs are outside this scope.

Offline (no DB or network):

```sh
bash scripts/o3-model-only/check-offline.sh
```

Coordinator only, NORMAL Shell, freshly provisioned empty isolated database:

```sh
O3_TEST_DATABASE_URL='postgres://127.0.0.1:55439/dedupe54_test_o3_timefix_0805' node --import tsx scripts/o3-model-only/postgres.integration.ts
```

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
The timestamp/postcondition repair has offline protocol regressions only until
the coordinator executes this native command in normal Shell. The harness wraps
the real client solely in test code to reproduce the old timestamp codec, omit a
restore column, corrupt input/result and inject protected target/channel/history
writes during apply and restore. Each exported operation must refuse inside its
transaction, preserve public state and leave PREPARED_ONLY/APPLIED respectively;
a good executor then succeeds. Fresh lifecycles cover finite AD timestamp/date
boundaries, offsets, NULLs, sixth digits, bigint extremes and escaped/null arrays.
Unsupported timestamp ranges/types still refuse. Sequence/default nonexecution,
late legitimate scrape/history restore refusal and nonempty collector phases are
required. If native fails, stop and report; no automatic repair chain.

The independent core review remains11 files: eight runtime/data/runbook files,
two unit files and the SQL fixture. The native harness additionally imports the
existing dirty application replay/writer/quota modules; it is not standalone
11-file PR CI. Coordinator fullsuite/typecheck/native and live gates remain open.
Native fixture success would prove authored-profile behavior, not live readiness.
Remaining live work: fresh supported evaluated structure/privilege review, public
source restoration fields and same-snapshot identity/reference/quota checks,
backup and writer coordination, and approval of the resulting exact digest.
Do not combine older snapshots into a frozen plan. No production operation is
authorized by this runbook or implementation round.
