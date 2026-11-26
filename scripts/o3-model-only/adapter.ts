/** One pair, sparse production adapter. Explicit injected connection only. No application
 * DB singleton, credential loading, archive executor, sequence calls or implicit bootstrap. */
import { readFileSync } from 'node:fs';
import type { Sql } from 'postgres';
import { FileJournal, type Prepared } from './file-journal';
import { PAIR, MODEL_FK_TABLES, canonical, digest, invariant, requireDigest, assertPair, type Mode } from './exact';
import { checkStructure, checkMarker, profile, qualified, identifier } from './structure';
import { publicGates } from './public-gates';
export { PAIR, MODEL_FK_TABLES, canonical, assertPair, MODES } from './exact';
export type { Mode } from './exact';
type TextRow = Record<string, string | null>;
type State = Record<string, unknown>;
export type Manifest = {
  version: 'o3-executable-v1'; pair: typeof PAIR; schemaDigest: string;
  sourceModel: TextRow; targetModel: TextRow; channels: TextRow[]; conflictState: State;
  mutation: { fk: Prepared['fk']; alias: Prepared['alias']; deleteModel: 3014 };
  decisions: string[];
};
export type Plan = { status: 'READY'; executable: true; planDigest: string; manifest: Manifest };
const fk: Prepared['fk'] = { table: 'api_channel_prices', id: 15031, old: 3014, next: 3192 };
const alias: Prepared['alias'] = { old_slug: 'o3-(batch)', model_id: 3192,
  reason: 'o3-model-only:3014->3192:v1', created_at: '2026-11-17 00:00:00+00' };
const locks = [...new Set(['models', ...MODEL_FK_TABLES, 'price_history', 'quota_estimates', 'usage_mixes', 'providers'])].sort();
const rollback = Symbol('o3 intentional rollback');
function projection(table: string, excluded: string[] = []) {
  return profile.columns.filter(c => c.table === table && !excluded.includes(c.name))
    .map(c => (c.type === 'timestamp with time zone'
      ? `to_char(${identifier(c.name)} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
      : `${identifier(c.name)}::text`) + ` AS ${identifier(c.name)}`).join(',');
}
async function setup(tx: Sql) {
  await tx`SET LOCAL search_path=pg_catalog,public`;
  await tx`SET LOCAL timezone='UTC'`;
  await tx`SET LOCAL datestyle='ISO, YMD'`;
  await tx`SET LOCAL intervalstyle='postgres'`;
  await tx`SET LOCAL extra_float_digits=3`;
  await tx`SET LOCAL statement_timeout='15s'`;
  await tx`SET LOCAL lock_timeout='1s'`;
  await tx`SET LOCAL synchronous_commit='on'`;
  await tx`SET LOCAL idle_in_transaction_session_timeout='60s'`;
}
async function sessionGate(tx: Sql) {
  const [session] = await tx`SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999
    AND current_setting('session_replication_role')='origin' AS ok`;
  invariant(session.ok, 'Runtime environment requires PostgreSQL 17 and origin session_replication_role');
}
async function lock(tx: Sql) {
  // Acquire the COMPLETE relation scope, including the durable marker, before
  // any SELECT. READ COMMITTED then gives every post-lock statement a fresh
  // view; all DML/DDL writers of these relations stay excluded through COMMIT.
  // LOCK itself does not establish a snapshot (PG17 PlannedStmtRequiresSnapshot).
  await tx.unsafe('LOCK TABLE ' + [...locks.map(qualified), 'o3_executor.commits'].sort().join(',') + ' IN SHARE ROW EXCLUSIVE MODE');
  const [r] = await tx`SELECT pg_try_advisory_xact_lock(3014,3192) AS ok`;
  invariant(r.ok, 'o3 executor advisory lock busy');
}
async function models(tx: Sql): Promise<TextRow[]> {
  return await tx.unsafe(`SELECT ${projection('models')} FROM public.models WHERE id IN (3014,3192) OR slug IN ('o3-(batch)','openai-o3-batch') ORDER BY id`) as unknown as TextRow[];
}
async function channels(tx: Sql): Promise<TextRow[]> {
  // Opaque values are never fetched, hashed, exported or stored by the executor.
  return await tx.unsafe(`SELECT ${projection('api_channel_prices', ['notes','data_for_discount_note'])}
    FROM public.api_channel_prices WHERE id IN (15031,15334) OR model_id IN (3014,3192) ORDER BY id`) as unknown as TextRow[];
}
async function prerequisites(tx: Sql, moved: boolean) {
  await publicGates(tx, moved);
  const ms = await models(tx);
  invariant(ms.length === (moved ? 1 : 2), 'Model row/slug collision or source/target missing');
  invariant(ms.some(m => m.id === '3192' && m.slug === PAIR.targetSlug && m.name === 'o3-batch'
    && m.type === 'llm' && m.context_window === '200000' && m.model_category === 'text' && m.pricing_unit === 'per_1m_tokens'), 'Target public identity/SKU drift');
  if (!moved) invariant(ms.some(m => m.id === '3014' && m.slug === PAIR.sourceSlug && m.name === 'o3-(batch)'
    && m.type === 'llm' && m.context_window === '200000' && m.model_category === 'text' && m.pricing_unit === 'per_1m_tokens'), 'Source public identity/SKU drift');
  const cs = await channels(tx);
  invariant(cs.length === 2 && cs[0].id === '15031' && cs[0].model_id === (moved ? '3192' : '3014')
    && cs[0].provider_id === '59' && cs[0].is_available === 'false'
    && cs[1].id === '15334' && cs[1].model_id === '3192' && cs[1].provider_id === '59' && cs[1].is_available === 'true',
    'Require exact two offers 15031 OFF / 15334 LIVE, provider59; third row/model/channel drift');
  for (const table of MODEL_FK_TABLES.filter(t => t !== 'api_channel_prices')) {
    const [r] = await tx.unsafe(`SELECT count(*)::text AS n FROM ${qualified(table)} WHERE model_id=3014`);
    invariant(r.n === '0', `Source reference conflict: ${table}.model_id`);
  }
  const [h] = await tx`SELECT count(*)::text AS n FROM public.price_history WHERE channel_price_id=15031`;
  invariant(h.n === '0', 'Source history conflict: price_history.channel_price_id=15031');
  const redirects = await tx`SELECT old_slug,model_id::text,reason,created_at::text FROM public.model_slug_redirects
    WHERE old_slug IN ('o3-(batch)','openai-o3-batch') OR model_id IN (3014,3192) ORDER BY old_slug`;
  invariant(moved ? redirects.length === 1 && canonical(redirects[0]) === canonical({ ...alias, model_id: '3192' })
    : redirects.length === 0, 'Alias collision/drift: require no prior aliases and only own redirect after apply');
  const mixes = await tx`SELECT id,cache_read_pct::text,input_pct::text,output_pct::text FROM public.usage_mixes
    WHERE id IN ('coding-high-cache','chat') ORDER BY id`;
  // Exact approved mix values are checked against the application constants below in SQL.
  const [validMix] = await tx`SELECT count(*)=2 AND bool_and(coalesce(
    CASE id WHEN 'coding-high-cache' THEN cache_read_pct=97 AND input_pct=2.5 AND output_pct=0.5
    WHEN 'chat' THEN cache_read_pct=0 AND input_pct=75 AND output_pct=25 ELSE false END,false)) AS ok
    FROM public.usage_mixes WHERE id IN ('coding-high-cache','chat')`;
  invariant(validMix.ok && mixes.length === 2, 'Quota usage_mixes precondition drift');
  const [provider] = await tx`SELECT count(*)=1 AND bool_and(slug='openrouter') AS ok FROM public.providers WHERE id=59`;
  invariant(provider.ok, 'Provider59 identity drift');
  return { ms, cs };
}
/** Conflict witnesses contain only public keys and physical row versions, never opaque
 * column values or their hashes. Any UPDATE (including an opaque-only change), replacement,
 * new reference, new sample/quote/history version causes a conservative restore conflict. */
async function conflictState(tx: Sql): Promise<State> {
  const state: State = {};
  for (const table of [...new Set([...MODEL_FK_TABLES, 'models'])].sort()) {
    const where = table === 'models' ? 'id IN (3014,3192) OR slug IN (\'o3-(batch)\',\'openai-o3-batch\')' : 'model_id IN (3014,3192)';
    state[table] = await tx.unsafe(`SELECT tableoid::text AS relation,ctid::text AS tuple,xmin::text AS version
      FROM ${qualified(table)} WHERE ${where} ORDER BY ctid`);
  }
  state.history = await tx`SELECT id::text,ctid::text AS tuple,xmin::text AS version FROM public.price_history
    WHERE channel_price_id IN (15031,15334) ORDER BY id`;
  state.quota = await tx`SELECT id::text,ctid::text AS tuple,xmin::text AS version FROM public.quota_estimates
    WHERE served_model IN ('o3-(batch)','openai-o3-batch') ORDER BY id`;
  state.mixes = await tx`SELECT id,ctid::text AS tuple,xmin::text AS version FROM public.usage_mixes WHERE id IN ('coding-high-cache','chat') ORDER BY id`;
  state.provider = await tx`SELECT id::text,ctid::text AS tuple,xmin::text AS version FROM public.providers WHERE id=59`;
  return state;
}
async function plan(tx: Sql): Promise<Plan> {
  const schemaDigest = await checkStructure(tx);
  const { ms, cs } = await prerequisites(tx, false);
  const manifest: Manifest = { version: 'o3-executable-v1', pair: PAIR, schemaDigest,
    sourceModel: ms.find(m => m.id === '3014')!, targetModel: ms.find(m => m.id === '3192')!, channels: cs,
    conflictState: await conflictState(tx), mutation: { fk, alias, deleteModel: 3014 },
    decisions: ['retain both offers and every other channel field', 'retain all history and quote dimensions',
      'preserve target metadata; restore source with every explicit public column', 'no sequence/default evaluation',
      'opaque channel/quota fields remain server-side; physical versions detect conflicts',
      'source OFF/history0/variants0/other references0; quota oldlabel0/canonical2'] };
  return { status: 'READY', executable: true, planDigest: digest(manifest), manifest };
}
function prepared(p: Plan): Prepared {
  return { version: 'o3-sparse-v1', planDigest: p.planDigest, schemaDigest: p.manifest.schemaDigest,
    sourceModel: p.manifest.sourceModel, fk, alias, inputFingerprint: digest(p.manifest) };
}
export async function bootstrapO3(sql: Sql) {
  await sql.begin(async raw => {
    const tx = raw as unknown as Sql; await setup(tx); await sessionGate(tx);
    const [r] = await tx`SELECT to_regnamespace('o3_executor') IS NULL AS absent`;
    invariant(r.absent, 'Bootstrap requires absent o3_executor namespace; never changes an existing namespace');
    await tx.unsafe(readFileSync(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
    await checkMarker(tx);
  });
}
export class O3Executor {
  constructor(private readonly sql: Sql, private readonly journalDirectory?: string) {}
  private journal() { invariant(this.journalDirectory, 'Explicit journal directory required'); return new FileJournal(this.journalDirectory); }
  async preview(): Promise<Plan> {
    return this.sql.begin('isolation level repeatable read read only', async raw => {
      const tx = raw as unknown as Sql; await setup(tx); await sessionGate(tx); return plan(tx);
    }) as unknown as Promise<Plan>;
  }
  async freeze(expectedDigest: string) {
    requireDigest(expectedDigest);
    const p = await this.preview(); invariant(p.planDigest === expectedDigest, 'Approval digest mismatch during freeze');
    const journalHash = this.journal().publish(prepared(p));
    return { status: 'FROZEN', planDigest: p.planDigest, journalHash, journalPath: this.journalDirectory };
  }
  async rehearse(expectedDigest: string) { return this.execute(expectedDigest, false, true); }
  async apply(expectedDigest: string) { return this.execute(expectedDigest, false, false); }
  async repeat0(expectedDigest: string) { return this.execute(expectedDigest, true, false, true); }
  async restoreRehearse(expectedDigest: string) { return this.execute(expectedDigest, true, true); }
  async restore(expectedDigest: string) { return this.execute(expectedDigest, true, false); }
  private async execute(expectedDigest: string, restoring: boolean, rehearsal: boolean, repeat = false): Promise<Record<string, unknown>> {
    requireDigest(expectedDigest);
    const journal = this.journal().read(expectedDigest); const journalHash = digest(journal);
    invariant(journal.inputFingerprint === expectedDigest && canonical(journal.fk) === canonical(fk)
      && canonical(journal.alias) === canonical(alias), 'Prepared journal identity/digest mismatch');
    let report: Record<string, unknown> | undefined;
    try {
      await this.sql.begin('isolation level read committed', async raw => {
        const tx = raw as unknown as Sql; await setup(tx); await lock(tx); await sessionGate(tx);
        const schemaDigest = await checkStructure(tx); invariant(schemaDigest === journal.schemaDigest, 'Journal schema digest drift');
        await tx`SELECT id FROM public.models WHERE id IN (3014,3192) ORDER BY id FOR UPDATE`;
        await tx`SELECT id FROM public.api_channel_prices WHERE id IN (15031,15334) ORDER BY id FOR UPDATE`;
        await checkMarker(tx);
        const markers = await tx`SELECT journal_hash,phase,post_state FROM o3_executor.commits WHERE plan_digest=${expectedDigest} FOR UPDATE`;
        if (!restoring) {
          invariant(markers.length === 0, 'Existing durable marker; reconcile with repeat0/restore');
          const p = await plan(tx);
          invariant(p.planDigest === expectedDigest && canonical(prepared(p)) === canonical(journal), 'Approval digest/input/public beforeimage drift under lock');
          await mutate(tx);
          const post = await conflictState(tx);
          await tx`INSERT INTO o3_executor.commits(plan_digest,journal_hash,phase,post_state)
            VALUES (${expectedDigest},${journalHash},'APPLIED',${tx.json(post as any)})`;
          report = { status: rehearsal ? 'REHEARSED_ROLLBACK' : 'APPLIED', planDigest: expectedDigest, publicMutations: 3, durablePublicMutations: rehearsal ? 0 : 3 };
        } else {
          invariant(markers.length === 1 && markers[0].journal_hash === journalHash, 'Missing committed proof or journal tamper; filesystem alone never proves commit');
          invariant(markers[0].phase === 'APPLIED', 'Durable marker is already RESTORED; no mutation authorized');
          await prerequisites(tx, true);
          invariant(canonical(await conflictState(tx)) === canonical(markers[0].post_state), 'Restore/repeat conflict: new writer/history/reference/metadata/opaque row version');
          if (repeat) report = { status: 'REPEAT0', planDigest: expectedDigest, publicMutations: 0 };
          else {
            await restoreMutation(tx, journal.sourceModel);
            const marked = await tx`UPDATE o3_executor.commits SET phase='RESTORED',post_state=${tx.json(await conflictState(tx) as any)}
              WHERE plan_digest=${expectedDigest} AND phase='APPLIED' AND journal_hash=${journalHash} RETURNING plan_digest`;
            invariant(marked.length === 1, 'Restore marker ownership/cardinality conflict');
            report = { status: rehearsal ? 'RESTORE_REHEARSED_ROLLBACK' : 'RESTORED', planDigest: expectedDigest, publicMutations: 3, durablePublicMutations: rehearsal ? 0 : 3 };
          }
        }
        if (rehearsal) throw rollback;
      });
    } catch (e) {
      if (e !== rollback) {
        // PostgreSQL diagnostics can embed opaque row/check inputs. Emit SQLSTATE only.
        if (e && typeof e === 'object' && 'severity' in e) throw new Error('PostgreSQL operation refused; SQLSTATE ' + String((e as {code?: string}).code));
        throw e;
      }
    }
    invariant(report, 'Missing operation report'); return report;
  }
  /** Reconcile a crash after COMMIT or an unknown client result, from a fresh process.
   * Status is durable DB proof; poststate is checked separately by repeat0/restore. */
  async resume(expectedDigest: string) {
    const j = this.journal().read(requireDigest(expectedDigest));
    return this.sql.begin('isolation level repeatable read read only', async raw => {
      const tx = raw as unknown as Sql; await setup(tx); await sessionGate(tx); await checkMarker(tx);
      const rows = await tx`SELECT journal_hash,phase FROM o3_executor.commits WHERE plan_digest=${expectedDigest}`;
      if (!rows.length) return { status: 'PREPARED_ONLY', planDigest: expectedDigest };
      invariant(rows[0].journal_hash === digest(j), 'Journal hash differs from durable commit proof');
      return { status: rows[0].phase, planDigest: expectedDigest };
    });
  }
}
// These beforeimages never cross the wire or enter a journal/hash. Compare full
// multisets and physical versions so even a no-op protected UPDATE is refused.
// History needs physical witnesses only: do not invoke unaudited payload type I/O.
// Fixed tables only; no journal/CLI identifiers, types or expressions are used.
async function conservationBefore(tx: Sql) {
  await tx`CREATE TEMP TABLE o3_guard_channels ON COMMIT DROP AS
    SELECT id,to_jsonb(c) AS value,CASE WHEN id=15031 THEN NULL ELSE ctid::text END AS tuple,
      CASE WHEN id=15031 THEN NULL ELSE xmin::text END AS version FROM public.api_channel_prices c`;
  await tx`CREATE TEMP TABLE o3_guard_models ON COMMIT DROP AS
    SELECT to_jsonb(m) AS value,ctid::text AS tuple,xmin::text AS version FROM public.models m WHERE id<>3014`;
  await tx`CREATE TEMP TABLE o3_guard_history ON COMMIT DROP AS
    SELECT tableoid::text AS relation,ctid::text AS tuple,xmin::text AS version FROM public.price_history`;
  await tx`CREATE TEMP TABLE o3_guard_redirects ON COMMIT DROP AS
    SELECT to_jsonb(r) AS value,ctid::text AS tuple,xmin::text AS version FROM public.model_slug_redirects r WHERE old_slug<>'o3-(batch)'`;
  const state = await conflictState(tx);
  delete state.models; delete state.api_channel_prices; delete state.model_slug_redirects;
  return state;
}
async function conservationAfter(tx: Sql, before: State, moved: boolean) {
  const [guard] = await tx`WITH current_channels AS (
      SELECT id,to_jsonb(c) AS value,CASE WHEN id=15031 THEN NULL ELSE ctid::text END AS tuple,
        CASE WHEN id=15031 THEN NULL ELSE xmin::text END AS version FROM public.api_channel_prices c
    ), expected_channels AS (
      SELECT id,CASE WHEN id=15031 THEN jsonb_set(value,'{model_id}',to_jsonb(CASE WHEN ${moved} THEN 3192 ELSE 3014 END))
        ELSE value END AS value,tuple,version FROM pg_temp.o3_guard_channels
    ), current_models AS (
      SELECT to_jsonb(m) AS value,ctid::text AS tuple,xmin::text AS version FROM public.models m WHERE id<>3014
    ), current_history AS (
      SELECT tableoid::text AS relation,ctid::text AS tuple,xmin::text AS version FROM public.price_history
    ), current_redirects AS (
      SELECT to_jsonb(r) AS value,ctid::text AS tuple,xmin::text AS version FROM public.model_slug_redirects r WHERE old_slug<>'o3-(batch)'
    ) SELECT
      NOT EXISTS((TABLE current_channels EXCEPT ALL TABLE expected_channels) UNION ALL
        (TABLE expected_channels EXCEPT ALL TABLE current_channels)) AS channels,
      NOT EXISTS((TABLE current_models EXCEPT ALL TABLE pg_temp.o3_guard_models) UNION ALL
        (TABLE pg_temp.o3_guard_models EXCEPT ALL TABLE current_models)) AS models,
      NOT EXISTS((TABLE current_history EXCEPT ALL TABLE pg_temp.o3_guard_history) UNION ALL
        (TABLE pg_temp.o3_guard_history EXCEPT ALL TABLE current_history)) AS history,
      NOT EXISTS((TABLE current_redirects EXCEPT ALL TABLE pg_temp.o3_guard_redirects) UNION ALL
        (TABLE pg_temp.o3_guard_redirects EXCEPT ALL TABLE current_redirects)) AS redirects`;
  invariant(guard.channels && guard.models && guard.history && guard.redirects, 'Transactional conservation invariant failed');
  const after = await conflictState(tx);
  delete after.models; delete after.api_channel_prices; delete after.model_slug_redirects;
  invariant(canonical(after) === canonical(before), 'Transactional reference/history/quota conservation invariant failed');
  // Recheck actual shape and every reference/own-alias/offer prerequisite before marker DML.
  await checkStructure(tx);
  await prerequisites(tx, moved);
  await tx`DROP TABLE pg_temp.o3_guard_channels,pg_temp.o3_guard_models,pg_temp.o3_guard_history,pg_temp.o3_guard_redirects`;
}
async function mutate(tx: Sql) {
  const before = await conservationBefore(tx);
  const updated = await tx`UPDATE public.api_channel_prices SET model_id=3192 WHERE id=15031 AND model_id=3014 RETURNING id`;
  invariant(updated.length === 1, 'Sparse FK update cardinality conflict');
  const removed = await tx`DELETE FROM public.models WHERE id=3014 AND slug='o3-(batch)' RETURNING id`;
  invariant(removed.length === 1, 'Source delete cardinality conflict');
  await tx`INSERT INTO public.model_slug_redirects(old_slug,model_id,reason,created_at)
    VALUES (${alias.old_slug},${alias.model_id},${alias.reason},${alias.created_at}::text::timestamptz)`;
  await conservationAfter(tx, before, true);
}
async function restoreMutation(tx: Sql, row: TextRow) {
  const cols = profile.columns.filter(c => c.table === 'models');
  invariant(canonical(Object.keys(row).sort()) === canonical(cols.map(c => c.name).sort()) && row.id === '3014' && row.slug === PAIR.sourceSlug,
    'Source restoration projection must enumerate every public model column');
  invariant(cols.every(c => row[c.name] === null || typeof row[c.name] === 'string'), 'Source restoration values must be text or NULL');
  const before = await conservationBefore(tx);
  // First cast fixes wire OID to TEXT. A direct timestamptz cast invokes the
  // postgres.js Date serializer and truncates microseconds even for string input.
  // Types/columns come ONLY from the fixed reviewed profile, never from the row.
  await tx.unsafe('INSERT INTO public.models (' + cols.map(c => identifier(c.name)).join(',') + ') VALUES ('
    + cols.map((c,i) => '$' + (i+1) + '::text::' + c.type).join(',') + ')', cols.map(c => row[c.name]));
  const updated = await tx`UPDATE public.api_channel_prices SET model_id=3014 WHERE id=15031 AND model_id=3192 RETURNING id`;
  invariant(updated.length === 1, 'Restore FK cardinality conflict');
  const removed = await tx`DELETE FROM public.model_slug_redirects WHERE old_slug=${alias.old_slug} AND model_id=${alias.model_id}
    AND reason=${alias.reason} AND created_at=${alias.created_at}::text::timestamptz RETURNING old_slug`;
  invariant(removed.length === 1, 'Restore alias ownership conflict');
  const restored = (await models(tx)).filter(m => m.id === '3014');
  invariant(restored.length === 1 && canonical(restored[0]) === canonical(row), 'Exact all-column source restoration invariant failed');
  await conservationAfter(tx, before, false);
}
/** Compatibility name now executes real methods; mutating modes REQUIRE approval and journal. */
export async function inspectO3Database(sql: Sql, mode: Mode, pair: unknown = PAIR, options?: { expectedDigest: string; journalDirectory: string }) {
  assertPair(pair); const adapter = new O3Executor(sql, options?.journalDirectory);
  if (mode === 'preview') return adapter.preview();
  invariant(options, 'Explicit expectedDigest and journalDirectory required');
  switch (mode) {
    case 'freeze': return adapter.freeze(options.expectedDigest);
    case 'rehearse': return adapter.rehearse(options.expectedDigest);
    case 'apply': return adapter.apply(options.expectedDigest);
    case 'repeat0': return adapter.repeat0(options.expectedDigest);
    case 'restore-rehearse': return adapter.restoreRehearse(options.expectedDigest);
    case 'restore': return adapter.restore(options.expectedDigest);
  }
}
