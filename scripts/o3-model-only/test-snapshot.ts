/** Synthetic fixtures only. Raw rows remain in memory; never print/hash this result. */
import { readFileSync } from 'node:fs';
import type { Sql } from 'postgres';
import { canonical } from './exact';
const ddl = readFileSync(new URL('./fixtures/supported-public-schema.sql', import.meta.url), 'utf8');
const tables = [...ddl.matchAll(/CREATE TABLE public\."([a-z0-9_]+)"/g)].map(m => m[1]).sort();
export async function testSnapshot(sql: Sql) {
  const rows = await sql.unsafe(tables.map(table => `SELECT '${table}' AS table_name,to_jsonb(t)::text AS row,
    ctid::text AS tuple,xmin::text AS version FROM public."${table}" t`).join('\nUNION ALL\n') + '\nORDER BY table_name,row,tuple');
  const marker = await sql`SELECT to_jsonb(c)::text AS row,ctid::text AS tuple,xmin::text AS version FROM o3_executor.commits c ORDER BY plan_digest`;
  const catalog = await sql`SELECT 'class' AS kind,(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[])::text AS value
    FROM pg_class c WHERE c.relnamespace IN ('public'::regnamespace,'o3_executor'::regnamespace)
    UNION ALL SELECT 'attribute',to_jsonb(a)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.relnamespace IN ('public'::regnamespace,'o3_executor'::regnamespace)
    UNION ALL SELECT 'constraint',to_jsonb(k)::text FROM pg_constraint k WHERE k.connamespace IN ('public'::regnamespace,'o3_executor'::regnamespace)
    UNION ALL SELECT 'index',to_jsonb(i)::text FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
      WHERE c.relnamespace IN ('public'::regnamespace,'o3_executor'::regnamespace)
    UNION ALL SELECT 'default',to_jsonb(d)::text FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid
      WHERE c.relnamespace IN ('public'::regnamespace,'o3_executor'::regnamespace)
    ORDER BY kind,value`;
  return canonical({ rows, marker, catalog });
}
