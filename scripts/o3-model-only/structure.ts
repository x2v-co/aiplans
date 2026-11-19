import type { Sql } from 'postgres';
import profile from './fixtures/supported-affected-profile.json';
import { canonical, digest, invariant } from './exact';
export { profile };
export const TABLES = profile.tables;
const ROOTS = [...TABLES, ...profile.readTables];
// ON DELETE CASCADE issues a zero-row DELETE against this family. Statement
// triggers/rules/policies still matter even when the source reference count is zero.
const EFFECT_TABLES = [...TABLES,'model_plan_mapping'];
// Exact audited deparses for this constraint only; retain every cast and currency.
const SAVED_CURRENCY_CHECK = "CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'CNY'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'JPY'::character varying, 'KRW'::character varying, 'SGD'::character varying])::text[])))";
const PG17_CURRENCY_CHECK = "CHECK (((currency)::text = ANY (ARRAY[('USD'::character varying)::text, ('CNY'::character varying)::text, ('EUR'::character varying)::text, ('GBP'::character varying)::text, ('JPY'::character varying)::text, ('KRW'::character varying)::text, ('SGD'::character varying)::text])))";
export const identifier = (v: string) => '"' + v.replace(/"/g, '""') + '"';
export const qualified = (v: string) => 'public.' + identifier(v);
export class StructureConflict extends Error {
  constructor(readonly blockers: string[]) { super('Unsupported affected structure: ' + blockers.join('; ')); }
}
/** Compare evaluated structure, never evaluate/export default expressions or function bodies.
 * Unspecified defaults are outside the executable dependency graph: sparse UPDATE/DELETE,
 * and both INSERTs supply EVERY column. Authored defaults are fixture evidence only. */
export async function checkStructure(sql: Sql): Promise<string> {
  const blockers: string[] = [];
  const columns = await sql`SELECT c.relname AS "table",a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
    NOT a.attnotnull AS nullable,a.attidentity::text AS identity,a.attgenerated::text AS generated,
    coalesce(co.collname,'') AS collation,
    NOT a.attisdropped AND tn.nspname='pg_catalog' AND pi.pronamespace='pg_catalog'::regnamespace
      AND po.pronamespace='pg_catalog'::regnamespace AND t.typtype<>'d'
      AND (co.oid IS NULL OR co.collnamespace='pg_catalog'::regnamespace AND co.collisdeterministic) AS safe
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_type t ON t.oid=a.atttypid JOIN pg_namespace tn ON tn.oid=t.typnamespace
    JOIN pg_proc pi ON pi.oid=t.typinput JOIN pg_proc po ON po.oid=t.typoutput
    LEFT JOIN pg_collation co ON co.oid=a.attcollation
    WHERE n.nspname='public' AND c.relname=ANY(${ROOTS}::text[]) AND a.attnum>0 ORDER BY c.relname,a.attnum`;
  const constraints = await sql`SELECT c.relname AS "table",k.conname AS name,k.contype::text AS kind,
    pg_get_constraintdef(k.oid) AS definition,
    k.convalidated AND NOT k.condeferrable AND NOT k.condeferred AS safe
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(${TABLES}::text[]) ORDER BY c.relname,k.conname`;
  const indexes = await sql`SELECT c.relname AS "table",ic.relname AS name,pg_get_indexdef(i.indexrelid) AS definition,
    i.indisvalid AND i.indisready AND i.indislive AND am.amname='btree' AND am.amhandler='bthandler'::regproc
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      WHERE oc.opcnamespace<>'pg_catalog'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      JOIN pg_amproc ap ON ap.amprocfamily=oc.opcfamily JOIN pg_proc p ON p.oid=ap.amproc
      WHERE p.pronamespace<>'pg_catalog'::regnamespace)
    AND NOT EXISTS(SELECT 1 FROM unnest(i.indclass::oid[]) op(oid) JOIN pg_opclass oc ON oc.oid=op.oid
      JOIN pg_amop ao ON ao.amopfamily=oc.opcfamily JOIN pg_operator o ON o.oid=ao.amopopr
      JOIN pg_proc p ON p.oid=o.oprcode WHERE o.oprnamespace<>'pg_catalog'::regnamespace OR p.pronamespace<>'pg_catalog'::regnamespace)
      AS safe
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_am am ON am.oid=ic.relam
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(${ROOTS}::text[]) ORDER BY c.relname,ic.relname`;
  const incoming = await sql`SELECT c.relname AS "table",k.conname AS name,k.contype::text AS kind,
    pg_get_constraintdef(k.oid) AS definition,r.relname AS target,
    c.relnamespace='public'::regnamespace AND k.convalidated AND NOT k.condeferrable AND NOT k.condeferred
    AND NOT EXISTS(SELECT 1 FROM unnest(k.conpfeqop || k.conppeqop || k.conffeqop) ops(oid)
      JOIN pg_operator o ON o.oid=ops.oid JOIN pg_proc p ON p.oid=o.oprcode
      WHERE o.oprnamespace<>'pg_catalog'::regnamespace OR p.pronamespace<>'pg_catalog'::regnamespace) AS safe
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class r ON r.oid=k.confrelid
    WHERE k.contype='f' AND r.relnamespace='public'::regnamespace AND r.relname=ANY(${TABLES}::text[])
    ORDER BY c.relname,k.conname`;
  function compare(kind: string, actual: Record<string, unknown>[], expected: Record<string, unknown>[]) {
    for (const a of actual) {
      const e = expected.find(e => a.table === e.table && (a.name === e.name));
      if (!e || a.safe !== true || canonical(Object.fromEntries(Object.keys(e).map(k => [k, a[k]]))) !== canonical(e))
        blockers.push(`${kind} ${String(a.table)}.${String(a.name)} extra/unsafe/changed`);
    }
    for (const e of expected) if (!actual.some(a => a.table === e.table && a.name === e.name)) blockers.push(`${kind} ${e.table}.${e.name} missing`);
  }
  compare('column', columns.filter(c => TABLES.includes(c.table) || profile.readColumns.some(r => r.table === c.table && r.name === c.name)),
    [...profile.columns.map(({ authoredDefault: _, ...c }) => c), ...profile.readColumns]);
  compare('constraint', constraints.map(c => c.table === 'api_channel_prices'
    && c.name === 'channel_prices_currency_check' && c.definition === PG17_CURRENCY_CHECK
    ? { ...c, definition: SAVED_CURRENCY_CHECK } : c), profile.constraints);
  compare('index', indexes, [...profile.indexes,...profile.readIndexes]);
  compare('incoming FK', incoming, profile.incoming);
  const relations = await sql`SELECT c.relname AS name,
    c.relkind='r' AND c.relpersistence='p' AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND NOT c.relispartition
    AND NOT EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid)
    AND (c.relname<>ALL(${EFFECT_TABLES}::text[]) OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=c.oid AND (NOT tgisinternal OR tgfoid NOT IN
      (SELECT oid FROM pg_proc WHERE pronamespace='pg_catalog'::regnamespace AND proname LIKE 'RI_FKey_%'))))
    AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid)
    AND NOT EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=c.oid) AS safe
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(${ROOTS}::text[])`;
  for (const table of ROOTS) if (!relations.some(r => r.name === table && r.safe)) blockers.push(`relation ${table} missing/trigger/policy/rule/inheritance drift`);
  // Roots exclude pg_attrdef: no default is evaluated by this executor. Constraints/indexes
  // include builtin operators and their dependencies, and type I/O was checked above.
  const [effects] = await sql`WITH RECURSIVE roots(classid,objid) AS (
    SELECT 'pg_constraint'::regclass::oid,k.oid FROM pg_constraint k
      WHERE k.conrelid=ANY(SELECT c.oid FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(${TABLES}::text[]))
    UNION SELECT 'pg_class'::regclass::oid,i.indexrelid FROM pg_index i
      WHERE i.indrelid=ANY(SELECT c.oid FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(${ROOTS}::text[]))
    ), deps(classid,objid) AS (SELECT * FROM roots UNION
      SELECT d.refclassid,d.refobjid FROM deps x JOIN pg_depend d ON d.classid=x.classid AND d.objid=x.objid
      WHERE d.refclassid<>'pg_attrdef'::regclass AND d.refclassid<>'pg_class'::regclass)
    SELECT NOT EXISTS(SELECT 1 FROM deps x JOIN pg_proc p ON x.classid='pg_proc'::regclass AND x.objid=p.oid
      WHERE p.pronamespace<>'pg_catalog'::regnamespace) AS safe`;
  if (!effects.safe) blockers.push('affected constraint/index dependency reaches nonbuiltin function');
  if (blockers.length) throw new StructureConflict(blockers);
  return digest({ version: profile.version, columns: profile.columns.map(({ authoredDefault: _, ...c }) => c),
    constraints: profile.constraints, indexes: profile.indexes, incoming: profile.incoming,
    readColumns: profile.readColumns, readIndexes: profile.readIndexes, effectTables: EFFECT_TABLES,
    defaults: 'never evaluated; both INSERTs enumerate all columns' });
}
export async function checkMarker(sql: Sql) {
  const [r] = await sql`SELECT to_regclass('o3_executor.commits') IS NOT NULL AS present`;
  invariant(r.present, 'Explicit bootstrapO3()/bootstrap.sql is required before execution');
  const cols = await sql`SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull
    FROM pg_attribute a WHERE a.attrelid='o3_executor.commits'::regclass AND a.attnum>0 ORDER BY a.attnum`;
  invariant(canonical(cols.map(r => [r.attname,r.type,r.attnotnull])) === canonical([
    ['plan_digest','text',true],['journal_hash','text',true],['phase','text',true],['post_state','jsonb',true]]), 'Commit marker columns drift');
  const [safe] = await sql`SELECT
    (SELECT count(*)=1 FROM pg_class WHERE relnamespace='o3_executor'::regnamespace AND relkind='r')
    AND (SELECT count(*)=2 AND bool_and(convalidated AND NOT condeferrable AND
      (contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (plan_digest)' OR contype='c' AND
      pg_get_constraintdef(oid)=$$CHECK ((phase = ANY (ARRAY['APPLIED'::text, 'RESTORED'::text])))$$))
      FROM pg_constraint WHERE conrelid='o3_executor.commits'::regclass)
    AND (SELECT count(*)=1 AND bool_and(pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX commits_pkey ON o3_executor.commits USING btree (plan_digest)' AND indisvalid AND indisready)
      FROM pg_index WHERE indrelid='o3_executor.commits'::regclass)
    AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='o3_executor.commits'::regclass)
    AND NOT EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='o3_executor.commits'::regclass)
    AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='o3_executor.commits'::regclass)
    AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='o3_executor.commits'::regclass AND attnum>0 AND (attidentity<>'' OR attgenerated<>'' OR atthasdef OR attisdropped))
    AND (SELECT relkind='r' AND relpersistence='p' AND NOT relrowsecurity AND NOT relforcerowsecurity AND NOT relispartition
      FROM pg_class WHERE oid='o3_executor.commits'::regclass) AS ok`;
  invariant(safe.ok, 'Commit marker constraints/index/effects drift');
}
