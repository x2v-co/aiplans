import assert from 'node:assert/strict';
import test from 'node:test';
import { modelShutdownNotice } from './model-shutdown';

test('uses scheduled copy through the announced day and removed copy after it', () => {
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-14T00:00Z'))?.status, 'scheduled');
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-23T23:59:59Z'))?.status, 'scheduled');
  assert.equal(modelShutdownNotice('2026-10-23', 'en', new Date('2026-10-24T00:00Z'))?.status, 'removed');
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
