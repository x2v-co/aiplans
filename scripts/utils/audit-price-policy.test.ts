import test from 'node:test';
import assert from 'node:assert/strict';
import { isExplicitlyUnverifiedPrice, isVerifiedFreeOutput } from './audit-price-policy';

test('only deliberately withheld prices become verification warnings', () => {
  const row = {input_price_per_1m:null,output_price_per_1m:null,last_verified:null,notes:'[needs-verification] base unknown'};
  assert.equal(isExplicitlyUnverifiedPrice(row), true);
  assert.equal(isExplicitlyUnverifiedPrice({...row, notes:null}), false);
  assert.equal(isExplicitlyUnverifiedPrice({...row, input_price_per_1m:0}), false);
  assert.equal(isExplicitlyUnverifiedPrice({...row, last_verified:'2026-10-15'}), false);
});

test('SubQ free output exception cannot hide zero input or another channel error', () => {
  assert.equal(isVerifiedFreeOutput('subq-snap','subq',0.05), true);
  assert.equal(isVerifiedFreeOutput('subq-snap','subq',0), false);
  assert.equal(isVerifiedFreeOutput('subq-snap','openrouter',0.05), false);
  assert.equal(isVerifiedFreeOutput('other','subq',0.05), false);
});
