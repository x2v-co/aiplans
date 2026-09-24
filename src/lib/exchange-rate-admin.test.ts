import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeExchangeRateAdmin } from './exchange-rate-admin';

const key = 'a'.repeat(48);
const env = { PLANPRICE_SERVICE_ROLE: 'admin', PLANPRICE_ADMIN_HOST: 'admin.example', EXCHANGE_RATE_API_KEY: key };
const request = (host = 'admin.example', token = key) => new Request('https://admin.example/api/admin/exchange-rates', {
  headers: { host, authorization: `Bearer ${token}` },
});
test('public deployment denies writes even with correct admin credentials and spoofed host', () => {
  assert.equal(authorizeExchangeRateAdmin(request(), { ...env, PLANPRICE_SERVICE_ROLE: 'public' })?.status, 404);
});
test('management requires its own host and token', () => {
  assert.equal(authorizeExchangeRateAdmin(request('public.example'), env)?.status, 404);
  assert.equal(authorizeExchangeRateAdmin(request('admin.example', 'wrong'), env)?.status, 401);
  assert.equal(authorizeExchangeRateAdmin(request(), env), null);
});
test('missing, demo and shared credentials fail closed', () => {
  for (const bad of ['', 'demo-update-key']) {
    assert.equal(authorizeExchangeRateAdmin(request(), { ...env, EXCHANGE_RATE_API_KEY: bad })?.status, 503);
  }
  assert.equal(authorizeExchangeRateAdmin(request(), { ...env, PLANPRICE_CATALOG_TOKEN: key })?.status, 503);
});
