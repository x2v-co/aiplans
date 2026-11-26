/** Normal-Shell coordinator only; actual PG17/psql, fresh synthetic database only. */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { requireO3TestUrl } from './guard';
import { canonical } from './exact';
import { O3Executor, bootstrapO3 } from './adapter';
import { testSnapshot } from './test-snapshot';
import inventory from './safety-case-inventory.json';

const raw = process.env.O3_CLOSURE_TEST_DATABASE_URL;
assert.ok(raw, 'Explicit O3_CLOSURE_TEST_DATABASE_URL required; no fallback');
const url = requireO3TestUrl(raw);
const parsed = new URL(url);
assert.ok(/^\/dedupe54_test_o3_closure_[a-z0-9_]+$/.test(parsed.pathname), 'Fresh closure database required');
const mode = process.env.O3_CLOSURE_TEST_PSQL_MODE ?? 'local';
assert.ok(mode === 'local' || mode === 'docker-ci', 'Fixed psql mode required');
if (mode === 'local') {
  assert.ok(parsed.username === 'dedupe54', 'Dedicated local role required');
  assert.ok(parsed.password === '', 'Empty local synthetic password required');
} else {
  assert.ok(parsed.username === 'o3_native_ci', 'Exact synthetic CI role required');
  assert.ok(parsed.password === 'synthetic_ci_only', 'Exact synthetic CI password required');
  assert.ok(parsed.pathname === '/dedupe54_test_o3_closure_ci', 'Exact CI database required');
}
const sql = postgres(url, { host: '127.0.0.1', port: 55439, database: parsed.pathname.slice(1),
  username: parsed.username, password: parsed.password, ssl: false, max: 1, prepare: false,
  connect_timeout: 3, connection: { application_name: 'o3-closure-synthetic-validation',
    statement_timeout: 10000, lock_timeout: 1000, idle_in_transaction_session_timeout: 15000 },
  onnotice: () => {} });
const scripts = {
  fresh: readFileSync(new URL('./sre-readonly-check.sql', import.meta.url), 'utf8'),
  legacy: readFileSync(new URL('./sre-readonly-closure.sql', import.meta.url), 'utf8'),
};
type Script = keyof typeof scripts;
const phases = {
  fresh: ['environment', 'structure', 'pair', 'quota_rows', 'mixes', 'identity', 'urls', 'metadata_domains'],
  legacy: ['environment', 'structure', 'pair', 'quota_rows', 'mixes', 'metadata'],
};
const terminal = 'READY_FOR_HOST_LOCAL_PUBLIC_METADATA_REVIEW_NOT_APPLY';
const legacyTerminal = 'proposal_checks_match_pending_parent_SRE_freeze';
const desc = 'DESCRIPTION_RAW_SENTINEL_FRESH_PUBLIC_CATALOG';
const urlSentinel = 'URL_RAW_SENTINEL';
const opaque = 'OPAQUE_NOTES_RAW_SENTINEL';
const canary = 'O3_TEST_ONLY_FOLLOW_ON_QUERY_EXECUTED';
const normalOptions = '-c statement_timeout=15000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=60000';
let activeCase = 'initial-guard';
let psqlCases = 0;
const coverage: Record<string, unknown>[] = [];
const runtimeRoot = mkdtempSync(join(tmpdir(), 'o3-runtime-parity-'));
let runtimeCase = 0;
const runtimeStatements: string[] = [];
const runtime = postgres(url, { max: 1, prepare: false, connect_timeout: 3, onnotice() {},
  debug: (_id, query) => { runtimeStatements.push(query); } });
async function approved() {
  const directory = join(runtimeRoot, String(++runtimeCase));
  const adapter = new O3Executor(runtime, directory);
  const plan = await adapter.preview(); await adapter.freeze(plan.planDigest);
  return { adapter, directory, digest: plan.planDigest };
}
async function runtimeReject(label: string, valid: Awaited<ReturnType<typeof approved>>, replica = false) {
  const client = replica ? postgres(url, { max: 1, prepare: false, connect_timeout: 3, onnotice() {},
    connection: { session_replication_role: 'replica' }, debug: (_id, query) => { runtimeStatements.push(query); } }) : undefined;
  const adapter = client ? new O3Executor(client, valid.directory) : valid.adapter;
  try {
    for (const mode of ['preview','freeze','apply','rehearse'] as const) {
      activeCase = 'runtime-' + label + '-' + mode;
      const before = await testSnapshot(sql);
      const files = readdirSync(valid.directory).sort();
      runtimeStatements.length = 0;
      // No raw diagnostics/assertion diffs leave this synthetic harness.
      await assert.rejects(mode === 'preview' ? adapter.preview() : adapter[mode](valid.digest));
      assert.ok(!runtimeStatements.some(q => /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.|o3_executor\.)/i.test(q)),
        'Invalid fixture reached public/marker DML');
      assert.equal(await testSnapshot(sql), before, 'Runtime refusal changed public rows/schema/marker');
      assert.deepEqual(readdirSync(valid.directory).sort(), files, 'Invalid freeze published a journal');
      const receipt = { suite: 'runtime-parity', case: label, mode, status: 'REJECT_UNCHANGED_NO_PUBLICATION' };
      coverage.push(receipt); console.log(JSON.stringify(receipt));
    }
  } finally { if (client) await client.end({ timeout: 3 }); }
}
async function runtimePositive(label: string) {
  const valid = await approved();
  const before = await testSnapshot(sql);
  assert.equal((await valid.adapter.rehearse(valid.digest)).status, 'REHEARSED_ROLLBACK');
  assert.equal(await testSnapshot(sql), before);
  for (const mode of ['preview','freeze','rehearse'] as const) {
    const receipt = { suite: 'runtime-parity', case: label, mode, status: 'VALID_REVIEW_DIGEST_ROLLBACK' };
    coverage.push(receipt); console.log(JSON.stringify(receipt));
  }
}
async function snapshot() {
  // Synthetic rows only, in memory; no hashes or raw values emitted.
  const rows = await sql.unsafe(`
SELECT 'api_channel_price_variants' AS table_name,to_jsonb(t)::text AS row FROM public."api_channel_price_variants" t
UNION ALL
SELECT 'api_channel_prices' AS table_name,to_jsonb(t)::text AS row FROM public."api_channel_prices" t
UNION ALL
SELECT 'audit_alert_state' AS table_name,to_jsonb(t)::text AS row FROM public."audit_alert_state" t
UNION ALL
SELECT 'benchmark_metrics' AS table_name,to_jsonb(t)::text AS row FROM public."benchmark_metrics" t
UNION ALL
SELECT 'benchmark_tasks' AS table_name,to_jsonb(t)::text AS row FROM public."benchmark_tasks" t
UNION ALL
SELECT 'benchmark_versions' AS table_name,to_jsonb(t)::text AS row FROM public."benchmark_versions" t
UNION ALL
SELECT 'benchmarks' AS table_name,to_jsonb(t)::text AS row FROM public."benchmarks" t
UNION ALL
SELECT 'clicks' AS table_name,to_jsonb(t)::text AS row FROM public."clicks" t
UNION ALL
SELECT 'coding_agent_scores' AS table_name,to_jsonb(t)::text AS row FROM public."coding_agent_scores" t
UNION ALL
SELECT 'coupons' AS table_name,to_jsonb(t)::text AS row FROM public."coupons" t
UNION ALL
SELECT 'data_fix_275_audit' AS table_name,to_jsonb(t)::text AS row FROM public."data_fix_275_audit" t
UNION ALL
SELECT 'evaluation_run' AS table_name,to_jsonb(t)::text AS row FROM public."evaluation_run" t
UNION ALL
SELECT 'exchange_rates' AS table_name,to_jsonb(t)::text AS row FROM public."exchange_rates" t
UNION ALL
SELECT 'external_price_references' AS table_name,to_jsonb(t)::text AS row FROM public."external_price_references" t
UNION ALL
SELECT 'model_benchmark_scores' AS table_name,to_jsonb(t)::text AS row FROM public."model_benchmark_scores" t
UNION ALL
SELECT 'model_merge_backup_20261015' AS table_name,to_jsonb(t)::text AS row FROM public."model_merge_backup_20261015" t
UNION ALL
SELECT 'model_merge_backup_20261022' AS table_name,to_jsonb(t)::text AS row FROM public."model_merge_backup_20261022" t
UNION ALL
SELECT 'model_offical' AS table_name,to_jsonb(t)::text AS row FROM public."model_offical" t
UNION ALL
SELECT 'model_plan_mapping' AS table_name,to_jsonb(t)::text AS row FROM public."model_plan_mapping" t
UNION ALL
SELECT 'model_slug_redirects' AS table_name,to_jsonb(t)::text AS row FROM public."model_slug_redirects" t
UNION ALL
SELECT 'models' AS table_name,to_jsonb(t)::text AS row FROM public."models" t
UNION ALL
SELECT 'models_slug_backup_20261012' AS table_name,to_jsonb(t)::text AS row FROM public."models_slug_backup_20261012" t
UNION ALL
SELECT 'plans' AS table_name,to_jsonb(t)::text AS row FROM public."plans" t
UNION ALL
SELECT 'price_history' AS table_name,to_jsonb(t)::text AS row FROM public."price_history" t
UNION ALL
SELECT 'price_history_backup_20261012' AS table_name,to_jsonb(t)::text AS row FROM public."price_history_backup_20261012" t
UNION ALL
SELECT 'providers' AS table_name,to_jsonb(t)::text AS row FROM public."providers" t
UNION ALL
SELECT 'quota_estimates' AS table_name,to_jsonb(t)::text AS row FROM public."quota_estimates" t
UNION ALL
SELECT 'quota_evidence' AS table_name,to_jsonb(t)::text AS row FROM public."quota_evidence" t
UNION ALL
SELECT 'quota_text_snapshots' AS table_name,to_jsonb(t)::text AS row FROM public."quota_text_snapshots" t
UNION ALL
SELECT 'quota_usage_samples' AS table_name,to_jsonb(t)::text AS row FROM public."quota_usage_samples" t
UNION ALL
SELECT 'scrape_logs' AS table_name,to_jsonb(t)::text AS row FROM public."scrape_logs" t
UNION ALL
SELECT 'usage_mixes' AS table_name,to_jsonb(t)::text AS row FROM public."usage_mixes" t
UNION ALL
SELECT 'usage_prices' AS table_name,to_jsonb(t)::text AS row FROM public."usage_prices" t
ORDER BY table_name,row`);
  // Only engine maintenance stats are excluded; all structural fields remain exact.
  const catalog = await sql`SELECT 'class' AS kind,(to_jsonb(c) - ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[])::text AS value FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'attribute',to_jsonb(a)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'constraint',to_jsonb(k)::text FROM pg_constraint k WHERE k.connamespace='public'::regnamespace
    UNION ALL SELECT 'index',to_jsonb(i)::text FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'default',to_jsonb(d)::text FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='public'::regnamespace
    ORDER BY kind,value`;
  return canonical({ rows, catalog });
}
async function check(label: string, kind: Script, gate?: string, replica = false, expected?: RegExp) {
  activeCase = kind + '-' + label;
  const before = await snapshot();
  const completeBefore = await testSnapshot(sql);
  const options = normalOptions + (replica ? ' -c session_replication_role=replica' : '');
  const args = ['-X', '--no-password', '--dbname', url, '--set', 'ON_ERROR_STOP=on', '--file', '-'];
  const childEnv = { PATH: '/usr/bin:/bin', LC_ALL: 'C', PGPASSFILE: '/nonexistent/o3-closure-no-password',
    PGSERVICEFILE: '/dev/null', PGSYSCONFDIR: '/nonexistent', PGCONNECT_TIMEOUT: '3', PGSSLMODE: 'disable', PGGSSENCMODE: 'disable', PGOPTIONS: options };
  // CI uses only the fixed ephemeral container and its PG17 psql, never a host client.
  const result = spawnSync(mode === 'docker-ci' ? 'docker' : 'psql', mode === 'docker-ci'
    ? ['exec', '-i', '--env', 'PGOPTIONS=' + options, '--env', 'PGPASSFILE=/nonexistent/o3-closure-no-password',
      '--env', 'PGSERVICEFILE=/dev/null', '--env', 'PGSYSCONFDIR=/nonexistent',
      '--env', 'PGCONNECT_TIMEOUT=3', '--env', 'PGSSLMODE=disable', '--env', 'PGGSSENCMODE=disable', '--env', 'LC_ALL=C', 'o3-native-pg', 'psql', ...args]
    : args, { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024, env: childEnv,
      input: scripts[kind] + "\nSELECT 'O3_TEST_ONLY_FOLLOW_ON_QUERY_EXECUTED' AS test_canary;\n" });
  const output = (result.stdout || '') + (result.stderr || '');
  assert.equal(await snapshot(), before, 'readonly row/schema snapshot');
  assert.equal(await testSnapshot(sql), completeBefore, 'readonly full rows/versions/schema/marker snapshot');
  assert.ok(!result.error && result.signal === null, 'psql deadline/completion');
  for (const sentinel of [desc, urlSentinel, opaque]) assert.ok(!output.includes(sentinel), 'raw sentinel leak');
  assert.equal(result.status, gate ? 3 : 0, 'psql exit status');
  const rollback = [...output.matchAll(/^ROLLBACK\r?$/gm)];
  assert.equal(rollback.length, 1, 'explicit rollback command completion');
  if (gate) {
    const marker = 'O3_REJECT_' + gate + '_ROLLED_BACK';
    assert.equal(output.split(marker).length - 1, 1, 'one fixed rejection receipt');
    assert.ok(output.indexOf(marker) > rollback[0].index!, 'rollback precedes marker');
    assert.equal(output.match(/O3_REJECT_[a-z_]+_ROLLED_BACK/g)?.length, 1);
    assert.match(result.stderr, /(?:^|\s)22012(?:\s|$)/, 'code-only deliberate error');
    const index = phases[kind].indexOf(gate);
    assert.ok(index >= 0);
    for (const later of phases[kind].slice(index + 1)) assert.doesNotMatch(output, new RegExp('^' + later + ' ', 'm'));
    if (gate === 'environment') assert.doesNotMatch(output, /^(columns|constraints|indexes|incoming|relations|effects) /m);
    if (index <= phases[kind].indexOf('structure')) assert.ok(!output.includes('source_reference.'));
    if (kind === 'fresh' || gate !== 'metadata') assert.ok(!output.includes('model3014.') && !output.includes('model3192.'));
    assert.ok(!output.includes(terminal) && !output.includes(legacyTerminal) && !output.includes(canary));
  } else {
    assert.equal(kind, 'fresh', 'legacy cannot approve metadata');
    assert.ok(!output.includes('O3_REJECT_') && !result.stderr.trim());
    assert.ok(output.indexOf(terminal) > rollback[0].index!);
    assert.ok(output.indexOf(canary) > output.indexOf(terminal));
    assert.equal((output.match(/model(?:3014|3192)\.[^|\n]+\|/g) ?? []).length, 58);
  }
  if (expected) assert.match(output, expected);
  ++psqlCases;
  coverage.push({ suite: 'psql', case: label, kind, gate: gate ?? null, exit: result.status,
    sqlstate: gate ? '22012' : null, status: 'PASS' });
  console.log('PASS ' + activeCase + (gate ? ' REJECT_' + gate + '_ROLLED_BACK_22012' : ' ROLLED_BACK_READY'));
}
async function reject(label: string, gate: string, change: () => Promise<unknown>, undo: () => Promise<unknown>, legacyGate = gate, restoredCatalog = true) {
  activeCase = 'fixture-' + label;
  const original = await snapshot();
  // Freeze a VALID state first. Apply then sees the controlled invalid mutation;
  // it must not accept a digest produced from invalid data.
  const valid = await approved();
  await change();
  try {
    await check(label, 'fresh', gate);
    await check(label, 'legacy', legacyGate);
    await runtimeReject(label, valid);
  } finally { await undo(); }
  const restored = await snapshot();
  if (restoredCatalog) assert.equal(restored, original, 'fixture restored');
  else assert.equal(canonical(JSON.parse(restored).rows), canonical(JSON.parse(original).rows), 'fixture rows restored');
}
async function run() {
  const client = spawnSync(mode === 'docker-ci' ? 'docker' : 'psql', mode === 'docker-ci'
    ? ['exec', '--env', 'LC_ALL=C', 'o3-native-pg', 'psql', '-X', '--version']
    : ['-X', '--version'], { encoding: 'utf8', timeout: 5000, maxBuffer: 4096,
      env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', PGPASSFILE: '/nonexistent/o3-closure-no-password',
        PGSERVICEFILE: '/dev/null', PGSYSCONFDIR: '/nonexistent' } });
  assert.ok(!client.error && client.status === 0 && /^psql \(PostgreSQL\) 17\./.test(client.stdout), 'Actual PG17 psql required');
  const [server] = await sql`SELECT HOST(inet_server_addr()) AS host,inet_server_port() AS port,
    current_database() AS db,current_user AS role,current_setting('server_version_num')::int AS version`;
  assert.equal(server.host, '127.0.0.1'); assert.equal(server.port, 55439);
  assert.equal(server.db, parsed.pathname.slice(1)); assert.equal(server.role, parsed.username);
  assert.ok(server.version >= 170000 && server.version < 180000, 'Actual PG17 required');
  const [empty] = await sql`SELECT
    NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema'))
    AND NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace) AS ok`;
  assert.ok(empty.ok, 'Empty dedicated DB required; refusing reuse');
  await sql.unsafe(readFileSync(new URL('./fixtures/supported-public-schema.sql', import.meta.url), 'utf8'));
  for (const row of JSON.parse(readFileSync(new URL('./fixtures/public-models.json', import.meta.url), 'utf8'))) {
    await sql`INSERT INTO public.models ${sql(row)}`;
  }
  await sql`INSERT INTO public.providers(id,name,slug,type) VALUES (59,'OpenRouter','openrouter','aggregator')`;
  await sql`INSERT INTO public.api_channel_prices(id,model_id,provider_id,is_available,availability_locked,notes,data_for_discount_note,
    last_verified,created_at,updated_at) VALUES
    (15031,3014,59,false,false,${opaque},${opaque},'2026-09-10 19:24:35.925450+00','2026-09-01 00:00:00.123456+00','2026-09-02 00:00:00.000007+00'),
    (15334,3192,59,true,false,${opaque},NULL,'2026-11-16 19:17:08.946456+00','2026-09-01 00:00:00.123450+00','2026-09-02 00:00:00.123456+00')`;
  await sql`INSERT INTO public.price_history(id,channel_price_id,recorded_at,currency,source)
    SELECT n,15334,'2026-11-01 00:00:00+00'::timestamptz+n*interval '1 second'
    +CASE WHEN n%2=0 THEN interval '0.123450 second' ELSE interval '0.123456 second' END,'USD','synthetic fixture'
    FROM generate_series(1,71) n`;
  await sql`INSERT INTO public.usage_mixes(id,name,cache_read_pct,input_pct,output_pct,created_at)
    VALUES ('coding-high-cache','coding',97,2.5,0.5,'2026-11-17'),('chat','chat',0,75,25,'2026-11-17')`;
  const knownNote = '{"kind":"payg-list-price","version":1,"source":{"api_channel_price_id":15334}}';
  for (const [index,mix] of ['coding-high-cache','chat'].entries()) {
    await sql`INSERT INTO public.quota_estimates(id,plan_id,plan_slug,served_model,"window",usage_mix_id,
      est_tokens_low,est_tokens_high,confidence,notes,is_current,created_at)
      VALUES (${index+1},NULL,'payg:openrouter','openai-o3-batch','monthly',${mix},0,1,'high',${knownNote},true,'2026-11-17')`;
  }
  await sql`UPDATE public.models SET description=${desc},
    created_at=CASE id WHEN 3014 THEN '2026-11-17 01:02:03.123456+00'::timestamptz ELSE '2026-11-16 09:08:07.654321+00'::timestamptz END,
    updated_at='2026-11-17 05:04:03.000007+00',released_at='2025-05-01 00:00:00.987654+00',
    offical_link=CASE id WHEN 3014 THEN 'https://platform.openai.com/docs/models/o3' ELSE 'https://openrouter.ai/openai/o3:batch' END`;
  await bootstrapO3(runtime);
  const baseline = await snapshot();
  await check('fresh-public-review-not-apply', 'fresh');
  await runtimePositive('fresh-public-review-not-apply');
  await check('historical-metadata-blocked', 'legacy', 'metadata');
  coverage.push({ suite: 'runtime-parity', case: 'historical-metadata-blocked',
    status: 'LEGACY_ONLY_HISTORICAL_BASELINE_NOT_A_RUNTIME_RESTRICTION',
    corresponding: 'fresh-public-review-not-apply' });
  // Replica is scoped ONLY to readonly psql children, never the fixture writer.
  await check('replica-environment', 'fresh', 'environment', true);
  await check('replica-environment', 'legacy', 'environment', true);
  await runtimeReject('replica-environment', await approved(), true);
  await sql`UPDATE public.models SET description=NULL,created_at=NULL,offical_link=NULL WHERE id=3014`;
  await check('actual-null', 'fresh', undefined, false, /model3014\.created_at[^\n]*actual_null/);
  await runtimePositive('actual-null');
  await sql`UPDATE public.models SET description='NULL' WHERE id=3014`;
  await check('literal-text-null', 'fresh', undefined, false, /model3014\.description[^\n]*present/);
  await runtimePositive('literal-text-null');
  await sql`UPDATE public.models SET description=${desc + '\n' + 'public catalog description\n'.repeat(2000)} WHERE id=3014`;
  await check('long-multiline-description', 'fresh');
  await runtimePositive('long-multiline-description');
  await sql`UPDATE public.models SET description=${desc},created_at='2026-11-17 01:02:03.123456+00',
    offical_link='https://platform.openai.com/docs/models/o3' WHERE id=3014`;
  assert.equal(await snapshot(), baseline);
  const attacks = ['https://openai.com.evil.test/'+urlSentinel,'https://openaі.com/'+urlSentinel,
    'https://user:password@openai.com/'+urlSentinel,'https://openai.com:443/'+urlSentinel,
    'https://platform.openai.com/docs/models/o3?token='+urlSentinel,'https://openai.com/#'+urlSentinel,
    'http://127.0.0.1/'+urlSentinel,'https://internal.local/'+urlSentinel,
    'https://openai.com/%2f'+urlSentinel,'https://openai.com/\n'+urlSentinel,
    'https://example.com/'+urlSentinel,'https://openai.com/unknown/'+urlSentinel,
    'https://openai.com/\r'+urlSentinel,'https://openai.com/\t'+urlSentinel];
  for (const [i,value] of attacks.entries()) {
    await reject('url-'+i, 'urls', () => sql`UPDATE public.models SET offical_link=${value} WHERE id=3014`,
      () => sql`UPDATE public.models SET offical_link='https://platform.openai.com/docs/models/o3' WHERE id=3014`, 'metadata');
  }
  await reject('license-url', 'urls', () => sql`UPDATE public.models SET license_url=${attacks[0]} WHERE id=3192`,
    () => sql`UPDATE public.models SET license_url=NULL WHERE id=3192`, 'metadata');
  await reject('deprecation-url', 'urls', () => sql`UPDATE public.models SET deprecation_source_url=${attacks[0]} WHERE id=3014`,
    () => sql`UPDATE public.models SET deprecation_source_url=NULL WHERE id=3014`, 'metadata');
  for (const [i,value] of ['infinity','-infinity','0001-01-01 00:00:00 BC','10000-01-01 00:00:00+00'].entries()) {
    await reject('timestamp-'+i, 'metadata_domains', () => sql`UPDATE public.models SET created_at=${value}::text::timestamptz WHERE id=3014`,
      () => sql`UPDATE public.models SET created_at='2026-11-17 01:02:03.123456+00' WHERE id=3014`, 'metadata');
  }
  for (const [i,value] of ['infinity','-infinity','0001-01-01 BC','10000-01-01'].entries()) {
    await reject('date-'+i, 'metadata_domains', () => sql`UPDATE public.models SET shutdown_date=${value}::text::date WHERE id=3192`,
      () => sql`UPDATE public.models SET shutdown_date=NULL WHERE id=3192`, 'metadata');
  }
  for (const [i,value] of ['malformed '+opaque,'[]',
    '{"kind":"unknown","version":1,"source":{"api_channel_price_id":15334}}',
    '{"kind":"payg-list-price","version":2,"source":{"api_channel_price_id":15334}}',
    '{"kind":"payg-list-price","version":"1","source":{"api_channel_price_id":15334}}',
    '{"kind":"payg-list-price","version":1,"source":{"api_channel_price_id":15031}}',
    '{"kind":"payg-list-price","version":1,"source":{"api_channel_price_id":"15334"}}',
    '{"kind":"payg-list-price","version":1,"source":{}}'].entries()) {
    await reject('quota-notes-'+i, 'quota_rows', () => sql`UPDATE public.quota_estimates SET notes=${value} WHERE id=1`,
      () => sql`UPDATE public.quota_estimates SET notes=${knownNote} WHERE id=1`);
  }
  await reject('source-fk', 'pair', () => sql`INSERT INTO public.model_plan_mapping(id,model_id,source) VALUES (1,3014,'manual')`,
    () => sql`DELETE FROM public.model_plan_mapping WHERE id=1`);
  await reject('moved-channel', 'pair', () => sql`UPDATE public.api_channel_prices SET model_id=3192 WHERE id=15031`,
    () => sql`UPDATE public.api_channel_prices SET model_id=3014 WHERE id=15031`);
  await reject('third-offer', 'pair', () => sql`INSERT INTO public.api_channel_prices(id,model_id,provider_id,is_available,availability_locked)
    VALUES (15999,3192,59,false,false)`, () => sql`DELETE FROM public.api_channel_prices WHERE id=15999`);
  await reject('alias', 'pair', () => sql`INSERT INTO public.model_slug_redirects(old_slug,model_id) VALUES ('synthetic-alias',3192)`,
    () => sql`DELETE FROM public.model_slug_redirects WHERE old_slug='synthetic-alias'`);
  await reject('sku-name', 'identity', () => sql`UPDATE public.models SET name='synthetic-wrong-sku' WHERE id=3014`,
    () => sql`UPDATE public.models SET name='o3-(batch)' WHERE id=3014`, 'metadata');
  await reject('context', 'identity', () => sql`UPDATE public.models SET context_window=200001 WHERE id=3192`,
    () => sql`UPDATE public.models SET context_window=200000 WHERE id=3192`, 'metadata');
  await reject('usage-mix', 'mixes', () => sql`UPDATE public.usage_mixes SET input_pct=74,output_pct=26 WHERE id='chat'`,
    () => sql`UPDATE public.usage_mixes SET input_pct=75,output_pct=25 WHERE id='chat'`);
  await reject('unknown-index', 'structure', () => sql`CREATE INDEX o3_synthetic_unknown_idx ON public.models(name)`,
    () => sql`DROP INDEX public.o3_synthetic_unknown_idx`);
  // Preserve engine constraints. These schema probes add/remove test-only objects.
  await reject('unknown-column-type', 'structure', async () => {
    await sql`CREATE DOMAIN public.o3_synthetic_text AS text`;
    await sql`ALTER TABLE public.models ALTER COLUMN description TYPE public.o3_synthetic_text`;
  }, async () => {
    await sql`ALTER TABLE public.models ALTER COLUMN description TYPE text`;
    await sql`DROP DOMAIN public.o3_synthetic_text`;
  }, 'structure', false);
  assert.equal(psqlCases, 89, 'Preserve all original 89 psql invocations (4 positives, 85 refusals)');
  assert.deepEqual(coverage.filter(r => r.suite === 'psql').map(r => [r.case,r.kind,r.gate,r.exit,r.sqlstate]),
    inventory.originalPsqlInvocations.map(r => [r.case,r.script,r.gate,r.exit,r.sqlstate]), 'Original per-case SQL inventory');
  // Additional wrong JSON types across object/kind/version/source/channel fields.
  // These supplement, rather than replace, the original 89 psql invocations.
  const wrongTypes = [null, true, false, [], {}, '15334'];
  for (const key of ['kind','version','source','channel'] as const) {
    for (const [index, value] of wrongTypes.entries()) {
      const note: Record<string, unknown> = { kind: 'payg-list-price', version: 1, source: { api_channel_price_id: 15334 } };
      if (key === 'channel') note.source = { api_channel_price_id: value };
      else note[key] = value;
      await reject('wrongtype-' + key + '-' + index, 'quota_rows',
        () => sql`UPDATE public.quota_estimates SET notes=${JSON.stringify(note)} WHERE id=1`,
        () => sql`UPDATE public.quota_estimates SET notes=${knownNote} WHERE id=1`);
    }
  }
  for (const [index, value] of wrongTypes.entries()) {
    await reject('wrongtype-root-' + index, 'quota_rows',
      () => sql`UPDATE public.quota_estimates SET notes=${JSON.stringify(value)} WHERE id=1`,
      () => sql`UPDATE public.quota_estimates SET notes=${knownNote} WHERE id=1`);
  }
  // Cover all six model URL fields and all five model temporal fields, beyond
  // the original SQL cases. Fixed identifiers only; never input-derived names.
  for (const id of [3014,3192]) for (const field of ['license_url','offical_link','deprecation_source_url']) {
    const saved = await sql.unsafe('SELECT "' + field + '" AS value FROM public.models WHERE id=$1', [id]);
    await reject('url-field-' + id + '-' + field, 'urls',
      () => sql.unsafe('UPDATE public.models SET "' + field + '"=$1 WHERE id=$2', [attacks[0],id]),
      () => sql.unsafe('UPDATE public.models SET "' + field + '"=$1 WHERE id=$2', [saved[0].value,id]), 'metadata');
  }
  for (const field of ['released_at','created_at','updated_at','shutdown_date','deprecated_at']) {
    const type = field.endsWith('date') || field === 'deprecated_at' ? 'date' : 'timestamptz';
    const saved = await sql.unsafe('SELECT "' + field + '"::text AS value FROM public.models WHERE id=3192');
    await reject('temporal-field-' + field, 'metadata_domains',
      () => sql.unsafe('UPDATE public.models SET "' + field + '"=$1::text::' + type + ' WHERE id=3192', ['infinity']),
      () => sql.unsafe('UPDATE public.models SET "' + field + '"=$1::text::' + type + ' WHERE id=3192', [saved[0].value]), 'metadata');
  }
  for (const c of inventory.originalPsqlInvocations) for (const mode of c.runtimeModes) {
    assert.ok(coverage.some(r => r.suite === 'runtime-parity' && r.case === c.runtimeCase && r.mode === mode), 'Missing original case/mode runtime coverage');
  }
  for (const c of inventory.additionalSafetyCases) for (const mode of ['preview','freeze','apply','rehearse']) {
    assert.ok(coverage.some(r => r.suite === 'runtime-parity' && r.case === c.case && r.mode === mode), 'Missing additional case/mode runtime coverage');
  }
  console.log(JSON.stringify({ suite: 'parity-coverage', inventory: inventory.version, originalPsqlCases: 89, totalPsqlCases: psqlCases, cases: coverage }));
  console.log('PASS all-fixed-cases synthetic closure and runtime parity only; no production claim');
}
run().catch(() => { console.error('FAIL ' + activeCase + '; raw diagnostics suppressed'); process.exitCode = 1; })
  .finally(async () => { await Promise.all([sql.end({ timeout: 3 }), runtime.end({ timeout: 3 })]); });
