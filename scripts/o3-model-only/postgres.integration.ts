/** Calls the same exported methods as the operator CLI. Strictly synthetic:
 * requires an explicit fresh dedicated empty loopback PG17 database. */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import type { Sql } from 'postgres';
import { requireO3TestUrl } from './guard';
import { O3Executor, bootstrapO3 } from './adapter';
import { canonical } from './exact';
import { actualQueryClient, applicationPaths } from './testing';
import { seedQuotaPayg } from '../seed-quota-payg';
import { payAsYouGoEstimate, PAYG_MIXES, type PaygChannelPrice } from '../../src/lib/quota/pay-as-you-go';
import { persistSamples, loadHistory } from '../quota-collect/store';
import { windowSummary } from '../quota-collect/summary';
import type { Sample } from '../quota-collect/types';
import { resolveSelector } from '../../src/lib/plan-selector';

const fixtureStatements: string[] = [];
const asOf = new Date('2026-11-17T00:00:00Z');
export async function fixture(sql: Sql) {
  await sql.unsafe(readFileSync(new URL('./fixtures/supported-public-schema.sql', import.meta.url), 'utf8'));
  // Explicit fixture-only defaults, not production metadata. No unknown function stub.
  await sql.unsafe(`CREATE SEQUENCE public.o3_fixture_history_id START 1000;
    ALTER TABLE public.price_history ALTER COLUMN id SET DEFAULT nextval('public.o3_fixture_history_id');
    ALTER TABLE public.price_history ALTER COLUMN recorded_at SET DEFAULT now();
    CREATE SEQUENCE public.o3_fixture_sample_id START 1000;
    ALTER TABLE public.quota_usage_samples ALTER COLUMN id SET DEFAULT nextval('public.o3_fixture_sample_id');
    ALTER TABLE public.quota_usage_samples ALTER COLUMN created_at SET DEFAULT now()`);
  const models = JSON.parse(readFileSync(new URL('./fixtures/public-models.json', import.meta.url), 'utf8'));
  for (const row of models) await sql`INSERT INTO public.models ${sql(row)}`;
  await sql`INSERT INTO public.providers(id,name,slug,pricing_url,type) VALUES
    (59,'OpenRouter','openrouter','https://example.test/prices','aggregator'),(60,'Unrelated','unrelated',NULL,'aggregator')`;
  await sql`INSERT INTO public.models(id,name,slug,type,model_category) VALUES (3999,'Unrelated','unrelated','llm','text')`;
  await sql`INSERT INTO public.api_channel_prices
    (id,model_id,provider_id,is_available,availability_locked,input_price_per_1m,output_price_per_1m,cached_input_price_per_1m,
     currency,price_unit,notes,data_for_discount_note,last_verified,created_at,updated_at)
    VALUES (15031,3014,59,false,false,1,4,0.25,'USD','per_1m_tokens','synthetic opaque source sentinel','synthetic discount sentinel',
      '2026-09-10 19:24:35.925450+00','2026-09-01 00:00:00.123456+00','2026-09-02 00:00:00.123450+00'),
    (15334,3192,59,true,false,1,4,0.25,'USD','per_1m_tokens','synthetic canonical sentinel',NULL,
      '2026-11-16 19:17:08.946456+00','2026-09-01 00:00:00.123450+00','2026-09-02 00:00:00.123456+00'),
    (15999,3999,60,false,true,9,30,NULL,'USD','per_1m_tokens','synthetic unrelated sentinel',NULL,NULL,NULL,NULL)`;
  await sql`INSERT INTO public.price_history(id,channel_price_id,old_input_price,new_input_price,old_output_price,new_output_price,recorded_at,currency,source)
    SELECT n,15334,1,1,4,4,'2026-11-01 00:00:00+00'::timestamptz+n*interval '1 second'
      +CASE WHEN n%2=0 THEN interval '0.123450 second' ELSE interval '0.123456 second' END,'USD','synthetic fixture'
    FROM generate_series(1,71) n`;
  // Target variant can exist; source variants remain zero. OFF source must not expose more variants.
  await sql`INSERT INTO public.api_channel_price_variants
    (id,model_id,provider_id,variant_key,variant_name,is_available,is_public,is_headline,input_price_per_1m,output_price_per_1m,availability_locked)
    VALUES (7001,3192,59,'synthetic-auto','Synthetic auto',true,true,true,1,4,false)`;
  for (const mix of PAYG_MIXES) {
    await sql`INSERT INTO public.usage_mixes(id,name,cache_read_pct,input_pct,output_pct,created_at)
      VALUES (${mix.id},${mix.id},${mix.cacheReadPct},${mix.inputPct},${mix.outputPct},${asOf.toISOString()})`;
  }
  const [channel] = await sql<PaygChannelPrice[]>`SELECT cp.*,p.slug AS provider_slug,m.slug AS model_slug,p.pricing_url
    FROM public.api_channel_prices cp JOIN public.providers p ON p.id=cp.provider_id JOIN public.models m ON m.id=cp.model_id WHERE cp.id=15334`;
  for (const [index, mix] of PAYG_MIXES.entries()) {
    const estimate = payAsYouGoEstimate(channel, mix, { asOf, usdPerCurrencyUnit: 1 });
    assert.equal(estimate.status, 'ready');
    if (estimate.status !== 'ready') throw new Error('Fixture quota estimate rejected');
    await sql`INSERT INTO public.quota_estimates ${sql({ ...estimate.record, id: index + 1, is_current: true, created_at: asOf.toISOString() })}`;
  }
  await sql`UPDATE public.models SET max_output_tokens=9223372036854775806,
    created_at='2026-09-01 08:00:00.123450+08',released_at='2025-04-16 12:10:57.123456-05',
    updated_at='9999-12-31 23:59:59.999999+00',shutdown_date='0001-01-01',deprecated_at='9999-12-31',
    description='synthetic exact restoration',license='synthetic license',open_source=false,
    features=ARRAY['comma,value','quote"value',E'back\\slash',NULL,'NULL',''],
    input_type=ARRAY[]::text[],output_type=NULL,provider_ids=ARRAY[-2147483648,2147483647,NULL],
    input_modalities=ARRAY['text',NULL],output_modalities=ARRAY['text'],capabilities=ARRAY['a,b'] WHERE id=3014`;
  await sql`UPDATE public.models SET released_at='0001-01-01 00:00:00.000001+00',
    created_at='2026-09-01 00:00:00.654321+00',updated_at=NULL WHERE id=3192`;
  await sql`UPDATE public.api_channel_prices SET last_verified='2026-09-10 21:24:35.925450+02',
    updated_at='2026-09-02 00:00:00.000007+00' WHERE id=15031`;
  await sql`UPDATE public.api_channel_prices SET regular_input_price_per_1m=3,regular_output_price_per_1m=9,regular_cached_input_price_per_1m=0.5,
    rate_limit=7,promo_ends_at='2026-12-31 00:00:00.123456+00',data_for_discount=false,quota_unit='tokens' WHERE id=15031`;
  await sql`CREATE TEMP TABLE o3_before_models AS SELECT * FROM public.models`;
  await sql`CREATE TEMP TABLE o3_before_channels AS SELECT * FROM public.api_channel_prices`;
  await sql`CREATE TEMP TABLE o3_before_history AS SELECT * FROM public.price_history`;
  await sql`CREATE TEMP TABLE o3_before_quota AS SELECT * FROM public.quota_estimates`;
}

async function unchanged(sql: Sql, moved: boolean) {
  const [checks] = await sql`SELECT
    NOT EXISTS(SELECT 1 FROM public.api_channel_prices cp FULL JOIN o3_before_channels b USING(id)
      WHERE cp.id IS NULL OR b.id IS NULL OR (to_jsonb(cp)-'model_id') IS DISTINCT FROM (to_jsonb(b)-'model_id')
      OR cp.model_id IS DISTINCT FROM CASE WHEN b.id=15031 AND ${moved} THEN 3192 ELSE b.model_id END) AS channels,
    NOT EXISTS((SELECT * FROM public.price_history EXCEPT ALL SELECT * FROM o3_before_history)
      UNION ALL (SELECT * FROM o3_before_history EXCEPT ALL SELECT * FROM public.price_history)) AS history,
    NOT EXISTS((SELECT * FROM public.quota_estimates EXCEPT ALL SELECT * FROM o3_before_quota)
      UNION ALL (SELECT * FROM o3_before_quota EXCEPT ALL SELECT * FROM public.quota_estimates)) AS quota,
    NOT EXISTS((SELECT * FROM public.models WHERE id<>3014 EXCEPT ALL SELECT * FROM o3_before_models WHERE id<>3014)
      UNION ALL(SELECT * FROM o3_before_models WHERE id<>3014 EXCEPT ALL SELECT * FROM public.models WHERE id<>3014)) AS target,
    (SELECT count(*)=71 AND count(*) FILTER (WHERE mod((extract(epoch FROM recorded_at)*1000000)::bigint,1000000)=123450)=35
      AND count(*) FILTER (WHERE mod((extract(epoch FROM recorded_at)*1000000)::bigint,1000000)=123456)=36
      FROM public.price_history) AS microseconds`;
  // Server comparisons only; never emit note/payload values or their digest.
  assert.ok(checks.channels && checks.history && checks.quota && checks.microseconds && checks.target, 'Sparse move changed protected fixture data');
}
async function quotaZero(sql: Sql) {
  fixtureStatements.length = 0;
  const report = await seedQuotaPayg(sql, 'apply', asOf);
  assert.deepEqual([report.inserted, report.superseded, report.unchanged], [0, 0, 2]);
  assert.deepEqual(fixtureStatements.filter(q => /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(q)), [], 'Actual PAYG seed issued writes');
  console.log(JSON.stringify({ mode: 'actual-payg-seed', status: 'ZERO_WRITES', unchanged: 2 }));
}

/** Read the actual public route SELECT through its current source, not a toy
 * model/provider join. The framework/DB imports are not executed. */
async function publicRows(sql: Sql, route: string, modelId: number, boundary = 'const rawPrices = await sql<any[]>`') {
  const text = readFileSync(new URL(route, import.meta.url), 'utf8');
  const offset = text.indexOf(boundary);
  assert.ok(offset >= 0, 'Public reader boundary changed; review fixture test');
  const start = offset + boundary.length;
  const end = text.indexOf('`;', start);
  const query = text.slice(start, end).replace(/\$\{productIdNum\}|\$\{product\.id\}|\$\{model\.id\}/g, '$1');
  assert.ok(!query.includes('${'), 'Unexpected reader query interpolation');
  return sql.unsafe(query, [modelId]);
}

/** Execute the current model-page history SELECT with IDs from actual route results. */
async function publicHistory(sql: Sql, channelIds: number[]) {
  const source = readFileSync(new URL('../../src/app/[locale]/models/[slug]/page.tsx', import.meta.url), 'utf8');
  const boundary = 'const historyRows = await sql<any[]>`';
  const start = source.indexOf(boundary); assert.ok(start >= 0, 'History query boundary changed');
  const query = source.slice(start + boundary.length, source.indexOf('`;', start))
    .replace('${sql.array(channelIds, INT4_ARRAY)}', '$1::integer[]');
  assert.ok(!query.includes('${'), 'Unexpected history query interpolation');
  return sql.unsafe(query, [sql.array(channelIds, 1007)]);
}
async function selectorExcludesPair(sql: Sql) {
  const catalog = await sql<{id: number; slug: string}[]>`SELECT id,slug FROM public.models WHERE id IN (3014,3192)`;
  // Give both identities the producer that could select them: existing selector
  // must exclude batch even with matching ownership and no missing metadata.
  assert.deepEqual(resolveSelector({providers:['openai']}, catalog.map(row => ({...row,providerSlugs:['openai'],elo:null}))).models, []);
}

async function sequenceState(sql: Sql) {
  // Fixture sequence state, including is_called, stays exact through all executor modes.
  const rows = await sql`SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`;
  const state: unknown[]=[];
  for (const row of rows) state.push([row.sequencename, ...(await sql.unsafe('SELECT last_value::text,is_called FROM public."'+row.sequencename+'"'))]);
  return canonical(state);
}
async function sourceRestored(sql: Sql) {
  const [r] = await sql`SELECT NOT EXISTS((SELECT * FROM public.models EXCEPT ALL SELECT * FROM o3_before_models)
    UNION ALL (SELECT * FROM o3_before_models EXCEPT ALL SELECT * FROM public.models)) AS ok`;
  assert.ok(r.ok,'Source public restoration/target changed');
}
type Fault = 'old-timestamp-codec' | 'omit-license' | 'corrupt-field' | 'corrupt-result'
  | 'apply-target' | 'apply-channel' | 'apply-source-channel' | 'apply-history'
  | 'restore-target' | 'restore-channel' | 'restore-source-channel' | 'restore-history';
/** Client test boundary only. Always invoke the exported executor and real SQL;
 * faults alter its actual transaction/input/result, never its invariant verdict. */
function faultClient(client: Sql, fault: Fault): { sql: Sql; fired: () => boolean } {
  let fired = false;
  const wrap = (tx: Sql): Sql => new Proxy(tx, {
    get(target, key) {
      if (key === 'unsafe') return async (query: string, parameters: (string | null)[] = []) => {
        if (!fired && query.startsWith('INSERT INTO public.models ')) {
          if (fault === 'old-timestamp-codec') {
            fired = true; query = query.replaceAll('::text::timestamp with time zone','::timestamp with time zone');
          } else if (fault === 'omit-license') {
            fired = true;
            const match = /^INSERT INTO public.models \((.*)\) VALUES \((.*)\)$/.exec(query)!;
            const columns = match[1].split(','); const values = match[2].split(',');
            const index = columns.indexOf('"license"'); assert.ok(index >= 0);
            columns.splice(index,1); values.splice(index,1); parameters = [...parameters]; parameters.splice(index,1);
            query = 'INSERT INTO public.models ('+columns.join(',')+') VALUES ('+
              values.map((v,i)=>v.replace(/\$\d+/, '$'+(i+1))).join(',')+')';
          } else if (fault === 'corrupt-field') {
            fired = true; parameters = [...parameters]; parameters[1] = 'synthetic wrong source name';
          }
        }
        const result = await target.unsafe(query, parameters);
        if (!fired && fault === 'corrupt-result' && query.startsWith('SELECT ') && query.includes('FROM public.models WHERE')
          && result.some(row => row.id === '3014')) {
          fired = true;
          return result.map(row=>row.id === '3014' ? {...row,created_at:'2026-09-01T00:00:00.123000Z'} : row);
        }
        return result;
      };
      const value = Reflect.get(target,key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    async apply(target, thisArg, args) {
      const result = await Reflect.apply(target,thisArg,args);
      const query = (args[0] as TemplateStringsArray).join('?');
      const phase = fault.startsWith('apply-') ? '3192' : '3014';
      if (!fired && /^(apply|restore)-(target|channel|source-channel|history)$/.test(fault)
        && query.includes('UPDATE public.api_channel_prices SET model_id='+phase)) {
        fired = true;
        if (fault.endsWith('-target')) await tx`UPDATE public.models SET description='synthetic extra effect' WHERE id=3192`;
        if (fault.endsWith('-source-channel')) await tx`UPDATE public.api_channel_prices SET notes='synthetic extra effect' WHERE id=15031`;
        else if (fault.endsWith('-channel')) await tx`UPDATE public.api_channel_prices SET notes='synthetic extra effect' WHERE id=15334`;
        if (fault.endsWith('-history')) await tx`UPDATE public.price_history SET source='synthetic extra effect' WHERE id=1`;
      }
      return result;
    },
  }) as Sql;
  return {sql: new Proxy(client, {get(target,key) {
    if (key === 'begin') return (isolation: string, work: (tx: Sql)=>unknown) =>
      target.begin(isolation, raw=>work(wrap(raw as unknown as Sql)) as any);
    const value = Reflect.get(target,key); return typeof value === 'function' ? value.bind(target) : value;
  }}), fired:()=>fired};
}
export async function main() {
  const url = requireO3TestUrl(process.env.O3_TEST_DATABASE_URL); // Before client import/connection; no skip.
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, connect_timeout: 3, prepare: false, onnotice:()=>{},
    debug: (_id, query) => { fixtureStatements.push(query); } });
  const statements:string[]=[];
  const connectExecutor=()=>postgres(url,{max:1,connect_timeout:3,prepare:false,onnotice:()=>{},debug:(_id,query)=>{statements.push(query);}});
  const writeStatements=()=>statements.filter(q=>/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(q));
  let execution = connectExecutor();
  const root=mkdtempSync(join(tmpdir(),'o3-native-')); const directory=join(root,'journal');
  const outputs: Record<string,unknown>[]=[];
  function emit(result: Record<string,unknown>) {
    // Allowlisted public evidence only; no manifest, notes, payloads or their hashes.
    const safe = Object.fromEntries(['mode','status','planDigest','publicMutations','durablePublicMutations']
      .filter(key=>key in result).map(key=>[key,result[key]]));
    if (!safe.mode) safe.mode = ({FROZEN:'freeze',APPLIED:'apply',REPEAT0:'repeat0',
      REHEARSED_ROLLBACK:'rehearse',RESTORE_REHEARSED_ROLLBACK:'restore-rehearse',RESTORED:'restore'} as Record<string,string>)[String(safe.status)];
    outputs.push(safe); console.log(JSON.stringify(safe));
  }
  try {
    const [identity] = await sql`SELECT current_database() AS name,HOST(inet_server_addr()) AS host,inet_server_port() AS port`;
    assert.equal(identity.name, new URL(url).pathname.slice(1)); assert.equal(identity.host, '127.0.0.1'); assert.equal(identity.port, 55439);
    const [empty] = await sql`SELECT NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')
      AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
      AND NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') AS ok`;
    assert.ok(empty.ok, 'Fresh empty dedicated database required');
    const [version] = await sql`SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999 AS ok`;
    assert.ok(version.ok, 'Postgres17 is required');
    emit({ mode:'native-environment',status:'PG17_LOOPBACK_EMPTY' });
    await fixture(sql);
    assert.equal((await sql`SELECT count(*)::text AS n FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('models','api_channel_prices','model_slug_redirects')`)[0].n,'55');
    let adapter=new O3Executor(execution,directory);
    const initialSequence=await sequenceState(sql);
    const initial=await adapter.preview();emit({mode:'initial-preview',status:initial.status,planDigest:initial.planDigest});assert.match(initial.planDigest,/^[a-f0-9]{64}$/);
    assert.equal((await adapter.preview()).planDigest,initial.planDigest);
    assert.deepEqual(writeStatements(),[],'Preview issued DDL/DML');
    const [noDDL]=await sql`SELECT to_regnamespace('o3_executor') IS NULL AS ok`;
    assert.ok(noDDL.ok,'Preview bootstrapped schema');
    assert.equal(initial.manifest.sourceModel.max_output_tokens,'9223372036854775806');
    assert.equal(initial.manifest.sourceModel.created_at,'2026-09-01T00:00:00.123450Z');
    assert.equal(initial.manifest.sourceModel.released_at,'2025-04-16T17:10:57.123456Z');
    assert.equal(initial.manifest.sourceModel.updated_at,'9999-12-31T23:59:59.999999Z');
    assert.equal(initial.manifest.targetModel.released_at,'0001-01-01T00:00:00.000001Z');
    assert.equal(initial.manifest.targetModel.updated_at,null);
    assert.equal(initial.manifest.channels[0].last_verified,'2026-09-10T19:24:35.925450Z');
    assert.equal(initial.manifest.channels[0].updated_at,'2026-09-02T00:00:00.000007Z');
    assert.doesNotMatch(canonical(initial),/synthetic opaque|synthetic canonical|synthetic discount|source_channel.*notes/);
    await unchanged(sql,false); await quotaZero(sql);
    const before=await publicRows(sql,'../../src/app/api/channels/[productId]/route.ts',3192);
    assert.equal(before.length,1); assert.equal(before[0].id,15334); assert.equal(before[0].price_variants.length,1);
    const slugBefore = await publicRows(sql,'../../src/app/api/products/[slug]/channels/route.ts',3192);
    assert.equal(slugBefore.length,1); assert.equal(slugBefore[0].id,15334);
    assert.equal((await publicRows(sql,'../../src/app/api/channels/[productId]/route.ts',3014)).length,0);
    const pageBefore = await publicRows(sql,'../../src/app/[locale]/models/[slug]/page.tsx',3192,'const rawChannelPrices = await sql<any[]>`');
    assert.equal(pageBefore.length,1); assert.equal(pageBefore[0].id,15334);
    const historyBefore = await publicHistory(sql,pageBefore.map(row => row.id)); assert.equal(historyBefore.length,71);
    await selectorExcludesPair(sql);
    const sourceWriter = applicationPaths(actualQueryClient(sql));
    assert.equal((await sourceWriter.run({success:true,source:'OpenRouter',prices:[{upstreamModelId:'unreviewed/feed',
      modelSlug:'o3-(batch)',modelName:'o3-(batch)',inputPricePer1M:2,outputPricePer1M:8,isAvailable:true}]},true,true)).errors,1);
    assert.equal(sourceWriter.retirements(),0); await unchanged(sql,false);
    emit({mode:'unbound-source-writer',status:'REFUSED_ATOMICALLY'});
    assert.equal((await sourceWriter.run({success:true,source:'OpenRouter',prices:[{upstreamModelId:'unreviewed/feed',
      modelSlug:'openai-o3-batch',modelName:'o3-batch',inputPricePer1M:2,outputPricePer1M:8,isAvailable:true}]},true,true)).errors,1);
    assert.equal(sourceWriter.retirements(),0); await unchanged(sql,false);
    emit({mode:'unbound-target-writer',status:'REFUSED_ATOMICALLY'});

    async function refused(label:string,seed:()=>Promise<unknown>,undo:()=>Promise<unknown>) {
      await seed();
      try { await assert.rejects(adapter.preview(),label); }
      finally { await undo(); }
      await unchanged(sql,false);
      emit({mode:label,status:'REFUSED'});
    }
    await refused('unknown incoming FK',()=>sql`CREATE TABLE public.o3_extra_ref (model_id integer REFERENCES public.models(id))`,()=>sql`DROP TABLE public.o3_extra_ref`);
    await refused('unknown index',()=>sql`CREATE INDEX o3_extra_idx ON public.api_channel_prices(model_id)`,()=>sql`DROP INDEX public.o3_extra_idx`);
    await refused('unknown check',()=>sql`ALTER TABLE public.models ADD CONSTRAINT o3_extra_check CHECK(id>0)`,()=>sql`ALTER TABLE public.models DROP CONSTRAINT o3_extra_check`);
    await refused('type/typmod drift',()=>sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency TYPE varchar(4)`,()=>sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency TYPE varchar(3)`);
    await sql.unsafe(`CREATE FUNCTION public.o3_test_trigger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$`);
    await refused('unknown trigger',()=>sql`CREATE TRIGGER o3_extra_trigger BEFORE UPDATE ON public.api_channel_prices FOR EACH ROW EXECUTE FUNCTION public.o3_test_trigger()`,()=>sql`DROP TRIGGER o3_extra_trigger ON public.api_channel_prices`);
    await refused('zero-row cascade statement trigger',()=>sql`CREATE TRIGGER o3_cascade_trigger BEFORE DELETE ON public.model_plan_mapping FOR EACH STATEMENT EXECUTE FUNCTION public.o3_test_trigger()`,()=>sql`DROP TRIGGER o3_cascade_trigger ON public.model_plan_mapping`);
    // Unrelated user function is not a universal blocker; it is unreachable by this graph.
    await adapter.preview(); await sql`DROP FUNCTION public.o3_test_trigger()`;
    await sql`CREATE DOMAIN public.o3_unknown_type AS varchar(3)`;
    await sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency DROP DEFAULT`;
    await refused('unknown domain type',()=>sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency TYPE public.o3_unknown_type USING currency::public.o3_unknown_type`,()=>sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency TYPE varchar(3) USING currency::varchar(3)`);
    await sql`ALTER TABLE public.api_channel_prices ALTER COLUMN currency SET DEFAULT 'USD'::varchar`;
    await sql`DROP DOMAIN public.o3_unknown_type`;
    await refused('unsupported timestamp type',()=>sql`ALTER TABLE public.models ALTER COLUMN released_at TYPE timestamp without time zone USING released_at AT TIME ZONE 'UTC'`,
      ()=>sql`ALTER TABLE public.models ALTER COLUMN released_at TYPE timestamp with time zone USING released_at AT TIME ZONE 'UTC'`);
    for (const value of ['infinity','-infinity','10000-01-01 00:00:00+00','0001-01-01 00:00:00 BC']) {
      const [saved] = await sql`SELECT released_at::text AS value FROM public.models WHERE id=3014`;
      await refused('unsupported timestamp range',()=>sql`UPDATE public.models SET released_at=${value}::text::timestamptz WHERE id=3014`,
        ()=>sql`UPDATE public.models SET released_at=${saved.value}::text::timestamptz WHERE id=3014`);
    }
    await refused('model slug drift',()=>sql`UPDATE public.models SET slug='o3-rebound' WHERE id=3014`,()=>sql`UPDATE public.models SET slug='o3-(batch)' WHERE id=3014`);
    await refused('old alias collision',()=>sql`INSERT INTO public.model_slug_redirects VALUES ('o3-(batch)',3192,'fixture collision','2026-01-01+00')`,()=>sql`DELETE FROM public.model_slug_redirects WHERE old_slug='o3-(batch)'`);
    await refused('source variants',()=>sql`INSERT INTO public.api_channel_price_variants(id,model_id,provider_id,variant_key,variant_name,availability_locked) VALUES(7002,3014,59,'new','new',false)`,()=>sql`DELETE FROM public.api_channel_price_variants WHERE id=7002`);
    await refused('source history',()=>sql`INSERT INTO public.price_history(id,channel_price_id,recorded_at) VALUES(900,15031,'2026-01-01+00')`,()=>sql`DELETE FROM public.price_history WHERE id=900`);
    await refused('quota old label',()=>sql`UPDATE public.quota_estimates SET served_model='o3-(batch)' WHERE id=1`,()=>sql`UPDATE public.quota_estimates SET served_model='openai-o3-batch' WHERE id=1`);
    await refused('source reference count',()=>sql`INSERT INTO public.model_offical(id,model_id,created_at) VALUES(99991,3014,'2026-01-01+00')`,()=>sql`DELETE FROM public.model_offical WHERE id=99991`);
    await refused('third offer',()=>sql`INSERT INTO public.api_channel_prices(id,model_id,provider_id,is_available,availability_locked) VALUES(15998,3192,59,false,false)`,()=>sql`DELETE FROM public.api_channel_prices WHERE id=15998`);

    // Preview is unaffected by unused defaults. Turn them into observable nextval defaults;
    // explicit restore must still leave every sequence value/is_called unchanged.
    await sql`ALTER TABLE public.models ALTER COLUMN description SET DEFAULT nextval('public.o3_profile_models_id')::text`;
    await bootstrapO3(execution);
    const p=await adapter.preview(); emit({mode:'preview',planDigest:p.planDigest});
    await assert.rejects(adapter.freeze('0'.repeat(64)),/digest/);
    emit(await adapter.freeze(p.planDigest));
    assert.equal(statSync(directory).mode&0o777,0o700);
    const journalFile=join(directory,p.planDigest+'.json');assert.equal(statSync(journalFile).mode&0o777,0o600);
    assert.doesNotMatch(readFileSync(journalFile,'utf8'),/notes|payload|targetModel|synthetic opaque|synthetic canonical/);
    const preparedOnly=await adapter.resume(p.planDigest);assert.equal(preparedOnly.status,'PREPARED_ONLY');emit({mode:'resume',...preparedOnly});
    emit(await adapter.rehearse(p.planDigest)); await unchanged(sql,false); await sourceRestored(sql);
    const [noMarker]=await sql`SELECT count(*)::text AS n FROM o3_executor.commits`;assert.equal(noMarker.n,'0');
    assert.equal(await sequenceState(sql),initialSequence);
    await assert.rejects(adapter.apply('0'.repeat(64)));
    const journalText=readFileSync(journalFile,'utf8');
    const tampered=JSON.parse(journalText);tampered.sourceModel.name='TAMPER';writeFileSync(journalFile,canonical(tampered)+'\n');
    await assert.rejects(adapter.apply(p.planDigest),/drift/);writeFileSync(journalFile,journalText);
    // Explicit advisory and row/table contention using an independent session. Bounded timeout.
    await sql.begin(async raw=>{const tx=raw as unknown as Sql;await tx`SELECT pg_advisory_xact_lock(3014,3192)`;
      await assert.rejects(adapter.apply(p.planDigest),/advisory lock busy/);});
    await sql.begin(async raw=>{const tx=raw as unknown as Sql;await tx`UPDATE public.api_channel_prices SET model_id=model_id WHERE id=15031`;
      await assert.rejects(adapter.apply(p.planDigest),/55P03|40001/);throw 'rollback-row-lock';}).catch(e=>{if(e!=='rollback-row-lock')throw e;});
    await unchanged(sql,false);
    // Drift AFTER freeze must fail under the actual execution lock.
    await sql`UPDATE public.models SET description='fixture metadata drift' WHERE id=3192`;
    await assert.rejects(adapter.apply(p.planDigest),/drift/);
    await sql`UPDATE public.models SET description=NULL WHERE id=3192`;
    // Row-version drift means a fresh public approval/digest is mandatory even after reverting values.
    const approved=await adapter.preview();emit({mode:'refreeze',planDigest:approved.planDigest});emit(await adapter.freeze(approved.planDigest));
    for (const fault of ['apply-target','apply-channel','apply-source-channel','apply-history'] as const) {
      const broken = faultClient(execution,fault);
      await assert.rejects(new O3Executor(broken.sql,directory).apply(approved.planDigest),/conservation invariant failed/);
      assert.ok(broken.fired(),fault+' was not exercised');
      await unchanged(sql,false); await sourceRestored(sql);
      assert.equal((await adapter.resume(approved.planDigest)).status,'PREPARED_ONLY');
      assert.equal((await sql`SELECT count(*)::text AS n FROM public.model_slug_redirects`)[0].n,'0');
      assert.equal((await adapter.preview()).planDigest,approved.planDigest);
      emit({mode:fault,status:'REFUSED_ATOMICALLY',planDigest:approved.planDigest});
    }
    statements.length=0;emit(await adapter.apply(approved.planDigest));
    assert.equal(writeStatements().filter(q=>/^\s*UPDATE public.api_channel_prices SET model_id=3192/i.test(q)).length,1);
    assert.equal(writeStatements().filter(q=>/^\s*DELETE FROM public.models/i.test(q)).length,1);
    assert.equal(writeStatements().filter(q=>/^\s*INSERT INTO public.model_slug_redirects/i.test(q)).length,1);
    await unchanged(sql,true);await quotaZero(sql);statements.length=0;emit(await adapter.repeat0(approved.planDigest));
    assert.deepEqual(writeStatements(),[],'repeat0 issued a mutation');
    assert.equal(await sequenceState(sql),initialSequence);
    await execution.end({timeout:3});
    // A truly new process reconciles durable proof; no in-memory transaction/journal state.
    const child=spawnSync(process.execPath,['--import','tsx','scripts/o3-model-only/cli.ts','resume',directory,approved.planDigest],
      {cwd:process.cwd(),env:{...process.env,O3_DATABASE_URL:url},encoding:'utf8',timeout:15000});
    assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).status,'APPLIED');
    emit({mode:'fresh-process-resume',...JSON.parse(child.stdout)});
    execution=connectExecutor();adapter=new O3Executor(execution,directory);
    emit(await adapter.repeat0(approved.planDigest));
    emit(await adapter.restoreRehearse(approved.planDigest));await unchanged(sql,true);
    assert.equal((await adapter.resume(approved.planDigest)).status,'APPLIED');
    const after=await publicRows(sql,'../../src/app/api/channels/[productId]/route.ts',3192);
    assert.equal(after.length,1);assert.equal(after[0].id,15334);assert.equal(JSON.stringify(after[0].price_variants),JSON.stringify(before[0].price_variants));
    const slugAfter = await publicRows(sql,'../../src/app/api/products/[slug]/channels/route.ts',3192);
    assert.equal(slugAfter.length,1); assert.equal(slugAfter[0].id,15334);
    assert.equal(JSON.stringify(slugAfter[0].price_variants),JSON.stringify(slugBefore[0].price_variants));
    assert.equal((await publicRows(sql,'../../src/app/api/channels/[productId]/route.ts',3014)).length,0);
    const pageAfter = await publicRows(sql,'../../src/app/[locale]/models/[slug]/page.tsx',3192,'const rawChannelPrices = await sql<any[]>`');
    assert.equal(pageAfter.length,1); assert.equal(pageAfter[0].id,15334);
    assert.equal(JSON.stringify(pageAfter[0].price_variants),JSON.stringify(pageBefore[0].price_variants));
    assert.equal(JSON.stringify(await publicHistory(sql,pageAfter.map(row => row.id))),JSON.stringify(historyBefore));
    await selectorExcludesPair(sql); await quotaZero(sql);
    assert.equal((await applicationPaths(actualQueryClient(sql)).getOrCreateProduct({slug:'o3-(batch)',name:'o3-(batch)',type:'llm'})).id,3192);
    await sql`CREATE TABLE public.o3_restore_extra_ref(model_id integer REFERENCES public.models(id))`;
    await assert.rejects(adapter.restore(approved.planDigest),/Unsupported affected structure/);
    await sql`DROP TABLE public.o3_restore_extra_ref`;
    await unchanged(sql,true);
    const sealed=readFileSync(join(directory,approved.planDigest+'.json'),'utf8');
    const changed=JSON.parse(sealed);changed.sourceModel.description='tampered restore';writeFileSync(join(directory,approved.planDigest+'.json'),canonical(changed)+'\n');
    await assert.rejects(adapter.restore(approved.planDigest),/tamper|proof/);writeFileSync(join(directory,approved.planDigest+'.json'),sealed);
    for (const fault of ['old-timestamp-codec','omit-license','corrupt-field','corrupt-result',
      'restore-target','restore-channel','restore-source-channel','restore-history'] as const) {
      const markerBefore = canonical(await sql`SELECT * FROM o3_executor.commits WHERE plan_digest=${approved.planDigest}`);
      const broken = faultClient(execution,fault);
      await assert.rejects(new O3Executor(broken.sql,directory).restore(approved.planDigest),/invariant failed/);
      assert.ok(broken.fired(),fault+' was not exercised');
      await unchanged(sql,true);
      assert.equal(canonical(await sql`SELECT * FROM o3_executor.commits WHERE plan_digest=${approved.planDigest}`),markerBefore);
      assert.equal((await sql`SELECT count(*)::text AS n FROM public.models WHERE id=3014`)[0].n,'0');
      assert.equal((await adapter.resume(approved.planDigest)).status,'APPLIED');
      assert.equal((await adapter.repeat0(approved.planDigest)).status,'REPEAT0'); // actual FK, own alias and versions still exact
      assert.equal(await sequenceState(sql),initialSequence);
      emit({mode:fault,status:'REFUSED_ATOMICALLY',planDigest:approved.planDigest});
    }
    statements.length=0;emit(await adapter.restore(approved.planDigest));
    assert.equal(writeStatements().filter(q=>/^\s*INSERT INTO public.models/i.test(q)).length,1);
    assert.equal(writeStatements().filter(q=>/^\s*UPDATE public.api_channel_prices SET model_id=3014/i.test(q)).length,1);await unchanged(sql,false);await sourceRestored(sql);await quotaZero(sql);
    const restoredProof=await adapter.resume(approved.planDigest);assert.equal(restoredProof.status,'RESTORED');emit({mode:'resume',...restoredProof});
    await assert.rejects(adapter.restore(approved.planDigest),/RESTORED/);
    assert.equal(await sequenceState(sql),initialSequence);

    // Fresh approvals exercise finite boundaries and NULL on every restored temporal
    // column, alongside exact bigint extremes and PostgreSQL array representations.
    for (const [index,values] of [
      [null,'0001-01-01 00:00:00.000001+00',null,'-9223372036854775808'],
      ['2026-09-01 08:00:00.123456+08',null,'2026-09-02 05:45:00.100009+05:45','9223372036854775807'],
    ].entries()) {
      await sql`UPDATE public.models SET released_at=${values[0]}::text::timestamptz,
        created_at=${values[1]}::text::timestamptz,updated_at=${values[2]}::text::timestamptz,
        max_output_tokens=${values[3]}::text::bigint WHERE id=3014`;
      await sql`CREATE TEMP TABLE o3_temporal_case AS SELECT * FROM public.models WHERE id=3014`;
      const fresh=await adapter.preview();emit({mode:'temporal-preview-'+index,planDigest:fresh.planDigest});
      emit(await adapter.freeze(fresh.planDigest));emit(await adapter.apply(fresh.planDigest));
      emit(await adapter.restore(fresh.planDigest));
      const [exact]=await sql`SELECT NOT EXISTS((SELECT * FROM public.models WHERE id=3014 EXCEPT ALL TABLE o3_temporal_case)
        UNION ALL(TABLE o3_temporal_case EXCEPT ALL SELECT * FROM public.models WHERE id=3014)) AS ok`;
      assert.ok(exact.ok,'Fresh temporal/bigint/array case was not restored exactly');
      await unchanged(sql,false);assert.equal(await sequenceState(sql),initialSequence);
      await sql`DROP TABLE o3_temporal_case`;
      emit({mode:'temporal-boundary-'+index,status:'PASS',planDigest:fresh.planDigest});
    }

    // A final actual apply is used solely to prove restore conflicts after a legitimate scrape.
    const late=await adapter.preview();emit({mode:'late-preview',planDigest:late.planDigest});emit(await adapter.freeze(late.planDigest));emit(await adapter.apply(late.planDigest));
    await sql`INSERT INTO public.model_offical(id,model_id,created_at) VALUES(99992,3192,'2026-01-01+00')`;
    await assert.rejects(adapter.restore(late.planDigest),/conflict/);await sql`DELETE FROM public.model_offical WHERE id=99992`;
    emit({mode:'late-reference-restore',status:'REFUSED_ATOMICALLY',planDigest:late.planDigest});
    await sql`INSERT INTO public.price_history(id,channel_price_id,recorded_at) VALUES(901,15334,'2026-01-01+00')`;
    await assert.rejects(adapter.restore(late.planDigest),/conflict/);await sql`DELETE FROM public.price_history WHERE id=901`;
    emit({mode:'late-history-restore',status:'REFUSED_ATOMICALLY',planDigest:late.planDigest});
    await sql`INSERT INTO public.model_slug_redirects VALUES('late-alias',3192,'fixture','2026-01-01+00')`;
    await assert.rejects(adapter.restore(late.planDigest),/Alias/);await sql`DELETE FROM public.model_slug_redirects WHERE old_slug='late-alias'`;
    emit({mode:'late-alias-restore',status:'REFUSED_ATOMICALLY',planDigest:late.planDigest});
    // Nonempty collector replay preserves source labels and remains outside the mutation set.
    const samples:Sample[]=[0,1].map(index=>({planSlug:'payg:openrouter',collector:'codex-log',accountLabel:'synthetic-o3',
      observedAt:`2026-11-16T1${index}:00:00.000Z`,window:'5h',windowMinutes:300,resetsAt:'2026-11-16T17:00:00.000Z',
      usedPct:25+index*10,tokensInput:100,tokensCached:500,tokensCacheWrite:0,tokensOutput:50,tokensReasoning:0,
      model:'openai-o3-batch',raw:{source:'token_count',eventId:`synthetic-o3-${index}`},confidence:'high'}));
    await persistSamples(sql,samples);await persistSamples(sql,samples);const loaded=await loadHistory(sql,samples);
    assert.equal(loaded.length,2);assert.equal(windowSummary(loaded)[0].model,'openai-o3-batch');
    emit({mode:'nonempty-collector',status:'PASS',planDigest:late.planDigest});
    const app=applicationPaths(actualQueryClient(sql));
    await quotaZero(sql); await quotaZero(sql); // repeated actual seed remains zero-write
    assert.equal((await app.run({success:true,source:'OpenRouter',prices:[{modelSlug:'openai-o3-batch',modelName:'o3-batch',inputPricePer1M:2,outputPricePer1M:8,isAvailable:true}]},true)).errors,1);
    assert.equal(app.retirements(),0);await unchanged(sql,true);
    assert.equal((await app.run({success:true,source:'OpenRouter',prices:[{upstreamModelId:'openai/o3:batch',modelSlug:'openai-o3-batch',modelName:'o3-batch',inputPricePer1M:2,outputPricePer1M:8,isAvailable:true}]})).errors,0);
    const [history]=await sql`SELECT count(*)::text AS n FROM public.price_history WHERE channel_price_id=15334`;assert.equal(history.n,'72');
    const [onlyTwo]=await sql`SELECT count(*)::text AS n FROM public.api_channel_prices WHERE model_id=3192`;assert.equal(onlyTwo.n,'2');
    await assert.rejects(adapter.restore(late.planDigest),/conflict/);
    const [preserved]=await sql`SELECT
      (SELECT (to_jsonb(c)-'model_id')=(to_jsonb(b)-'model_id') FROM public.api_channel_prices c
        JOIN o3_before_channels b USING(id) WHERE c.id=15031) AS source_quote,
      NOT EXISTS(SELECT 1 FROM o3_before_history b LEFT JOIN public.price_history h USING(id)
        WHERE to_jsonb(h) IS DISTINCT FROM to_jsonb(b)) AS original_history,
      NOT EXISTS((SELECT * FROM public.quota_estimates EXCEPT ALL SELECT * FROM o3_before_quota)
        UNION ALL (SELECT * FROM o3_before_quota EXCEPT ALL SELECT * FROM public.quota_estimates)) AS quota`;
    assert.ok(preserved.source_quote && preserved.original_history && preserved.quota,'Late writer/failed restore clobbered retained data');
    const [lateState]=await sql`SELECT phase,(SELECT count(*)::text FROM public.models WHERE id=3014) AS source FROM o3_executor.commits WHERE plan_digest=${late.planDigest}`;
    assert.equal(lateState.phase,'APPLIED');assert.equal(lateState.source,'0');
    emit({mode:'late-scrape-restore',status:'REFUSED_ATOMICALLY',planDigest:late.planDigest});
    // Actual bounded writer failure, with real PostgreSQL transactions. The
    // price UPDATE commits before the separate history INSERT is refused.
    // This is an existing residual, not an atomicity guarantee of this repair.
    await sql`ALTER TABLE public.price_history ADD CONSTRAINT o3_synthetic_history_failure CHECK(new_input_price IS DISTINCT FROM 3)`;
    const historyBeforeFailure = (await sql`SELECT count(*)::text AS n FROM public.price_history`)[0].n;
    const failedWriter = applicationPaths(actualQueryClient(sql));
    const failed = await failedWriter.run({success:true,source:'OpenRouter',prices:[{upstreamModelId:'openai/o3:batch',
      modelSlug:'openai-o3-batch',modelName:'o3-batch',inputPricePer1M:3,outputPricePer1M:12,isAvailable:true}]},true);
    assert.equal(failed.errors,1); assert.equal(failedWriter.retirements(),0);
    assert.ok(failedWriter.errors.length > 0);
    assert.equal((await sql`SELECT input_price_per_1m::text AS price FROM public.api_channel_prices WHERE id=15334`)[0].price,'3');
    assert.equal((await sql`SELECT count(*)::text AS n FROM public.price_history`)[0].n,historyBeforeFailure);
    assert.equal((await sql`SELECT count(*)::text AS n FROM public.api_channel_prices WHERE model_id=3192`)[0].n,'2');
    assert.equal((await sql`SELECT is_available FROM public.api_channel_prices WHERE id=15031`)[0].is_available,false);
    const [writerIdentity] = await sql`SELECT
      (SELECT count(*)=1 AND bool_and(id=3192 AND slug='openai-o3-batch') FROM public.models
        WHERE id IN (3014,3192) OR slug IN ('o3-(batch)','openai-o3-batch')) AS models,
      (SELECT count(*)=1 AND bool_and(old_slug='o3-(batch)' AND model_id=3192) FROM public.model_slug_redirects) AS aliases,
      (SELECT (to_jsonb(c)-'model_id')=(to_jsonb(b)-'model_id') FROM public.api_channel_prices c
        JOIN o3_before_channels b USING(id) WHERE c.id=15031) AS retained`;
    assert.ok(writerIdentity.models && writerIdentity.aliases && writerIdentity.retained);
    await sql`ALTER TABLE public.price_history DROP CONSTRAINT o3_synthetic_history_failure`;
    await assert.rejects(adapter.restore(late.planDigest),/conflict/);
    emit({mode:'bound-history-failure',status:'PRICE_PERSISTED_HISTORY_REFUSED_ERROR_SURFACED_BOTH_RETIREMENTS_INHIBITED'});
    console.log(JSON.stringify({status:'PASS',profile:'authored affected shape, not live equivalence',journalPath:directory,modes:outputs},null,2));
    console.log('PASS real exported preview/freeze/rehearse/apply/repeat0/fresh-process resume/restore-rehearse/restore; negative drift and late scrape conflicts. Dedicated fixture ends APPLIED after deliberate late scrape.');
  } finally { await execution.end({timeout:5});await sql.end({timeout:5}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{
    // Assertions/driver diagnostics can carry actual payloads. Retain code/location
    // and the already-emitted progress, never print raw error objects or messages.
    const code=error instanceof assert.AssertionError ? 'ERR_ASSERTION' :
      error && typeof error.code==='string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'DRIVER_FAILURE';
    const frames=error instanceof Error ? (error.stack ?? '').split('\n')
      .filter(line=>/^\s+at /.test(line) && line.includes('/scripts/o3-model-only/')) : [];
    console.error(JSON.stringify({status:'FAILED_NO_SKIP',code,frames}));process.exitCode=1;
  });
}
