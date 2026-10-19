import assert from 'node:assert/strict';
import test from 'node:test';
import { diffRow, parseSeedArgs, sameValue } from './seed-diff';

test('parseSeedArgs: default dry-run, --slug forms', () => {
  assert.deepEqual(parseSeedArgs(['node', 'x']), { apply: false, slugs: null, syncAvailability: false });
  const a = parseSeedArgs(['node', 'x', '--slug', 'a,b', '--slug=c', '--apply']);
  assert.equal(a.apply, true);
  assert.deepEqual([...a.slugs!], ['a', 'b', 'c']);
});

test('diffRow: numeric strings, dates, json key order are not changes', () => {
  const existing = { price: '0.07', last_verified: '2026-10-15T00:00:00.000Z', constraints_json: { b: 1, a: 2 }, updated_at: 'x' };
  const { changes } = diffRow(existing, { price: 0.07, last_verified: new Date('2026-10-15'), constraints_json: { a: 2, b: 1 }, updated_at: new Date() });
  assert.deepEqual(changes, []);
  assert.equal(sameValue('constraints_json', '{"a":1}', { a: 1 }), true);
});

test('diffRow: last_verified never moves backwards; is_available insert-only by default', () => {
  const existing = { last_verified: '2026-10-17', is_available: false };
  assert.deepEqual(diffRow(existing, { last_verified: new Date('2026-10-01'), is_available: true }).changes, []);
  const fwd = diffRow(existing, { last_verified: new Date('2026-10-18') });
  assert.deepEqual(Object.keys(fwd.patch), ['last_verified']);
  assert.deepEqual(Object.keys(diffRow(existing, { is_available: true }, { syncAvailability: true }).patch), ['is_available']);
  assert.deepEqual(diffRow({ is_available: true }, { is_available: false }, { retireAvailability: true }).patch, { is_available: false });
  assert.deepEqual(diffRow({ is_available: false }, { is_available: false }, { retireAvailability: true }).changes, []);
  assert.deepEqual(diffRow({ is_available: false }, { is_available: true }, { retireAvailability: true }).changes, []);
});
