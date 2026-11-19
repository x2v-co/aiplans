/** Real exported executor + SQL writers. No invariant/result patching or sleep ordering. */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres, { type Sql } from 'postgres';
import { O3Executor, bootstrapO3 } from './adapter';
import { requireO3TestUrl } from './guard';
import { fixture } from './postgres.integration';
import { testSnapshot } from './test-snapshot';

const url = requireO3TestUrl(process.env.O3_RACE_TEST_DATABASE_URL);
assert.match(new URL(url).pathname, /^\/dedupe54_test_o3_race_[a-z0-9_]+$/);
const connect = () => postgres(url, { max: 1, prepare: false, connect_timeout: 3, onnotice() {},
  connection: { application_name: 'o3-synthetic-race', statement_timeout: 15000, lock_timeout: 1000 } });
const observer = connect();
// Fixed test context only. Never emit PostgreSQL messages/queries/parameters.
let phase = 'environment', currentAction = 'none', currentAttack = 'none';
function sqlstate(error: unknown): string | undefined {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  return error instanceof Error ? /^PostgreSQL operation refused; SQLSTATE ([0-9A-Z]{5})$/.exec(error.message)?.[1] : undefined;
}
function diagnostic(error: unknown, failedPhase = phase) {
  const frame = error instanceof Error ? error.stack?.split('\n').find(line =>
    /^\s+at .*\/scripts\/o3-model-only\/concurrency\.postgres\.integration\.ts:\d+:\d+\)?$/.test(line)) : undefined;
  console.error(JSON.stringify({ suite: 'concurrency', status: 'FAIL', phase: failedPhase,
    action: currentAction, attack: currentAttack, code: sqlstate(error) ?? 'NO_SQLSTATE',
    errorClass: error instanceof assert.AssertionError ? 'ASSERTION' : error instanceof Error ? 'ERROR' : 'NON_ERROR',
    sourceLine: frame ? Number(/:(\d+):\d+\)?$/.exec(frame)![1]) : null }));
}
function barrier() { let release!: () => void; const ready = new Promise<void>(resolve => { release = resolve; }); return { ready, release }; }
/** pg_blocking_pids and the ungranted relation lock prove actual overlap. No sleep
 * counts as evidence. Fail within the unchanged production 1s lock timeout. */
async function waiting(pid: number, blocker: number) {
  const deadline = Date.now() + 900;
  do {
    const [r] = await observer`SELECT l.pid,l.relation::text AS relation,l.mode,a.wait_event AS event,
      a.backend_xmin::text AS snapshot_xmin,${blocker}::int AS blocker FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
      WHERE l.pid=${pid} AND NOT l.granted AND l.locktype='relation' AND a.wait_event_type='Lock'
      AND ${blocker}=ANY(pg_blocking_pids(l.pid))`;
    if (r) return { pid: r.pid, relation: r.relation, mode: r.mode, event: r.event, snapshotXmin: r.snapshot_xmin, blocker: r.blocker };
  } while (Date.now() < deadline);
  assert.fail('Required backend lock-wait witness missing');
}
type Action = 'apply' | 'rehearse' | 'restore' | 'restoreRehearse' | 'repeat0';
async function executorRace(action: Action, attack: 'third-offer' | 'old-quota' | 'cascade-reference') {
  phase = 'fixture'; currentAction = action; currentAttack = attack;
  const execution = connect(), writer = connect(), seed = connect();
  try {
    await fixture(seed); await bootstrapO3(execution);
    const adapter = new O3Executor(execution, join(mkdtempSync(join(tmpdir(), 'o3-race-')), 'journal'));
    const plan = await adapter.preview(); await adapter.freeze(plan.planDigest);
    if (action === 'restore' || action === 'restoreRehearse' || action === 'repeat0') await adapter.apply(plan.planDigest);
    const [{ pid }] = await execution`SELECT pg_backend_pid() AS pid`;
    const [{ pid: writerPid }] = await writer`SELECT pg_backend_pid() AS pid`;
    const locked = barrier(), write = barrier();
    let before = '';
    const writing = writer.begin(async raw => {
      const tx = raw as unknown as Sql;
      // Take only the actual writer's relation lock first. Perform the DML
      // AFTER pg_blocking_pids proves the executor is waiting behind it.
      if (attack === 'third-offer') await tx`LOCK TABLE public.api_channel_prices IN ROW EXCLUSIVE MODE`;
      else if (attack === 'old-quota') await tx`LOCK TABLE public.quota_estimates IN ROW EXCLUSIVE MODE`;
      else await tx`LOCK TABLE public.model_plan_mapping IN ROW EXCLUSIVE MODE`;
      locked.release(); await write.ready;
      if (attack === 'third-offer') await tx`INSERT INTO public.api_channel_prices(id,model_id,provider_id,is_available,availability_locked)
        VALUES (15998,3192,59,false,false)`;
      else if (attack === 'old-quota') await tx`UPDATE public.quota_estimates SET served_model='o3-(batch)' WHERE id=1`;
      // Synthetic cascade witness: source is a constrained business enum.
      else await tx`INSERT INTO public.model_plan_mapping(id,model_id,source) VALUES (9876,3014,'manual')`;
      before = await testSnapshot(tx);
    });
    // Observe rejection as data so no promise rejection is left unhandled while
    // the independent writer is committing. Never alter the real SQL outcome.
    let outcome: Promise<{ ok: boolean; code?: string; refusal?: string }> | undefined;
    let witness: Awaited<ReturnType<typeof waiting>>;
    try {
      phase = 'writer-lock';
      await Promise.race([locked.ready, writing.then(() => { throw new Error('Writer finished before barrier'); })]);
      outcome = adapter[action](plan.planDigest).then(() => ({ ok: true }), error => {
        const message = error instanceof Error ? error.message : '';
        const refusal = /third row\/model\/channel drift/.test(message) ? 'PAIR_GATE'
          : /Quota precondition conflict/.test(message) ? 'QUOTA_GATE'
          : /Source reference conflict/.test(message) ? 'SOURCE_REFERENCE_GATE'
          : /Approval digest\/input\/public beforeimage drift/.test(message) ? 'APPROVED_DIGEST_DRIFT' : 'UNEXPECTED_REFUSAL';
        if (refusal === 'UNEXPECTED_REFUSAL') diagnostic(error, 'executor-result');
        return { ok: false, refusal, code: sqlstate(error) };
      });
      phase = 'backend-wait';
      witness = await waiting(pid, writerPid);
    } finally {
      write.release();
      const previousPhase = phase; phase = 'writer-commit';
      try { await writing; phase = previousPhase; }
      finally { if (outcome) await outcome; } // Observe the executor even if its writer fails.
    }
    phase = 'gate-conservation';
    const result = await outcome!;
    const conserved = await testSnapshot(observer) === before;
    const expectedGates = [attack === 'third-offer' ? 'PAIR_GATE' : attack === 'old-quota' ? 'QUOTA_GATE' : 'SOURCE_REFERENCE_GATE',
      'APPROVED_DIGEST_DRIFT'];
    const provesGate = !result.code && expectedGates.includes(result.refusal!);
    console.log(JSON.stringify({ suite: 'executor-race', action, attack,
      status: result.ok ? 'UNSAFE_ACCEPTED' : !provesGate ? 'UNEXPECTED_REFUSAL' : conserved ? 'REFUSED_UNCHANGED' : 'REFUSAL_CHANGED_STATE',
      conserved, witness: witness!, code: result.code ?? (result.ok ? 'ACCEPTED' : result.refusal) }));
    assert.equal(result.ok, false, 'Executor accepted stale pre-lock fixture');
    assert.equal(result.code, undefined, 'Timeout/serialization failure does not prove fresh post-lock gates');
    assert.ok(provesGate, 'Unexpected refusal does not prove the required gate');
    assert.ok(conserved, 'Refusal changed public rows/schema/marker');
  } finally {
    const closed = await Promise.allSettled([execution.end({ timeout: 3 }), writer.end({ timeout: 3 }), seed.end({ timeout: 3 })]);
    for (const result of closed) if (result.status === 'rejected') { phase = 'executor-cleanup'; throw result.reason; }
  }
}
async function reset() {
  // Only the identity-checked synthetic DB; every caller has closed before reset.
  await observer`DROP SCHEMA IF EXISTS o3_executor CASCADE`;
  await observer`DROP SCHEMA public CASCADE`;
  await observer`CREATE SCHEMA public`;
}
/** Independent same-driver control: does LOCK itself freeze a SERIALIZABLE snapshot?
 * The first trial has no SELECT before LOCK; the second reproduces setup SELECT.
 * A third trial proves SERIALIZABLE's RI CASCADE crosscheck remains 40001. */
async function snapshotControl(priorSelect: boolean, cascade = false) {
  phase = 'snapshot-control'; currentAction = priorSelect ? 'select-first' : 'lock-first'; currentAttack = cascade ? 'cascade' : 'count';
  await observer`CREATE TABLE public.o3_parent(id integer PRIMARY KEY)`;
  await observer`CREATE TABLE public.o3_child(id integer PRIMARY KEY,parent_id integer REFERENCES public.o3_parent(id) ON DELETE CASCADE)`;
  await observer`INSERT INTO public.o3_parent VALUES (1)`;
  const reader = connect(), writer = connect();
  const locked = barrier(), release = barrier();
  let writing: Promise<unknown> | undefined;
  let reading: Promise<{ n: number; code: string }> | undefined;
  try {
    const [{ pid }] = await reader`SELECT pg_backend_pid() AS pid`;
    const [{ pid: writerPid }] = await writer`SELECT pg_backend_pid() AS pid`;
    writing = writer.begin(async raw => {
      const tx = raw as unknown as Sql;
      await tx`INSERT INTO public.o3_child VALUES (1,1)`; locked.release(); await release.ready;
    });
    await Promise.race([locked.ready, writing.then(() => { throw new Error('Writer finished before barrier'); })]);
    reading = reader.begin('isolation level serializable', async raw => {
      const tx = raw as unknown as Sql;
      await tx`SET LOCAL lock_timeout='1s'`; await tx`SET LOCAL statement_timeout='15s'`;
      if (priorSelect || cascade) await tx`SELECT current_setting('session_replication_role')`;
      await tx`LOCK TABLE public.o3_child,public.o3_parent IN SHARE ROW EXCLUSIVE MODE`;
      if (cascade) { await tx`DELETE FROM public.o3_parent WHERE id=1`; return -1; }
      const [r] = await tx`SELECT count(*)::int AS n FROM public.o3_child`; return r.n;
    }).then(n => ({ n, code: '' }), error => ({ n: -1, code: sqlstate(error) ?? 'UNEXPECTED_ERROR' }));
    let witness: Awaited<ReturnType<typeof waiting>>;
    try { witness = await waiting(pid, writerPid); } finally {
      release.release();
      const previousPhase = phase; phase = 'control-writer-commit';
      try { await writing; phase = previousPhase; } finally { await reading; }
    }
    const result = await reading;
    if (cascade) {
      assert.equal(result.code, '40001');
      assert.equal((await observer`SELECT count(*)::int AS n FROM public.o3_child`)[0].n, 1);
      assert.equal((await observer`SELECT count(*)::int AS n FROM public.o3_parent`)[0].n, 1);
    } else { assert.equal(result.code, ''); assert.equal(result.n, priorSelect ? 0 : 1); }
    console.log(JSON.stringify({ suite: 'snapshot-control', priorSelect, cascade, witness: witness!, ...result, status: 'PASS' }));
  } finally {
    release.release();
    try {
      // Both transactions are observed on every failure path, including a writer
      // rejection before the reader starts. Never count writer failure as PASS.
      try { await writing; } finally { if (reading) await reading; }
    } finally {
      const closed = await Promise.allSettled([reader.end({ timeout: 3 }), writer.end({ timeout: 3 })]);
      for (const result of closed) if (result.status === 'rejected') { phase = 'control-cleanup'; throw result.reason; }
    }
  }
}
async function movedGates() {
  phase = 'moved-fixture'; currentAction = 'prepare'; currentAttack = 'none';
  const execution = connect(), seed = connect();
  try {
    await fixture(seed); await bootstrapO3(execution);
    const adapter = new O3Executor(execution, join(mkdtempSync(join(tmpdir(), 'o3-moved-gates-')), 'journal'));
    const plan = await adapter.preview(); await adapter.freeze(plan.planDigest); await adapter.apply(plan.planDigest);
    // Each invalid update is undone AFTER all three actual moved-state
    // entrypoints refuse. The writer commits each attack first;
    // its undo restores values but conservative version drift remains acceptable.
    for (const [label, change, undo] of [
      ['url', () => seed`UPDATE public.models SET license_url='https://internal.invalid/opaque' WHERE id=3192`,
        () => seed`UPDATE public.models SET license_url=NULL WHERE id=3192`],
      ['date', () => seed`UPDATE public.models SET deprecated_at='infinity'::date WHERE id=3192`,
        () => seed`UPDATE public.models SET deprecated_at=NULL WHERE id=3192`],
      ['timestamp', () => seed`UPDATE public.models SET updated_at='infinity'::timestamptz WHERE id=3192`,
        () => seed`UPDATE public.models SET updated_at=NULL WHERE id=3192`],
      ['json-channel-string', () => seed`UPDATE public.quota_estimates SET notes='{"kind":"payg-list-price","version":1,"source":{"api_channel_price_id":"15334"}}' WHERE id=1`,
        () => seed`UPDATE public.quota_estimates SET notes='{"kind":"payg-list-price","version":1,"source":{"api_channel_price_id":15334}}' WHERE id=1`],
    ] as const) {
      phase = 'moved-change'; currentAttack = label;
      await change(); const before = await testSnapshot(seed);
      try {
        for (const action of ['restore','restoreRehearse','repeat0'] as const) {
          phase = 'moved-gate'; currentAction = action;
          await assert.rejects(adapter[action](plan.planDigest), error => error instanceof Error
            && /gate refused|finite AD|Quota precondition/.test(error.message));
          assert.equal(await testSnapshot(seed), before);
          console.log(JSON.stringify({ suite: 'moved-runtime-gates', label, action, status: 'HARD_GATE_UNCHANGED' }));
        }
      } finally { const previousPhase = phase; phase = 'moved-undo'; await undo(); phase = previousPhase; }
    }
  } finally {
    const closed = await Promise.allSettled([execution.end({ timeout: 3 }), seed.end({ timeout: 3 })]);
    for (const result of closed) if (result.status === 'rejected') { phase = 'moved-cleanup'; throw result.reason; }
  }
}
async function main() {
  const [r] = await observer`SELECT current_database() AS db,HOST(inet_server_addr()) AS host,inet_server_port() AS port,
    current_setting('server_version_num')::int AS version,
    NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema'))
    AND NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace) AS empty`;
  assert.equal(r.db, new URL(url).pathname.slice(1)); assert.equal(r.host, '127.0.0.1'); assert.equal(r.port, 55439);
  assert.ok(r.version >= 170000 && r.version < 180000 && r.empty);
  console.log(JSON.stringify({ suite: 'race-environment', db: r.db, version: r.version, status: 'PG17_LOOPBACK_EMPTY' }));
  await snapshotControl(false); await reset();
  await snapshotControl(true); await reset();
  await snapshotControl(true, true); await reset();
  const failures: string[] = [];
  for (const action of ['apply','rehearse','restore','restoreRehearse','repeat0'] as const) {
    for (const attack of ['third-offer','old-quota'] as const) {
      try { await executorRace(action, attack); }
      catch (error) { diagnostic(error); failures.push(action + '/' + attack); }
      phase = 'fixture-reset';
      await reset();
    }
  }
  await executorRace('apply', 'cascade-reference'); await reset();
  await movedGates(); await reset();
  assert.deepEqual(failures, [], 'Executor race regressions failed');
}
main().catch(error => { diagnostic(error); process.exitCode = 1; })
  .finally(async () => {
    try { await observer.end({ timeout: 3 }); }
    catch (error) { diagnostic(error, 'observer-cleanup'); process.exitCode = 1; }
  });
