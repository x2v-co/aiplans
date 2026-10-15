import assert from 'node:assert/strict';
import test from 'node:test';
import { allowsUnverifiedPrice } from './unverified-price';

test('unknown rates require null prices, null verification and an explicit note', () => {
  const unknown = {input_price_per_1m:null, output_price_per_1m:null, last_verified:null, notes:'[needs-verification] official base unknown'};
  assert.equal(allowsUnverifiedPrice(unknown), true);
  assert.equal(allowsUnverifiedPrice({...unknown, notes:''}), false);
  assert.equal(allowsUnverifiedPrice({...unknown, output_price_per_1m:0}), false);
  assert.equal(allowsUnverifiedPrice({...unknown, last_verified:new Date()}), false);
});
