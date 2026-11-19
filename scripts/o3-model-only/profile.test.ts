/** Offline authored-profile checks, not a PostgreSQL/native equivalence claim. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import profile from './fixtures/supported-affected-profile.json';
import { canonical, digest } from './exact';
import { O3Executor, bootstrapO3 } from './adapter';
import { checkStructure, StructureConflict } from './structure';
import type { Sql } from 'postgres';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('complete authored affected columns/constraints/indexes and ten FK families, no invented channel unique',()=>{
  assert.equal(profile.columns.length,55);assert.equal(profile.constraints.length,11);assert.equal(profile.indexes.length,7);assert.equal(profile.incoming.length,10);
  assert.deepEqual(profile.columns.filter(c=>c.table==='models').map(c=>c.name).length,29);
  assert.equal(profile.columns.filter(c=>c.table==='api_channel_prices').length,22);
  assert.equal(profile.columns.filter(c=>c.table==='model_slug_redirects').length,4);
  assert.equal(profile.readColumns.length,24);assert.equal(profile.readIndexes.length,33);
  const ddl=readFileSync(new URL('./fixtures/supported-public-schema.sql',import.meta.url),'utf8');
  for(const c of profile.columns) {
    const start=ddl.indexOf('CREATE TABLE public."'+c.table+'" (');assert.ok(start>=0);
    const definition=ddl.slice(start,ddl.indexOf('\n);',start));
    assert.ok(definition.includes('"'+c.name+'" '+c.type+(c.nullable?'':' NOT NULL')),`${c.table}.${c.name}`);
    if(c.authoredDefault!==null) assert.ok(ddl.includes('ALTER COLUMN "'+c.name+'" SET DEFAULT '+c.authoredDefault+';'));
  }
  for(const c of profile.constraints) assert.ok(ddl.includes('ADD CONSTRAINT "'+c.name+'" '+c.definition+';'));
  assert.doesNotMatch(ddl,/UNIQUE \(model_id, provider_id\)|CREATE (?:OR REPLACE )?FUNCTION/);
  assert.equal(digest(profile),digest(JSON.parse(canonical(profile))));
});
test('preview is import-safe, requires real structure and has no journal/filesystem/bootstrap path',async()=>{
  const calls:string[]=[];
  const tx=async(strings:TemplateStringsArray)=>{const query=strings.join('?');calls.push(query);
    if(query.includes('session_replication_role'))return[{ok:true}];
    if(query.includes('SELECT c.relname AS "table",a.attname'))throw new Error('offline connection sentinel');
    return[];
  };
  const sql={begin:async(isolation:string,work:(tx:unknown)=>unknown)=>{
    assert.equal(isolation,'isolation level repeatable read read only');return work(tx);
  }} as unknown as Sql;
  await assert.rejects(new O3Executor(sql,'/does/not/exist/no-preview-files').preview(),/offline connection sentinel/);
  assert.ok(calls.every(q=>!/^\s*(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(q)));
});

// Catalog responses only: invoke the real gate without opening a connection.
type CatalogRows = Record<string, Record<string, unknown>[]>;
function structureSql(change: (rows: CatalogRows) => void = () => {}): Sql {
  const safe = (rows: Record<string, unknown>[]) => rows.map(row => ({ ...row, safe: true }));
  const rows: CatalogRows = {
    columns: safe([...profile.columns.map(({ authoredDefault: _, ...c }) => c), ...profile.readColumns]),
    constraints: safe(profile.constraints),
    indexes: safe([...profile.indexes, ...profile.readIndexes]),
    incoming: safe(profile.incoming),
    relations: safe([...profile.tables, ...profile.readTables].map(name => ({ name }))),
    effects: [{ safe: true }],
  };
  change(rows);
  return (async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('FROM pg_attribute a JOIN pg_class c')) return rows.columns;
    if (query.includes('r.relname AS target')) return rows.incoming;
    if (query.includes('FROM pg_constraint k JOIN pg_class c')) return rows.constraints;
    if (query.includes('FROM pg_index i JOIN pg_class c')) return rows.indexes;
    if (query.includes('SELECT c.relname AS name')) return rows.relations;
    if (query.includes('WITH RECURSIVE roots')) return rows.effects;
    throw new Error('Unexpected offline catalog query: ' + query);
  }) as unknown as Sql;
}
const savedCurrencyCheck = "CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])))";
const nativeCurrencyCheck = "CHECK (((currency)::text = ANY (ARRAY[('USD'::character varying)::text, ('CNY'::character varying)::text, ('EUR'::character varying)::text, ('GBP'::character varying)::text, ('JPY'::character varying)::text, ('KRW'::character varying)::text, ('SGD'::character varying)::text])))";
function currencyConstraint(rows: CatalogRows) {
  const row = rows.constraints.find(c => c.table === 'api_channel_prices' && c.name === 'channel_prices_currency_check');
  assert.ok(row);
  return row;
}
function rejectsStructure(sql: Sql) {
  return assert.rejects(checkStructure(sql), (error: unknown) => {
    assert.ok(error instanceof StructureConflict);
    assert.ok(error.blockers.length > 0);
    return true;
  });
}

test('structure gate accepts saved and exact native PG17 currency deparses with the same digest', async () => {
  const savedDigest = await checkStructure(structureSql(rows => {
    assert.equal(currencyConstraint(rows).definition, savedCurrencyCheck);
  }));
  const nativeDigest = await checkStructure(structureSql(rows => {
    currencyConstraint(rows).definition = nativeCurrencyCheck;
  }));
  assert.equal(nativeDigest, savedDigest);
});

test('structure gate rejects changed currency list, column, operator, check and unaudited deparses', async t => {
  const mutations: [string, (definition: string) => string][] = [
    ['changed currency', d => d.replace("'SGD'", "'AUD'")],
    ['removed currency', d => d.replace(/, (?:\('KRW'::character varying\)::text|'KRW'::character varying)/, '')],
    ['added currency', d => d.replace("'SGD'::character varying", "'AUD'::character varying, 'SGD'::character varying")],
    ['duplicate currency', d => d.replace("'SGD'", "'KRW'")],
    ['reordered currencies', d => d.replace("'USD'", "'TEMP'").replace("'CNY'", "'USD'").replace("'TEMP'", "'CNY'")],
    ['changed column', d => d.replace('(currency)', '(quota_unit)')],
    ['changed operator', d => d.replace(' = ANY ', ' <> ANY ')],
    ['changed quantifier', d => d.replace(' ANY ', ' ALL ')],
    ['changed check', () => 'CHECK (true)'],
    ['removed check', d => d.replace('CHECK ', '')],
    ['weakened check', d => d.replace('CHECK (', 'CHECK (true OR ')],
    ['changed cast', d => d.replace('(currency)::text', '(currency)::character varying')],
    ['extra parentheses', d => d.replace('(currency)', '((currency))')],
    ['extra whitespace', d => d + ' '],
    ['not validated definition', d => d + ' NOT VALID'],
  ];
  for (const [form, definition] of [['saved', savedCurrencyCheck], ['PG17', nativeCurrencyCheck]]) {
    for (const [name, mutate] of mutations) await t.test(form + ': ' + name, async () => {
      const changed = mutate(definition);
      assert.notEqual(changed, definition, 'mutation must change the catalog definition');
      await rejectsStructure(structureSql(rows => { currencyConstraint(rows).definition = changed; }));
    });
  }
});

test('currency equivalence stays scoped to the table/name and preserves kind and safety guards', async t => {
  for (const definition of [savedCurrencyCheck, nativeCurrencyCheck]) {
    for (const [key, value] of [['table', 'api_channel_price_variants'], ['name', 'other_currency_check'], ['kind', 'f'], ['safe', false]] as const) {
      await t.test(definition === savedCurrencyCheck ? 'saved: ' + key : 'PG17: ' + key, async () => {
        await rejectsStructure(structureSql(rows => {
          Object.assign(currencyConstraint(rows), { definition, [key]: value });
        }));
      });
    }
  }
});

test('other constraint/index/FK definitions and catalog safety guards remain strict with native currency form', async t => {
  const nativeSql = (change: (rows: CatalogRows) => void) => structureSql(rows => {
    currencyConstraint(rows).definition = nativeCurrencyCheck;
    change(rows);
  });
  for (const key of ['constraints', 'indexes', 'incoming']) {
    const expected = key === 'constraints' ? profile.constraints : key === 'indexes' ? [...profile.indexes, ...profile.readIndexes] : profile.incoming;
    for (const descriptor of expected) {
      if (key === 'constraints' && descriptor.name === 'channel_prices_currency_check') continue;
      await t.test(key + ': ' + descriptor.table + '.' + descriptor.name, async () => {
        await rejectsStructure(nativeSql(rows => {
          const row = rows[key].find(r => r.table === descriptor.table && r.name === descriptor.name)!;
          row.definition = String(row.definition) + ' ';
        }));
      });
    }
  }
  for (const key of ['columns', 'constraints', 'indexes', 'incoming', 'relations', 'effects']) {
    await t.test(key + ': unsafe catalog row', async () => {
      await rejectsStructure(nativeSql(rows => { rows[key][0].safe = false; }));
    });
    if (key !== 'effects') await t.test(key + ': missing catalog row', async () => {
      await rejectsStructure(nativeSql(rows => { rows[key].shift(); }));
    });
  }
});

test('temporal and restored builtin type drift still refuses without expanding the profile', async t => {
  for (const type of ['timestamp without time zone','timestamp(3) with time zone','date','time with time zone',
    'interval','public.timestamp_domain','numeric','jsonb']) {
    await t.test(type,()=>rejectsStructure(structureSql(rows=>{
      rows.columns.find(c=>c.table==='models' && c.name==='created_at')!.type=type;
    })));
  }
});

/** Offline protocol double only: exercises the exported transaction control flow,
 * wire SQL and marker ordering. It is not PostgreSQL conservation/codec evidence. */
function executorProtocol() {
  type Row = Record<string,string|null>;
  const source: Row = Object.fromEntries(profile.columns.filter(c=>c.table==='models').map(c=>[c.name,null]));
  Object.assign(source,{id:'3014',slug:'o3-(batch)',name:'o3-(batch)',type:'llm',context_window:'200000',
    model_category:'text',pricing_unit:'per_1m_tokens',created_at:'2026-09-01T00:00:00.123450Z',
    released_at:'2026-09-01T00:00:00.123456Z',updated_at:null,max_output_tokens:'9223372036854775807',
    features:'{"comma,value",NULL,"NULL",""}',provider_ids:'{-2147483648,2147483647,NULL}',license:'synthetic'});
  const target: Row = {...source,id:'3192',slug:'openai-o3-batch',name:'o3-batch'};
  const offers: Row[] = ['15031','15334'].map(id=>({id,model_id:id==='15031'?'3014':'3192',provider_id:'59',is_available:id==='15031'?'false':'true'}));
  let state: {source: Row|null; moved: boolean; alias: boolean; marker?: {journal_hash: unknown;phase:string;post_state:unknown}} =
    {source,moved:false,alias:false};
  let fault: 'none'|'timestamp'|'missing-result-field'|'conservation' = 'none';
  const calls: string[]=[];
  let environment = { version: 170011, origin: true };
  const catalog = structureSql();
  const execute = async (q: string, values: unknown[] = []): Promise<unknown[]> => {
    calls.push(q);
    if (q.includes("current_setting('server_version_num')") && q.includes("current_setting('session_replication_role')"))
      return [{ok: environment.version >= 170000 && environment.version <= 179999 && environment.origin}];
    if (/FROM pg_attribute a JOIN pg_class c|r.relname AS target|FROM pg_constraint k JOIN pg_class c|FROM pg_index i JOIN pg_class c|SELECT c.relname AS name|WITH RECURSIVE roots/.test(q))
      return Reflect.apply(catalog,undefined,[[q]]);
    if (q.includes("to_regclass('o3_executor.commits')")) return [{present:true}];
    if (q.includes("a.attrelid='o3_executor.commits'")) return [
      ['plan_digest','text'],['journal_hash','text'],['phase','text'],['post_state','jsonb']
    ].map(([attname,type])=>({attname,type,attnotnull:true}));
    if (q.includes('FROM o3_executor.commits')) return state.marker ? [state.marker] : [];
    if (q.startsWith('INSERT INTO o3_executor.commits')) {
      state.marker={journal_hash:values[1],phase:'APPLIED',post_state:values[2]};return [];
    }
    if (q.startsWith('UPDATE o3_executor.commits')) { state.marker!.phase='RESTORED';state.marker!.post_state=values[0];return [{plan_digest:values[1]}]; }
    if (q.startsWith('INSERT INTO public.models ')) {
      const cols=profile.columns.filter(c=>c.table==='models');
      // Verify EVERY parameter is TEXT at the wire boundary, including NULLs,
      // bigint and arrays. Types are exclusively the unchanged reviewed profile.
      assert.equal(values.length,29);
      for (const [i,c] of cols.entries()) assert.ok(q.includes('$'+(i+1)+'::text::'+c.type));
      assert.ok(values.every(v=>v===null || typeof v==='string'));
      state.source=Object.fromEntries(cols.map((c,i)=>[c.name,values[i] as string|null]));
      if (fault==='timestamp') state.source.created_at='2026-09-01T00:00:00.123000Z';
      return [];
    }
    if (q.startsWith('UPDATE public.api_channel_prices')) {state.moved=q.includes('SET model_id=3192');return [{id:15031}];}
    if (q.startsWith('DELETE FROM public.models')) {state.source=null;return [{id:3014}];}
    if (q.startsWith('INSERT INTO public.model_slug_redirects')) {
      assert.ok(q.includes('?::text::timestamptz'));state.alias=true;return [];
    }
    if (q.startsWith('DELETE FROM public.model_slug_redirects')) {
      assert.ok(q.includes('?::text::timestamptz'));state.alias=false;return [{old_slug:'o3-(batch)'}];
    }
    if (q.startsWith('WITH current_channels')) return [{channels:fault!=='conservation',models:true,history:true,redirects:true}];
    if (q.startsWith('SELECT tableoid::text')) return [{relation:'1',tuple:state.moved && /public\."(?:models|api_channel_prices|model_slug_redirects)"/.test(q)?'moved':'original',version:'1'}];
    if (q.includes('FROM public.models WHERE') && q.includes('ORDER BY id') && q.includes(' AS "id"')) {
      const restored = state.source && {...state.source};
      if (restored && fault==='missing-result-field') delete restored.license;
      return restored ? [restored,target] : [target];
    }
    if (q.includes('FROM public.api_channel_prices WHERE') && q.includes(' AS "id"'))
      return offers.map(c=>({...c,model_id:c.id==='15031' && state.moved?'3192':c.model_id}));
    if (q.includes('SELECT old_slug,model_id::text')) return state.alias ? [{old_slug:'o3-(batch)',model_id:'3192',reason:'o3-model-only:3014->3192:v1',created_at:'2026-11-17 00:00:00+00'}] : [];
    if (q.includes('AS old,')) return [{old:'0',current:'2',mixes:'2',bound:true}];
    if (q.startsWith('SELECT id,cache_read_pct')) return [{id:'chat'},{id:'coding-high-cache'}];
    if (q.includes('count(*)::text AS n')) return [{n:'0'}];
    if (q.includes(' AS ok')) return [{ok:true}];
    if (/^(SET|LOCK|CREATE TEMP TABLE|DROP TABLE)/.test(q)) return [];
    if (/SELECT (id|id::text)/.test(q)) return [];
    throw new Error('Unexpected offline protocol query: '+q);
  };
  const tx = Object.assign(async (strings: TemplateStringsArray,...values:unknown[])=>execute(strings.join('?'),values),{
    unsafe:(q:string,values:unknown[]=[])=>execute(q,values),json:(v:unknown)=>v,
  });
  const sql = {begin:async (isolationOrWork:string|((tx:unknown)=>unknown),work?:(tx:unknown)=>unknown)=>{
    const callback=typeof isolationOrWork==='function' ? isolationOrWork : work!;
    const before=structuredClone(state);
    try {return await callback(tx);} catch(e) {state=before;throw e;}
  }} as unknown as Sql;
  return {sql,calls,setFault:(value:typeof fault)=>{fault=value;},state:()=>structuredClone(state),
    setEnvironment:(value:typeof environment)=>{environment=value;}};
}

test('exported restore binds all 29 fields as text and proves exact reread/conservation before RESTORED',async()=>{
  const root=mkdtempSync(join(tmpdir(),'o3-protocol-'));
  try {
    const protocol=executorProtocol();const adapter=new O3Executor(protocol.sql,join(root,'journal'));
    const plan=await adapter.preview();await adapter.freeze(plan.planDigest);await adapter.apply(plan.planDigest);
    const applied=protocol.state();
    for (const fault of ['timestamp','missing-result-field','conservation'] as const) {
      protocol.setFault(fault);protocol.calls.length=0;
      await assert.rejects(adapter.restore(plan.planDigest),/invariant failed/);
      assert.deepEqual(protocol.state(),applied,'failed proof must roll back source/FK/alias/marker');
      assert.ok(!protocol.calls.some(q=>q.startsWith('UPDATE o3_executor.commits')));
    }
    protocol.setFault('none');protocol.calls.length=0;
    assert.equal((await adapter.restore(plan.planDigest)).status,'RESTORED');
    const calls=protocol.calls;
    const insert=calls.findIndex(q=>q.startsWith('INSERT INTO public.models'));
    const reread=calls.findIndex((q,i)=>i>insert && q.includes('FROM public.models WHERE') && q.includes(' AS "id"'));
    const guard=calls.findIndex(q=>q.startsWith('WITH current_channels'));
    const marker=calls.findIndex(q=>q.startsWith('UPDATE o3_executor.commits'));
    assert.ok(insert>=0 && reread>insert && guard>reread && marker>guard);
    assert.deepEqual(protocol.state().source,plan.manifest.sourceModel);
    assert.equal(protocol.state().marker!.phase,'RESTORED');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('exported apply refuses conservation failure before APPLIED and leaves source/FK/alias exact',async()=>{
  const root=mkdtempSync(join(tmpdir(),'o3-protocol-'));
  try {
    const protocol=executorProtocol();const adapter=new O3Executor(protocol.sql,join(root,'journal'));
    const plan=await adapter.preview();await adapter.freeze(plan.planDigest);const before=protocol.state();
    protocol.setFault('conservation');protocol.calls.length=0;
    await assert.rejects(adapter.apply(plan.planDigest),/conservation invariant failed/);
    assert.deepEqual(protocol.state(),before);
    assert.ok(!protocol.calls.some(q=>q.startsWith('INSERT INTO o3_executor.commits')));
    protocol.setFault('none');assert.equal((await adapter.apply(plan.planDigest)).status,'APPLIED');
    const lastLock = protocol.calls.findLastIndex(q => q.startsWith('LOCK TABLE'));
    assert.ok(lastLock >= 0);
    const lock = protocol.calls[lastLock];
    assert.ok(lock.includes('o3_executor.commits') && lock.endsWith('IN SHARE ROW EXCLUSIVE MODE'));
    for (const table of [...profile.tables,...profile.readTables]) assert.ok(lock.includes('public."' + table + '"'));
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('exported execution acquires complete relation locks before its first SELECT', async () => {
  const root = mkdtempSync(join(tmpdir(), 'o3-lock-protocol-'));
  try {
    const protocol = executorProtocol(); const adapter = new O3Executor(protocol.sql, join(root, 'journal'));
    const p = await adapter.preview(); await adapter.freeze(p.planDigest); protocol.calls.length = 0;
    await adapter.apply(p.planDigest);
    const lock = protocol.calls.findIndex(q => q.startsWith('LOCK TABLE'));
    const read = protocol.calls.findIndex(q => q.startsWith('SELECT'));
    assert.ok(lock >= 0 && read > lock);
    assert.ok(protocol.calls.slice(0,lock).every(q => q.startsWith('SET LOCAL')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every runtime entrypoint fails closed on unsupported PG version or replica before reads/DML/publication', async t => {
  const fresh = readFileSync(new URL('./sre-readonly-check.sql', import.meta.url), 'utf8');
  const predicate = fresh.match(/SELECT (current_setting\('server_version_num'\)[\s\S]*?) AS environment_ok/)![1].replace(/\s+/g,' ');
  for (const environment of [
    {version:160999,origin:true}, {version:180000,origin:true}, {version:0,origin:true}, {version:170011,origin:false},
  ]) await t.test(environment.origin ? 'unsupported-'+environment.version : 'replica', async () => {
    const root = mkdtempSync(join(tmpdir(),'o3-environment-'));
    try {
      const protocol = executorProtocol(); const directory = join(root,'journal');
      const adapter = new O3Executor(protocol.sql,directory);
      const p = await adapter.preview(); await adapter.freeze(p.planDigest);
      const before = protocol.state(), files = readdirSync(directory);
      // Test-only controlled client: production code has no injected version flag.
      protocol.setEnvironment(environment);
      for (const mode of ['bootstrap','preview','freeze','rehearse','apply','repeat0','restoreRehearse','restore','resume'] as const) {
        protocol.calls.length=0;
        const operation = mode==='bootstrap' ? bootstrapO3(protocol.sql) : mode==='preview' ? adapter.preview() : adapter[mode](p.planDigest);
        await assert.rejects(operation, /^Error: Runtime environment requires PostgreSQL 17 and origin session_replication_role$/);
        assert.deepEqual(protocol.state(),before,mode+' changed simulated rows/marker');
        assert.deepEqual(readdirSync(directory),files,mode+' published a journal');
        const gate = protocol.calls.findIndex(q=>q.includes("current_setting('server_version_num')"));
        assert.ok(gate>=0);
        assert.equal(protocol.calls[gate].replace(/\s+/g,' '),'SELECT '+predicate+' AS ok');
        assert.equal(protocol.calls.length,gate+1,'No catalog/business read or DML after refused environment');
        const lock = protocol.calls.findIndex(q=>q.startsWith('LOCK TABLE'));
        if (['rehearse','apply','repeat0','restoreRehearse','restore'].includes(mode)) {
          const firstRead = protocol.calls.findIndex(q=>q.startsWith('SELECT'));
          assert.ok(lock>=0 && firstRead>lock && gate>lock);
          assert.ok(protocol.calls[lock].includes('o3_executor.commits'));
          assert.ok(protocol.calls.slice(0,lock).every(q=>q.startsWith('SET LOCAL')));
        } else assert.equal(lock,-1);
      }
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
});

test('runtime keeps exactly the shipped PG17 version interval', async () => {
  const protocol=executorProtocol(); const adapter=new O3Executor(protocol.sql);
  for(const version of [170000,170011,179999]) {
    protocol.setEnvironment({version,origin:true});
    assert.equal((await adapter.preview()).status,'READY');
  }
});

test('concurrency failure diagnostics retain only fixed context, validated code/class and source line', () => {
  const source=readFileSync(new URL('./concurrency.postgres.integration.ts',import.meta.url),'utf8');
  const functions=source.slice(source.indexOf('function sqlstate('),source.indexOf('function barrier('));
  const compiled=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const output:string[]=[];
  const helpers=runInNewContext(compiled+'\n({sqlstate,diagnostic})',{
    assert,Error,phase:'writer-commit',currentAction:'apply',currentAttack:'cascade-reference',
    console:{error:(line:string)=>output.push(line)},
  });
  const privateText='DO_NOT_EMIT_RAW_NOTES_URL_OR_QUERY_PARAMETERS';
  const error=Object.assign(new Error(privateText),{code:'23514',detail:privateText,query:privateText});
  error.stack='Error: '+privateText+'\n    at writer (/fixture/scripts/o3-model-only/concurrency.postgres.integration.ts:54:7)';
  helpers.diagnostic(error);
  assert.deepEqual(JSON.parse(output[0]),{suite:'concurrency',status:'FAIL',phase:'writer-commit',action:'apply',
    attack:'cascade-reference',code:'23514',errorClass:'ERROR',sourceLine:54});
  assert.ok(!output.join('').includes(privateText));
  assert.equal(helpers.sqlstate(Object.assign(new Error(privateText),{code:privateText})),undefined);
  assert.equal(helpers.sqlstate(new Error('PostgreSQL operation refused; SQLSTATE 55P03')),'55P03');
});
