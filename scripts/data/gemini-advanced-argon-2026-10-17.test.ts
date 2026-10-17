import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { advancedArgonSeedOptions, seedAdvancedArgon } from './gemini-advanced-argon-2026-10-17';

type Row = Record<string, unknown> & { id: number };
const liveSelector = { exclude: ['gemini-pro', 'gemini-flash', '*-preview*', 'gemini-4-argon'], families: ['gemini'] };

function fixture(plans: Row[], providers: Row[] = [{ id: 7, slug: 'google', type: 'producer' }]) {
  const data = { providers, plans: structuredClone(plans) };
  const updates: Array<{ values: unknown[] }> = [];
  const tx = (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === "SELECT id, type FROM providers WHERE slug = 'google'") return Promise.resolve(data.providers.filter(r => r.slug === 'google'));
    if (query === 'SELECT id, model_selector FROM plans WHERE provider_id = ? AND slug = ?') {
      return Promise.resolve(structuredClone(data.plans.filter(r => r.provider_id === values[0] && r.slug === values[1])));
    }
    assert.equal(query, 'UPDATE plans SET model_selector = ?, updated_at = ? WHERE id = ?');
    updates.push({ values });
    const row = data.plans.find(r => r.id === values[2])!;
    row.model_selector = (values[0] as { json: unknown }).json;
    return Promise.resolve([]);
  };
  const sql = Object.assign(tx, { json: (json: unknown) => ({ json }) }) as unknown as Sql;
  return { data, sql, updates };
}

const plans: Row[] = [
  { id: 1963, provider_id: 7, slug: 'gemini-advanced', model_selector: liveSelector, notes: 'keep' },
  { id: 21, provider_id: 7, slug: 'gemini-free', model_selector: { exclude: ['gemini-4-argon'] } },
  { id: 24, provider_id: 8, slug: 'gemini-advanced', model_selector: { exclude: ['gemini-4-argon'] } },
];

test('dry-run previews only the Argon exclusion removal on google/gemini-advanced and writes nothing', async () => {
  const f = fixture(plans);
  const steps = await seedAdvancedArgon(f.sql, false);
  assert.equal(f.updates.length, 0);
  assert.deepEqual(steps, [{ table: 'plans', target: 'google/gemini-advanced', id: 1963, action: 'update',
    changes: { model_selector: { from: liveSelector,
      to: { exclude: ['gemini-pro', 'gemini-flash', '*-preview*'], families: ['gemini'] } } } }]);
});

test('apply writes only that selector; other plans and fields untouched; rerun is a no-op', async () => {
  const f = fixture(plans);
  await seedAdvancedArgon(f.sql, true);
  assert.equal(f.updates.length, 1);
  assert.deepEqual(f.data.plans[0].model_selector, { exclude: ['gemini-pro', 'gemini-flash', '*-preview*'], families: ['gemini'] });
  assert.equal(f.data.plans[0].notes, 'keep');
  assert.deepEqual(f.data.plans[1].model_selector, { exclude: ['gemini-4-argon'] });
  assert.deepEqual(f.data.plans[2].model_selector, { exclude: ['gemini-4-argon'] });
  assert.deepEqual(await seedAdvancedArgon(f.sql, true), []);
  assert.equal(f.updates.length, 1);
});

test('missing or duplicate gemini-advanced row fails loudly instead of skipping', async () => {
  await assert.rejects(seedAdvancedArgon(fixture(plans.slice(1, 2)).sql), /found 0; nothing written/);
  await assert.rejects(seedAdvancedArgon(fixture([plans[0], { ...plans[0], id: 99 }]).sql), /found 2; nothing written/);
  await assert.rejects(seedAdvancedArgon(fixture(plans, []).sql), /google provider, found 0/);
});

test('cli options', () => {
  assert.deepEqual(advancedArgonSeedOptions([]), { apply: false });
  assert.deepEqual(advancedArgonSeedOptions(['--apply']), { apply: true });
  assert.throws(() => advancedArgonSeedOptions(['--apply', '--dry-run']));
  assert.throws(() => advancedArgonSeedOptions(['--x']));
});
