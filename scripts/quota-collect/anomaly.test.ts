import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyMeasurements, detectAnomalies, type DailyMeasurement } from './anomaly';
import type { WindowSummary } from './summary';

const measurement = (day: string, tokensPerPct: number, overrides: Partial<DailyMeasurement> = {}): DailyMeasurement => ({
  day, tokensPerPct, planSlug: 'chatgpt-pro', collector: 'codex-log', accountLabel: 'paid-a',
  window: '5h', limitId: 'codex', model: 'gpt-5-codex', ...overrides,
});

test('flags strictly greater than 25% drop against prior seven calendar days median', () => {
  const baseline = [100, 100, 100, 900, 100, 100, 100].map((value, i) => measurement(`2026-01-0${i + 1}`, value));
  assert.equal(detectAnomalies([...baseline, measurement('2026-01-08', 75)]).length, 0);
  const [anomaly] = detectAnomalies([...baseline, measurement('2026-01-08', 74)]);
  assert.equal(anomaly.day, '2026-01-08');
  assert.equal(anomaly.trailingMedian, 100);
  assert.equal(anomaly.baselineDays, 7);
  assert.equal(anomaly.dropPct, 26);
});

test('excludes today, future, stale days and other plan/model/account/meter cohorts', () => {
  const baseline = measurement('2026-01-01', 100);
  assert.deepEqual(detectAnomalies([baseline, measurement('2026-01-09', 1)]), []);
  for (const overrides of [
    { planSlug: 'chatgpt-plus' }, { model: 'another-model' }, { accountLabel: 'paid-b' },
    { window: 'weekly' as const }, { limitId: 'other-pool' }, { collector: 'ccusage' },
  ]) assert.deepEqual(detectAnomalies([baseline, measurement('2026-01-02', 1, overrides)]), []);
  assert.deepEqual(detectAnomalies([measurement('2026-01-02', 1000), measurement('2026-01-01', 1)]), []);
});

test('sparse even-sized history uses arithmetic median and reports baseline count', () => {
  const [anomaly] = detectAnomalies([measurement('2026-01-01', 100), measurement('2026-01-03', 200), measurement('2026-01-05', 100)]);
  assert.equal(anomaly.trailingMedian, 150);
  assert.equal(anomaly.baselineDays, 2);
});

test('combines same-day windows with percentage weights, then compares days once', () => {
  const window = (deltaPct: number, tokensPerPct: number, day = '2026-01-01') => ({
    ...measurement(day, tokensPerPct), deltaPct,
  }) as WindowSummary;
  const days = dailyMeasurements([window(10, 100), window(30, 200), window(10, 100, '2026-01-02')]);
  assert.equal(days.length, 2);
  assert.equal(days[0].tokensPerPct, 175);
  assert.equal(detectAnomalies(days).length, 1);
});

test('refuses duplicate days or invalid denominators rather than biasing the baseline', () => {
  const row = measurement('2026-01-01', 100);
  assert.throws(() => detectAnomalies([row, row]), /one measurement/);
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => detectAnomalies([measurement('2026-01-01', value)]), /positive and finite/);
});
