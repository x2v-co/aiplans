import assert from 'node:assert/strict';
import test from 'node:test';
import { isQuotaEvidenceAuthorized as auth } from './evidence-auth';

const key = 'k'.repeat(40);
const env = { QUOTA_EVIDENCE_TOKEN: key };
test('denies when token unset, weak, or shared', () => {
  assert.equal(auth(`Bearer ${key}`, key, {}), false);
  assert.equal(auth('Bearer short', 'short', { QUOTA_EVIDENCE_TOKEN: 'short' }), false);
  assert.equal(auth(`Bearer ${key}`, key, { ...env, PLANPRICE_CATALOG_TOKEN: key }), false);
  assert.equal(auth(`Bearer ${key}`, key, { ...env, EXCHANGE_RATE_API_KEY: key }), false);
});
test('denies missing or wrong credentials', () => {
  assert.equal(auth(null, null, env), false);
  assert.equal(auth('Bearer nope', 'nope', env), false);
});
test('accepts bearer header or cookie', () => {
  assert.equal(auth(`Bearer ${key}`, null, env), true);
  assert.equal(auth(null, key, env), true);
});
