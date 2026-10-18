import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  DISPLAY_MODELS, flash1017DisplayOptions, seedDeepSeekFlash1017Display,
} from './deepseek-flash-1017-display-2026-10-18';

type Row = Record<string, unknown> & { id: number };
function fixture(models: Row[]) {
  const data = structuredClone(models);
  let writes = 0;
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT * FROM models WHERE slug IN')) {
      const wanted = new Set(frag(values[0]) as string[]);
      return Promise.resolve(data.filter(r => wanted.has(String(r.slug))));
    }
    if (q === 'UPDATE models SET ? WHERE id = ?') {
      writes++;
      Object.assign(data.find(r => r.id === values[1])!, frag(values[0]));
      return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql;
  return { tx, data, writes: () => writes };
}

test('updates both Flash identities to mark 1017; dry-run writes nothing; idempotent', async () => {
  const f = fixture([
    { id: 1, slug: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    { id: 2, slug: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
  ]);
  const dry = await seedDeepSeekFlash1017Display(f.tx, false);
  assert.equal(dry.length, 2);
  assert.equal(f.writes(), 0);
  await seedDeepSeekFlash1017Display(f.tx, true);
  assert.match(String(f.data[0].name), /legacy slug.*1017/);
  assert.match(String(f.data[1].name), /1017/);
  assert.match(String(f.data[0].description), /DeepSeek-V4\.1-Flash-1017/);
  assert.deepEqual(await seedDeepSeekFlash1017Display(f.tx, true), []);
});

test('refuses missing or ambiguous models; cli options', async () => {
  await assert.rejects(seedDeepSeekFlash1017Display(fixture([]).tx), /Missing catalog model/);
  await assert.rejects(
    seedDeepSeekFlash1017Display(fixture([
      { id: 9, slug: 'deepseek-v4-flash' },
      { id: 1, slug: 'deepseek-v4.1-flash' }, { id: 2, slug: 'deepseek-v4-1-flash' },
    ]).tx),
    /Ambiguous/,
  );
  assert.equal(flash1017DisplayOptions([]).apply, false);
  assert.throws(() => flash1017DisplayOptions(['--apply', '--dry-run']));
  assert.equal(DISPLAY_MODELS.length, 2);
});
