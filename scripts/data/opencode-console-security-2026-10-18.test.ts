import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  OPENCODE_SECURITY_NOTE, OPENCODE_SECURITY_SOURCE, opencodeSecurityOptions, seedOpenCodeConsoleSecurity,
} from './opencode-console-security-2026-10-18';

type Row = Record<string, unknown> & { id: number };
function fixture(providers: Row[]) {
  const data = structuredClone(providers);
  let writes = 0;
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q === 'SELECT * FROM providers WHERE slug = ?') {
      return Promise.resolve(data.filter(r => r.slug === values[0]));
    }
    if (q === 'UPDATE providers SET ? WHERE id = ?') {
      writes++;
      Object.assign(data.find(r => r.id === values[1])!, frag(values[0]));
      return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql;
  return { tx, data, writes: () => writes };
}

test('appends security note to Zen and Go; skips missing; dry-run writes nothing; idempotent', async () => {
  const f = fixture([
    { id: 1, slug: 'opencode-zen', notes: 'Console credits note' },
    { id: 2, slug: 'opencode-go', notes: null },
  ]);
  const dry = await seedOpenCodeConsoleSecurity(f.tx, false);
  assert.equal(dry.length, 2);
  assert.equal(f.writes(), 0);
  await seedOpenCodeConsoleSecurity(f.tx, true);
  assert.match(String(f.data[0].notes), /1\.4%/);
  assert.match(String(f.data[0].notes), /Console BYOK/);
  assert.match(String(f.data[1].notes), new RegExp(OPENCODE_SECURITY_SOURCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(await seedOpenCodeConsoleSecurity(f.tx, true), []);
  assert.equal(f.writes(), 2);
});

test('empty catalog is a no-op; cli options', async () => {
  assert.deepEqual(await seedOpenCodeConsoleSecurity(fixture([]).tx, true), []);
  assert.match(OPENCODE_SECURITY_NOTE, /open-source CLI/);
  assert.equal(opencodeSecurityOptions(['--apply']).apply, true);
  assert.throws(() => opencodeSecurityOptions(['--apply', '--dry-run']));
});
