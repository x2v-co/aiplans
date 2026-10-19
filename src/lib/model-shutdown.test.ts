import assert from 'node:assert/strict';
import test from 'node:test';
import { modelShutdownNotice, modelLifecycleStatus } from './model-shutdown';

test('retires on the announced UTC day', () => {
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-14T00:00Z'))?.status, 'retiring');
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-23T23:59:59Z'))?.status, 'retired');
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-24T00:00Z'))?.status, 'retired');
});

test('formats the date without locale or host timezone shifting it', () => {
  assert.equal(modelShutdownNotice('2027-01-14', 'en')?.date, 'January 14, 2027');
  assert.equal(modelShutdownNotice('2027-01-14', 'zh')?.date, '2027年1月14日');
});

test('models with no date or an invalid date have no notice', () => {
  for (const value of [null, undefined, '', '2026-02-30', 'garbage', '2026-10-23T00:00Z']) {
    assert.equal(modelShutdownNotice(value, 'en'), null);
  }
});

test('status is derived without a stored enum', () => {
  const now = new Date('2026-10-15T00:00Z');
  assert.equal(modelLifecycleStatus(null, now), 'active');
  assert.equal(modelLifecycleStatus('2026-10-23', now), 'retiring');
  assert.equal(modelLifecycleStatus('2026-07-23', now), 'retired');
  assert.equal(modelLifecycleStatus('2026-10-15', now), 'retired');
});

test('shutdownReached: on and after the UTC shutdown day, for catalog strings and DB Date values', async () => {
  const { shutdownReached, shutdownDay } = await import('./model-shutdown');
  assert.equal(shutdownReached('2026-11-30', new Date('2026-11-29T23:59:59Z')), false);
  assert.equal(shutdownReached('2026-11-30', new Date('2026-11-30T00:00:00Z')), true);
  assert.equal(shutdownReached(new Date('2026-11-30T00:00:00Z'), new Date('2026-12-01T00:00:00Z')), true);
  // 2026-11-30 08:00 in Singapore is still 11-30 00:00 UTC; 2026-11-30 07:59 SGT is 11-29 UTC.
  assert.equal(shutdownReached('2026-11-30', new Date('2026-11-30T07:59:00+08:00')), false);
  for (const value of [null, undefined, '', '2026-02-30', 'garbage', '2026-10-23T00:00Z']) {
    assert.equal(shutdownReached(value, new Date('2030-01-01T00:00Z')), false);
    assert.equal(shutdownDay(value), null);
  }
});
