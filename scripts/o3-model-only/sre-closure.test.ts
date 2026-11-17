import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('readonly snapshot excludes only six pg_class maintenance stats and preserves structure and rows', () => {
  const harness = readFileSync(new URL('./sre-closure.postgres.integration.ts', import.meta.url), 'utf8');
  const catalog = harness.match(/const catalog = await sql`([^`]+)`;/)?.[1];
  assert.equal(catalog, `SELECT 'class' AS kind,(to_jsonb(c) - ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[])::text AS value FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'attribute',to_jsonb(a)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'constraint',to_jsonb(k)::text FROM pg_constraint k WHERE k.connamespace='public'::regnamespace
    UNION ALL SELECT 'index',to_jsonb(i)::text FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace
    UNION ALL SELECT 'default',to_jsonb(d)::text FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='public'::regnamespace
    ORDER BY kind,value`);
  const rows = harness.match(/const rows = await sql\.unsafe\(`([^`]+)`\);/)?.[1];
  assert.ok(rows);
  assert.ok(rows.split('\nUNION ALL\n').every(part => /^\s*SELECT '[a-z0-9_]+' AS table_name,to_jsonb\(t\)::text AS row FROM public\."[a-z0-9_]+" t(?:\nORDER BY table_name,row)?$/.test(part)));
  assert.ok(harness.includes('return canonical({ rows, catalog });'));
  assert.ok(harness.includes("assert.equal(await snapshot(), before, 'readonly row/schema snapshot');"));
  assert.ok(harness.includes("if (restoredCatalog) assert.equal(restored, original, 'fixture restored');"));
});

test('negative temporal fixtures bind text before PostgreSQL temporal casts', () => {
  const harness = readFileSync(new URL('./sre-closure.postgres.integration.ts', import.meta.url), 'utf8');
  assert.ok(harness.includes("await reject('timestamp-'+i, 'metadata_domains', () => sql`UPDATE public.models SET created_at=${value}::text::timestamptz WHERE id=3014`"));
  assert.ok(harness.includes("await reject('date-'+i, 'metadata_domains', () => sql`UPDATE public.models SET shutdown_date=${value}::text::date WHERE id=3192`"));
});

for (const [file, gates] of [
  ['sre-readonly-check.sql', ['environment','structure','pair','quota_rows','mixes','identity','urls','metadata_domains']],
  ['sre-readonly-closure.sql', ['environment','structure','pair','quota_rows','mixes','metadata']],
] as const) {
  test(file + ' rejects with completed rollback and code-only nonzero psql receipt', () => {
    const sql = readFileSync(new URL('./' + file, import.meta.url), 'utf8');
    assert.match(sql, /^\\set ON_ERROR_STOP on$/m);
    assert.match(sql, /^\\set VERBOSITY sqlstate$/m);
    assert.match(sql, /^\\set SHOW_CONTEXT never$/m);
    assert.doesNotMatch(sql, /\\quit\b/);
    const rejects = [...sql.matchAll(/\\if :o3_([a-z_]+)_ok\n\\else\n([\s\S]*?)\\endif/g)];
    assert.deepEqual(rejects.map(m => m[1]), gates);
    for (const [, gate, body] of rejects) {
      assert.equal(body, '  ROLLBACK;\n  \\echo O3_REJECT_' + gate + '_ROLLED_BACK\n  SELECT 1 / 0;\n');
    }
    assert.ok(!/^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|DO|COPY)\b/im.test(sql), 'No write statements');
    assert.ok(!/\b(?:prosrc|proconfig|pg_get_functiondef)\b/i.test(sql), 'No function body export');
    assert.match(sql, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  });
}
test('fresh check preserves copied checks and outputs exactly58 field classifications', () => {
  const fresh = readFileSync(new URL('./sre-readonly-check.sql', import.meta.url), 'utf8');
  const legacy = readFileSync(new URL('./sre-readonly-closure.sql', import.meta.url), 'utf8');
  assert.ok(fresh.split('-- Fresh metadata eligibility only;')[0] === legacy.split('-- Historical baseline only.')[0], 'Copied checks preserved');
  const labels = [...fresh.matchAll(/SELECT '(model(?:3014|3192)\.[^']+)' AS object_label/g)].map(m => m[1]);
  assert.equal(labels.length, 58); assert.equal(new Set(labels).size, 58);
  assert.doesNotMatch(fresh, /not_prelisted_stop|matches_prelisted|length\s*\(|cardinality\s*\(/i);
  assert.match(fresh, /ROLLBACK;\nSELECT 'READY_FOR_HOST_LOCAL_PUBLIC_METADATA_REVIEW_NOT_APPLY' AS result;/);
});
