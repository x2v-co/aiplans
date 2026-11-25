import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicSnapshot } from './api-pricing-snapshot';

const options = { ttlMs: 100, maxBytes: 64, failureCooldownMs: 10 };
const drain = () => new Promise(resolve => setImmediate(resolve));

test('single slot shares cold/expired loads; lifetime starts before loading, not at completion', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let loads = 0;
  let release!: (value: { revision: number }) => void;
  const read = createPublicSnapshot<{ revision: number }>(() => { loads++; return new Promise(resolve => { release = resolve; }); }, options);
  const first = Array.from({ length: 16 }, read);
  await drain(); assert.equal(loads, 1);
  t.mock.timers.tick(20); release({ revision: 1 }); await Promise.all(first);
  t.mock.timers.tick(79); assert.deepEqual(await read(), { revision: 1 }); assert.equal(loads, 1);
  t.mock.timers.tick(1);
  const second = Array.from({ length: 16 }, read);
  await drain(); assert.equal(loads, 2);
  release({ revision: 2 }); assert.ok((await Promise.all(second)).every(v => v.revision === 2));
});

test('serialized UTF-8 size cap admits the boundary, rejects oversize data and clears failed in-flight state', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let loads = 0, value = '界'.repeat(20); // 62 JSON UTF-8 bytes, including quotes.
  const read = createPublicSnapshot(async () => { loads++; return value; }, { ...options, maxBytes: 62 });
  assert.equal(await read(), value); assert.equal(await read(), value); assert.equal(loads, 1);
  t.mock.timers.tick(100); value += '界';
  const failed = await Promise.allSettled(Array.from({ length: 16 }, read));
  assert.ok(failed.every(v => v.status === 'rejected')); assert.equal(loads, 2);
  value = 'recovered'; await assert.rejects(read()); assert.equal(loads, 2);
  t.mock.timers.tick(10); assert.equal(await read(), value); assert.equal(loads, 3);
});

test('slow loads time out callers at TTL, never overlap replacements, reject late data and recover after settlement', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let loads = 0;
  let release!: (value: string) => void;
  const read = createPublicSnapshot<string>(() => { loads++; return new Promise(resolve => { release = resolve; }); }, options);
  const first = read(), second = read();
  const settled = Promise.allSettled([first, second]);
  await drain(); assert.equal(loads, 1);
  t.mock.timers.tick(100);
  assert.ok((await settled).every(v => v.status === 'rejected'));
  t.mock.timers.tick(1000);
  await assert.rejects(read()); assert.equal(loads, 1); // Still blocked by the original backend operation.
  release('too old'); await drain();
  await assert.rejects(read()); assert.equal(loads, 1);
  t.mock.timers.tick(10); const retry = read(); await drain(); assert.equal(loads, 2);
  release('fresh'); assert.equal(await retry, 'fresh');
});

test('synchronous throws are coalesced with bounded failure cooldown and no stale-on-error', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let loads = 0, failing = false;
  const read = createPublicSnapshot(() => { loads++; if (failing) throw Error('backend'); return Promise.resolve('public'); }, options);
  assert.equal(await read(), 'public'); failing = true; t.mock.timers.tick(100);
  assert.ok((await Promise.allSettled(Array.from({ length: 16 }, read))).every(v => v.status === 'rejected'));
  assert.equal(loads, 2);
  await assert.rejects(read()); assert.equal(loads, 2);
  failing = false; t.mock.timers.tick(10); assert.equal(await read(), 'public'); assert.equal(loads, 3);
});
