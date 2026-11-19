import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Sql } from 'postgres';
import { publicGates, PUBLIC_URLS } from './public-gates';

test('runtime URL allowlist and opaque quota predicate match the shipped fresh SQL', () => {
  const fresh = readFileSync(new URL('./sre-readonly-check.sql', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('./public-gates.ts', import.meta.url), 'utf8');
  const lists = [...fresh.matchAll(/IN \(('https:[^\n]*?)\)/g)].map(m => [...m[1].matchAll(/'([^']+)'/g)].map(v => v[1]));
  assert.equal(lists.length, 3);
  for (const list of lists) assert.deepEqual(list, PUBLIC_URLS);
  const predicate = (text: string) => text.match(/WITH scoped AS \([\s\S]*? AS (?:quota_rows_ok|ok)/)?.[0]
    .replace(/ AS (quota_rows_ok|ok)$/, '').replace(/\s+/g, ' ');
  assert.ok(predicate(runtime)); assert.equal(predicate(runtime), predicate(fresh));
  assert.doesNotMatch(runtime, /#>>/);
});

test('hard gates emit only fixed failures and inspect all model/channel temporal fields before projections', async () => {
  for (let failing = 0; failing < 5; failing++) {
    const calls: string[] = [];
    const query = async (q: string) => { calls.push(q); return [{ ok: calls.length !== failing + 1 }]; };
    const tx = Object.assign((parts: TemplateStringsArray) => query(parts.join('?')), { unsafe: query }) as unknown as Sql;
    await assert.rejects(publicGates(tx, false), /gate refused|finite AD|Quota precondition conflict/);
    assert.equal(calls.length, failing + 1);
    assert.ok(calls.every(q => / AS ok\b/.test(q) && !/^SELECT\s+(?:\*|id,|to_char)/i.test(q)));
    if (calls.length >= 3) {
      for (const field of ['released_at','created_at','updated_at','shutdown_date','deprecated_at']) {
        assert.ok(calls[2].includes('isfinite("' + field + '")'));
      }
    }
  }
});
