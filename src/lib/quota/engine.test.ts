import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMultiplier, blendedPricePerMTok, measuredQuota, orderOfMagnitude,
  realUnitPrice, toRange, weeklyToMonthly, windowToWeekly, type Measurement,
} from './engine';

// Synthetic arithmetic fixtures, not vendor plan data or prices.
const prices = { input: 8, cachedInput: 2, output: 16 };
const coding = { cacheReadPct: 97, inputPct: 2.5, outputPct: 0.5 };
const chat = { cacheReadPct: 0, inputPct: 75, outputPct: 25 };
const sample: Measurement = {
  tokensConsumed: { input: 1e6, cachedInput: 2e6, output: 0.5e6 },
  listPrices: prices, mix: chat, quotaPctBefore: 10, quotaPctAfter: 20, windowKind: 'weekly',
};
function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} != ${expected}`);
}

test('blends mutually exclusive percentages using USD per million tokens', () => {
  close(blendedPricePerMTok(prices, coding), 2.22);
  close(blendedPricePerMTok(prices, chat), 10);
  assert.equal(blendedPricePerMTok(prices, { cacheReadPct: 100, inputPct: 0, outputPct: 0 }), 2);
  assert.equal(blendedPricePerMTok({ input: 0, cachedInput: 0, output: 0 }, chat), 0);
});

test('rejects invalid prices and workload percentages', () => {
  for (const invalid of [-1, NaN, Infinity]) {
    for (const key of ['input', 'cachedInput', 'output']) {
      assert.throws(() => blendedPricePerMTok({ ...prices, [key]: invalid }, chat), RangeError);
    }
    assert.throws(() => blendedPricePerMTok(prices, { ...chat, outputPct: invalid }), RangeError);
  }
  for (const outputPct of [0.25, 24, 26, 101]) {
    assert.throws(() => blendedPricePerMTok(prices, { ...chat, outputPct }), /sum/);
  }
});

test('full utilization unit price and exactly four weeks per month', () => {
  close(realUnitPrice(24, 120e6), 0.2);
  assert.equal(realUnitPrice(0, 120e6), 0);
  assert.equal(weeklyToMonthly(30e6), 120e6);
  assert.equal(windowToWeekly(120, 'monthly'), 30);
  assert.equal(windowToWeekly(30, 'weekly'), 30);
  assert.equal(windowToWeekly(5, 'daily', 3), 15);
  assert.equal(windowToWeekly(5, '5h', 6), 30);
  for (const window of ['daily', '5h'] as const) {
    assert.throws(() => windowToWeekly(5, window), /explicit windowsPerWeek/);
    for (const count of [0, -1, NaN, Infinity]) assert.throws(() => windowToWeekly(5, window, count), RangeError);
  }
});

test('invalid unit price denominators and nonfinite inputs fail', () => {
  for (const invalid of [0, -1, NaN, Infinity]) assert.throws(() => realUnitPrice(24, invalid), RangeError);
  for (const invalid of [-1, NaN, Infinity]) {
    assert.throws(() => realUnitPrice(invalid, 1e6), RangeError);
    assert.throws(() => weeklyToMonthly(invalid), RangeError);
    assert.throws(() => windowToWeekly(invalid, 'weekly'), RangeError);
  }
});

test('measurement exposes each list-value step and propagates rounding on BOTH readings', () => {
  const result = measuredQuota(sample);
  assert.equal(result.consumedValueUsd, 20);
  close(result.usdPerPct.low, 20 / 11);
  close(result.usdPerPct.high, 20 / 9);
  close(result.windowValueUsd.low, 2000 / 11);
  assert.deepEqual(result.windowValueUsd, result.weeklyValueUsd);
  close(result.monthlyValueUsd.high, 8000 / 9);
  close(result.low, 8000 / 11 / 10 * 1e6);
  close(result.high, 8000 / 9 / 10 * 1e6);
  assert.ok(result.low < 80e6 && result.high > 80e6);
});

test('zero rounding uncertainty returns a point estimate; custom uncertainty widens it', () => {
  const exact = measuredQuota({ ...sample, pctRoundingUncertainty: 0 });
  assert.equal(exact.low, 80e6);
  assert.equal(exact.high, 80e6);
  const wider = measuredQuota({ ...sample, pctRoundingUncertainty: 1 });
  close(wider.low, 800e6 / 12);
  close(wider.high, 800e6 / 8);
});

test('percentage rounding is clipped to the valid 0..100 meter range', () => {
  const zero = measuredQuota({ ...sample, quotaPctBefore: 0 });
  close(zero.usdPerPct.low, 20 / 20.5);
  close(zero.usdPerPct.high, 20 / 19);
  const full = measuredQuota({ ...sample, quotaPctBefore: 90, quotaPctAfter: 100 });
  close(full.usdPerPct.low, 20 / 10.5);
  close(full.usdPerPct.high, 20 / 9);
});

test('short windows use only caller-supplied assumptions; monthly windows stay monthly', () => {
  const exact = { ...sample, pctRoundingUncertainty: 0 };
  for (const windowKind of ['daily', '5h'] as const) {
    assert.throws(() => measuredQuota({ ...exact, windowKind }), /windowsPerWeek/);
    assert.equal(measuredQuota({ ...exact, windowKind, windowsPerWeek: 2 }).low, 160e6);
  }
  const monthly = measuredQuota({ ...exact, windowKind: 'monthly' });
  assert.equal(monthly.low, 20e6);
  assert.equal(monthly.weeklyValueUsd.low, 50);
  assert.equal(monthly.monthlyValueUsd.low, 200);
});

test('converting list value to target mix is distinct from extrapolating raw measured tokens', () => {
  const result = measuredQuota({ ...sample, mix: coding, pctRoundingUncertainty: 0 });
  close(result.low, 800 / 2.22 * 1e6);
  assert.notEqual(result.low, 3.5e6 / 0.1 * 4);
});

test('zero/negative consumption deltas, resets and uncertainty spanning zero are rejected', () => {
  for (const after of [10, 9, 0]) assert.throws(() => measuredQuota({ ...sample, quotaPctAfter: after }), /delta/);
  for (const after of [10.5, 11]) assert.throws(() => measuredQuota({ ...sample, quotaPctAfter: after }), /rounding uncertainty/);
  for (const invalid of [-1, 101, NaN, Infinity]) {
    assert.throws(() => measuredQuota({ ...sample, quotaPctAfter: invalid }), RangeError);
    assert.throws(() => measuredQuota({ ...sample, quotaPctBefore: invalid }), RangeError);
  }
  for (const invalid of [-1, NaN, Infinity]) assert.throws(() => measuredQuota({ ...sample, pctRoundingUncertainty: invalid }), RangeError);
});

test('no consumed worth or zero blended price cannot produce a usable token estimate', () => {
  const zero = { input: 0, cachedInput: 0, output: 0 };
  assert.throws(() => measuredQuota({ ...sample, tokensConsumed: zero }), /consumed list value/);
  assert.throws(() => measuredQuota({ ...sample, listPrices: zero }), /blended price/);
  for (const invalid of [-1, NaN, Infinity]) {
    assert.throws(() => measuredQuota({ ...sample, tokensConsumed: { ...zero, input: invalid } }), RangeError);
  }
});

test('vendor multipliers retain their window and cannot chain across reset windows', () => {
  const twenty = applyMultiplier({ value: 100, windowKind: '5h' }, { factor: 20, windowKind: '5h' });
  assert.deepEqual(twenty, { value: 2000, windowKind: '5h' });
  assert.throws(() => applyMultiplier(twenty, { factor: 2, windowKind: 'weekly' }), /across windows/);
  assert.throws(() => applyMultiplier({ value: 100, windowKind: 'weekly' }, { factor: 20, windowKind: '5h' }), /across windows/);
  assert.deepEqual(applyMultiplier({ value: 50, windowKind: 'weekly' }, { factor: 2, windowKind: 'weekly' }), { value: 100, windowKind: 'weekly' });
  for (const factor of [0, -1, NaN, Infinity]) assert.throws(() => applyMultiplier(twenty, { factor, windowKind: '5h' }), RangeError);
});

test('display helpers round to two significant figures and label the nearest decade', () => {
  assert.deepEqual(toRange(12_345_678, 98_765_432), { low: 12e6, high: 99e6 });
  assert.deepEqual(toRange(0.001234), { low: 0.0012, high: 0.0012 });
  assert.deepEqual(toRange(0), { low: 0, high: 0 });
  assert.equal(orderOfMagnitude(12e6), '~10M');
  assert.equal(orderOfMagnitude(85e6), '~100M');
  assert.equal(orderOfMagnitude(950e6), '~1B');
  assert.equal(orderOfMagnitude(1200), '~1K');
  assert.equal(orderOfMagnitude(0.01), '~0.01');
  assert.equal(orderOfMagnitude(0), '~0');
  assert.throws(() => toRange(2, 1), /low/);
  for (const invalid of [-1, NaN, Infinity]) {
    assert.throws(() => toRange(invalid), RangeError);
    assert.throws(() => orderOfMagnitude(invalid), RangeError);
  }
});
