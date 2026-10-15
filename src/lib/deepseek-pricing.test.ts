import assert from 'node:assert/strict';
import test from 'node:test';
import { DEEPSEEK_MODELS, deepseekPricingWindow, reconcileDeepSeekObservation, scaleDeepSeekRate, deepseekObservations } from './deepseek-pricing';

test('UTC weekday windows use inclusive starts and exclusive ends', () => {
  for (const day of ['2026-10-12', '2026-10-16']) {
    for (const [time, expected] of [
      ['00:59:59.999', 'off-peak'], ['01:00:00', 'peak'], ['03:59:59.999', 'peak'], ['04:00:00', 'off-peak'],
      ['05:59:59.999', 'off-peak'], ['06:00:00', 'peak'], ['09:59:59.999', 'peak'], ['10:00:00', 'off-peak'],
      ['23:59:59.999', 'off-peak'],
    ]) assert.equal(deepseekPricingWindow(new Date(`${day}T${time}Z`)), expected, `${day} ${time}`);
  }
  for (const day of ['2026-10-17', '2026-10-18']) {
    for (const hour of ['02', '07']) assert.equal(deepseekPricingWindow(new Date(`${day}T${hour}:00:00Z`)), 'off-peak');
  }
  assert.equal(deepseekPricingWindow(new Date('2026-10-19T01:00:00Z')), 'peak');
  assert.equal(deepseekPricingWindow(new Date('2026-10-16T23:00:00-08:00')), 'off-peak');
  assert.equal(deepseekPricingWindow(new Date('2026-10-12T09:00:00+08:00')), 'peak');
  assert.equal(deepseekPricingWindow(new Date('2026-10-12T02:00:00Z'), ['2026-10-12']), 'off-peak');
  assert.equal(deepseekPricingWindow(new Date('2026-10-12T02:00:00Z')), 'peak');
  assert.throws(() => deepseekPricingWindow(new Date('invalid')));
});

test('both official models retain peak list on half-price observations, even across a delayed window switch', () => {
  for (const { peak } of DEEPSEEK_MODELS) {
    const off = scaleDeepSeekRate(peak, 0.5);
    for (const date of [new Date('2026-10-12T02:00:00Z'), new Date('2026-10-12T12:00:00Z')]) {
      const result = reconcileDeepSeekObservation(off, date, {}, peak, peak);
      assert.equal(result.windowOnly, true);
      const rounded = { ...off, output: off.output * (1 + 5e-8) };
      assert.equal(reconcileDeepSeekObservation(rounded, date, {}, peak, peak).windowOnly, true);
      assert.equal(result.window, 'off-peak');
      assert.deepEqual(result.listRate, peak);
      assert.deepEqual(result.observations['off-peak'], { ...off, observed_at: date.toISOString() });
    }
  }
});

test('StreamLake learns only observed rates, preserves both windows, and retains genuine changes', () => {
  // Synthetic rates for the normalization algorithm, not published StreamLake facts.
  const off = { input: 3, output: 6, cache: 1 };
  const peak = scaleDeepSeekRate(off, 2);
  const first = reconcileDeepSeekObservation(off, new Date('2026-10-12T12:00Z'));
  assert.deepEqual(first.listRate, off); // no manufactured peak
  const second = reconcileDeepSeekObservation(peak, new Date('2026-10-13T02:00Z'), first.observations, off);
  assert.equal(second.windowOnly, true);
  assert.deepEqual(second.listRate, peak);
  const third = reconcileDeepSeekObservation(off, new Date('2026-10-13T12:00Z'), second.observations, peak);
  assert.equal(third.windowOnly, true);
  assert.deepEqual(third.listRate, peak);
  assert.deepEqual(Object.keys(third.observations).sort(), ['off-peak', 'peak']);
  for (const changed of [{ ...off, output: 7 }, { ...off, cache: 0.8 }, { input: 4, output: 8, cache: 1 }]) {
    assert.equal(reconcileDeepSeekObservation(changed, new Date('2026-10-14T12:00Z'), third.observations, peak).windowOnly, false);
  }
  assert.equal(reconcileDeepSeekObservation(off, new Date('2026-10-14T12:00Z'), {}, peak).windowOnly, true);
  assert.equal(reconcileDeepSeekObservation(peak, new Date('2026-10-14T02:00Z'), {}, off).windowOnly, true);
  assert.deepEqual(deepseekObservations(null), {});
  assert.deepEqual(deepseekObservations({ pricing_observations: { peak: {} } }), {});
});
