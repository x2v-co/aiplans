import test from 'node:test';
import assert from 'node:assert/strict';
import { getExchangeRateSync, getExchangeRateDisplay } from './exchange-rates';

test('same currency returns 1', () => {
  assert.equal(getExchangeRateSync('CNY', 'CNY'), 1);
  assert.equal(getExchangeRateSync('EUR', 'EUR'), 1);
});

test('EUR -> CNY is derived via USD instead of falling back to 1', () => {
  const expected = getExchangeRateSync('EUR', 'USD') * getExchangeRateSync('USD', 'CNY');
  assert.notEqual(getExchangeRateSync('EUR', 'CNY'), 1);
  assert.ok(Math.abs(getExchangeRateSync('EUR', 'CNY') - expected) < 1e-9);
});

test('CNY -> EUR is the inverse of EUR -> CNY', () => {
  const product = getExchangeRateSync('CNY', 'EUR') * getExchangeRateSync('EUR', 'CNY');
  assert.ok(Math.abs(product - 1) < 1e-9);
});

test('display string includes the rate', () => {
  assert.equal(getExchangeRateDisplay('USD', 'CNY'), `1 USD ≈ ${getExchangeRateSync('USD', 'CNY')} CNY`);
});
