import assert from 'node:assert/strict';
import test from 'node:test';
import { channelTermBadges, QUOTA_UNITS } from './channel-terms';

test('missing columns, NULL and explicit false never imply a training discount', () => {
  for (const terms of [undefined, null, {}, {
    data_for_discount: null, data_for_discount_note: null, quota_unit: null,
  }, {
    data_for_discount: false, data_for_discount_note: 'Default opt-out training policy',
  }]) {
    assert.deepEqual(channelTermBadges(terms), []);
  }
});

test('only explicit true produces a warning, preserving the optional note', () => {
  assert.deepEqual(channelTermBadges({ data_for_discount: true, data_for_discount_note: ' Discount for training ' }),
    [{ kind: 'training', note: 'Discount for training' }]);
  for (const note of [undefined, null, '', '  ']) {
    assert.deepEqual(channelTermBadges({ data_for_discount: true, data_for_discount_note: note }),
      [{ kind: 'training', note: null }]);
  }
});

test('all four quota units map independently of training status', () => {
  for (const unit of QUOTA_UNITS) {
    for (const data_for_discount of [undefined, null, false]) {
      assert.deepEqual(channelTermBadges({ quota_unit: unit, data_for_discount }), [{ kind: 'quota', unit }]);
    }
    assert.deepEqual(channelTermBadges({ quota_unit: unit, data_for_discount: true }),
      [{ kind: 'training', note: null }, { kind: 'quota', unit }]);
  }
});

test('unknown or malformed units are hidden, without inferring a currency unit', () => {
  for (const quota_unit of [undefined, null, '', 'USD', 'request', 'dollars', '0', ' usd ']) {
    assert.deepEqual(channelTermBadges({ quota_unit }), []);
  }
});
