# Fresh read-only SRE check for PR370

Exact published head: `b42986a9fd6138877b9612cfac74273a5d1d74ed`. This proposal authorizes no production action. Only scratch authoring/static checks occurred. No live links were fetched or verified.

The SQL prefix preserves the original structure/pair/quota/mix gates; rejection handling alone uses the corrected exit protocol. It retains 55 columns/11 constraints/7 indexes on the three write tables; ten incoming FK families; 24 explicit read-dependency columns/33 indexes across 12 read dependencies; relation/effect/type-I/O/operator/collation/dependency checks. No schema inventory expansion, defaults evaluation, database writes or discovered-name execution is added. All failures stop. RR READ ONLY, UTC, PG17/origin, 15s statement/1s lock/60s idle deadlines and final rollback remain.

Fixed scope is source3014 -> target3192, provider59, source15031 OFF / target15334 LIVE. Exact executor identities remain independent: source name/slug o3-(batch); target name o3-batch, slug openai-o3-batch; both llm/text/context200000/per_1m_tokens. Both offers, target metadata, history and quota are preserved; there is no metadata selection or merge. Equality output is informational, never an equality requirement. Existing immutable reviewed schema/pair/quota/mix evidence remains exact; mutable model metadata is freshly reviewed and digest-bound.

Every SQL output is reviewed below. psql echoes abbreviated headings for gset variables; no hidden value variables are retained.

| Output column/variable | Complete domain and interpretation |
| --- | --- |
| environment_ok | boolean; PG17 and replication origin |
| columns_ok, constraints_ok, indexes_ok, incoming_ok, relations_ok, effects_ok, structure_ok | booleans; exact copied structural gates, no discovered definitions/names |
| object_label before metadata | ten literal source_reference table labels; pair.third_offer, pair.redirect_collision, source_channel.history, target_channel.history |
| row_count | nonnegative bigint count, fixed scoped refs/offers/aliases/history only |
| pair_ok | boolean; copied exact pair/ownership/availability/reference gates |
| quota_rows_ok | boolean; copied quota kind/version/source/identity/count gates |
| old_label_count, canonical_current_count, current_unknown_kind_count, current_wrong_source_count | nonnegative bigint counts over only two fixed served labels |
| notes_class | known_payg_list_price_v1 or unknown_no_export; unknown stops, no note text or hashes |
| mixes_ok | boolean; exact two reviewed public ratios |
| identity_ok | boolean; exact executor identities above |
| urls_ok | boolean; all three model URL fields actual NULL or exact allowlist; unknown stops first |
| metadata_domains_ok | boolean; all five model timestamp/date fields actual NULL or finite AD year1..9999; no publicness proof |
| object_label for metadata | exactly 58 literals: model3014/model3192 crossed with the 29 fields below |
| field_type | literal integer, text, timestamp with time zone, bigint, boolean, integer[], text[] or date from profile; never discovered type text |
| presence_class | actual_null or present; empty strings/arrays and text NULL are present |
| domain_class | actual_null, exact_identity, known_public_url, host_local_review |
| pair_equal | boolean per field, IS NOT DISTINCT FROM; differing metadata remains separate |
| result | READY_FOR_HOST_LOCAL_PUBLIC_METADATA_REVIEW_NOT_APPLY; no production approval |

The 29 fields and handling (both models, exact NULL retained) are:

| Fields | Handling |
| --- | --- |
| id, name, slug, type, context_window, model_category, pricing_unit | exact executor identities, no historical metadata override |
| description | native text, including long or multiline public descriptions; substantive fresh SRE local public-source comparison required; never assumed known, public or NULL from absence |
| released_at, created_at, updated_at | actual NULL or finite AD year1..9999 native microsecond timestamptz; no historical equality; preserve exact local executor six-digit UTC representation |
| offical_link, license_url, deprecation_source_url | actual NULL or exact HTTPS URLs listed literally in SQL; no URL parser normalization or widening |
| max_output_tokens | actual NULL or native bigint, without an added nonnegative restriction; retained as exact text in actual executor manifest and substantively reviewed locally |
| open_source | actual NULL or native boolean |
| features, input_type, output_type, provider_ids, input_modalities, output_modalities, capabilities | native arrays without added cardinality, byte or control-character restrictions; retain dimensions, order, NULL elements and empty arrays; substantive local content review required |
| parameters, active parameters, replacement_model, license | native text without added byte, line or control-character restrictions; public justification substantively reviewed locally |
| shutdown_date, deprecated_at | actual NULL or finite AD year1..9999 native date; exact local preservation |

Other metadata is classified only as present/actual_null plus host_local_review (actual_null for the domain class when NULL); its values never leave the host. No added byte, line, control-character, cardinality or nonnegative value limits apply. Byte/line limits and classification success prove neither publicness nor absence of PII. SRE must substantively review every such field locally against public catalog/approved source before approving a fresh whole-plan digest. PII, tokens, internal URLs, unknown notes or other nonpublic content discovered locally means STOP, no capture/export/hash. Never substitute NULL, coalesce differences, force a stale fixture, or export individual unknown-field hashes.

URL allowlist is finite: OpenAI host roots (with/without slash), openai.com/index/introducing-o3-and-o4-mini (with/without slash), platform.openai.com/docs/models/o3, developers.openai.com/api/docs/models/o3 (with/without slash), and exact upstream catalog https://openrouter.ai/openai/o3 and https://openrouter.ai/openai/o3:batch. Only lowercase exact bytes are accepted. This excludes credentials, ports, percent encoding, query/fragment/token parameters, control chars, internal/IP/suffix/lookalike hosts, unlisted paths and normalization tricks. Other public URLs also STOP pending explicit review. This is lexical classification, not live-link verification.

Two-stage closure, with no missing-expectations deadlock:

1. After explicit future coordination, SRE runs the bounded SQL on the production host; parent receives only the finite labels/booleans/counts/classes. After structure/type/URL gates, SRE freshly inspects exactly source29 and target29 locally against public catalog/approved source, including description, all other metadata and identity; this is substantive content review, not approval based on size or presence classes. There is no requirement for parent to know six metadata values before the read. The complete public beforeimage stays on that host in SRE-controlled private storage; unknown/nonpublic contents stop locally. Parent receives only the review result. Any separate inspection/capture has its own snapshot and must not be described as this SQL's snapshot.
2. Separately coordinated actual O3Executor preview stdout contains the RAW manifest (full source29/target29 and public channel fields); securely redirect stdout AND stderr on the SAME production host to exclusive regular mode0600 files in an owned mode0700 dedicated directory, umask077, no symlinks/shared logs/terminal printing/chat relay. Do not pipe through tee or print inline. SRE reviews this actual preview's metadata and source29 restore values locally before approving its fresh whole-plan digest. Only that approved whole-plan digest may leave the host. A bad local classification never licenses hashing/export of unknown content. The preview has its own RR snapshot; it does not share the earlier SQL snapshot. Later freeze calls preview again and must exactly match the approved expectedDigest before FileJournal publishes the immutable full public source29 journal (0700 directory, owned regular single-link0600 files, no symlink ancestors, fsync, atomic no-clobber link publication). Drift requires one new local preview/review/digest, never forcing the old digest. Later apply rechecks exact plan/prepared/schema under serializable transaction, advisory/table/row locks and durable marker checks. File publication is not proof of database commit. Logical immutability here is no-clobber publication and read validation, not an OS immutable attribute.

Quota notes, opaque channel notes/data_for_discount_note, unknown notes and user payload must never enter these capture/journal/export artifacts. Existing executor excludes opaque channel fields and reads quota provenance server-side; plan witnesses use physical row versions. The standalone SQL proves only its classifications, not a reviewed executor digest. Local inspection/capture, freeze filesystem writes, bootstrap and database mutations require explicit future coordination; none is authorized here.

Remaining SRE requirements: confirm the reviewed supporting writer commit/build is published/deployed and prove running scraper process version; coordinate every writer and a freeze window; verify trusted PG17/catalog ownership and origin role, SELECT/catalog access for preview, schema bootstrap CREATE privileges only for approved explicit bootstrap, marker SELECT/INSERT/UPDATE and public model/channel/redirect DML, TEMP plus table/advisory/row lock privileges for execution/conservation checks. Review exact bootstrap.sql and checkMarker schema; do not relax existing schema. Confirm durable private journal owner/modes/fsync/storage and locally reviewed source29 restore evidence. Identify backup and tested restore point; assess full-table conservation scans/temp capacity and 15-table SHARE ROW EXCLUSIVE lock window within existing deadlines. Obtain fresh approved whole-plan digest, coordinate freeze and later execution separately. No production readiness or whole54 completion follows from this proposal.

The canonical shipped SQL is `scripts/o3-model-only/sre-readonly-check.sql`; the legacy `sre-readonly-closure.sql` intentionally cannot approve metadata and is superseded. This document promotes the prior scratch SCOPE without changing the data checks. Both files set ON_ERROR_STOP on and PG17 VERBOSITY sqlstate, with SHOW_CONTEXT never. Each rejected gate completes explicit ROLLBACK, emits exactly one constant `O3_REJECT_<gate>_ROLLED_BACK`, then executes fixed read-only `SELECT 1 / 0;`. psql exits3 with SQLSTATE22012; every other nonzero status is also failure. No localized error text is matched, no SQL/value/error-message interpolation is used. Gates are environment, structure, pair, quota_rows, mixes, identity, urls, metadata_domains (legacy substitutes metadata for the final three). Markers are fixed literals, not variable output. Success ends with ROLLBACK followed by the existing fixed result; no raw metadata output is added.

The coordinator-only shipped harness is `scripts/o3-model-only/sre-closure.postgres.integration.ts`. It requires explicit O3_CLOSURE_TEST_DATABASE_URL, actual HOST(inet_server_addr())=127.0.0.1, port55439, PG17, an exact fresh suffixed closure database and empty database catalogs. Local mode permits only dedupe54 with empty password; fixed docker-ci mode permits only o3_native_ci/synthetic_ci_only and dedupe54_test_o3_closure_ci. It creates synthetic fixtures only after these checks. It loads both SQL files from the current tree, uses psql-X with sanitized child environment, code-only errors, deadlines and a fixed appended SELECT canary, and compares exact row snapshots and schema snapshots around every invocation. The schema snapshot excludes only six engine maintenance/statistics fields from pg_class: relpages, reltuples, relallvisible, relallfrozen, relfrozenxid and relminmxid. Every other pg_class field (including schema, ownership, ACL, reloptions, relfilenode and type identity) and the complete attribute, constraint, index and default projections remain compared exactly; autovacuum/autoanalyze may update the excluded fields independently during SELECT. Rejections must exit3, prove completed rollback and the exact rejection marker, and omit all later phase output, terminal output and canary. Fresh positives must exit0 with rollback, all58 classification labels and the existing terminal before the canary. Legacy metadata success is impossible and is tested as rejection. Test payloads and diagnostics stay in memory; only fixed per-case receipts leave the harness.

CI runs this same harness after the unchanged exported native lifecycle, in a second fresh database in the same ephemeral PG17 container. It uses container PG17 psql, no runner-client version assumption, and always cleans up. Coordinator execution is still required; authoring/offline checks make no PG pass claim. No production authorization is granted.

Reviewed source SHA256 (file bytes only; no live content or individual metadata hashes):

| Source | SHA256 |
| --- | --- |
| adapter.ts | a577d5f47f6888fc5abbee42d934cd652fab1c04259d2c764787d3570e265505 |
| structure.ts | 60f054e244b4c0d1df53eb460a7b62e86fac539548e9c58660ec72047a10a85f |
| fixtures/supported-affected-profile.json | 886016b232cd215ba77cec6dc466a5523c473017ada0206ec396391a60519af8 |
| fixtures/public-models.json | 130dda16a80460f31f022c4511048c975efb2d1f671078fcae87b165e217e3fa |
| sre-readonly-check.sql | a67f7ab7805061f7e773a73b445446b63b679fff010d9878631cf5db82cf1d38 |
| sre-readonly-closure.sql | a931d439a9b2430726aad5b58fe567c4d5cd8c0a26e58978cbfa12b2f2b7d20d |
| sre-closure.postgres.integration.ts | 3f62350c402ae431a8128ec8feda8443a8079a61dce42bc6ac3fb302c87d6ad0 |
