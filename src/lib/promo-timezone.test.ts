import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { introductoryEndDate, promoTimeZone, promoTimeZoneLabel } from './effective-price';
import { limitedTimeOffer } from './limited-time-offer';
import { LimitedTimeOfferMark } from '../components/limited-time-offer';
import { channelListPriceTrust } from './data-trust';

const HY4_CUTOFF = '2026-12-31T15:59:59Z'; // 23:59:59 Beijing
const before = new Date('2026-11-05T00:00:00Z');
const base = { input_price_per_1m: 0.417, output_price_per_1m: 1.2505, cached_input_price_per_1m: 0.021,
  regular_input_price_per_1m: 0.834, regular_output_price_per_1m: 2.501, regular_cached_input_price_per_1m: 0.042,
  promo_ends_at: HY4_CUTOFF, currency: 'USD' };
const tencent = { ...base, providers: { slug: 'tencent', region: 'global' } };
const google = { ...base, promo_ends_at: '2026-12-01T08:00:00Z', providers: { slug: 'google', region: 'global' } };

test('zone by provider: Tencent and china region use Beijing, others Pacific', () => {
  assert.equal(promoTimeZone(tencent), 'Asia/Shanghai');
  assert.equal(promoTimeZone({ provider_slug: 'tencent' }), 'Asia/Shanghai');
  assert.equal(promoTimeZone({ providers: { slug: 'deepseek', region: 'china' } }), 'Asia/Shanghai');
  for (const slug of ['google', 'mistral', 'openrouter']) assert.equal(promoTimeZone({ providers: { slug, region: 'global' } }), 'America/Los_Angeles');
  assert.equal(promoTimeZone(null), 'America/Los_Angeles');
  assert.equal(promoTimeZoneLabel('Asia/Shanghai', 'zh'), '北京时间');
  assert.equal(promoTimeZoneLabel('Asia/Shanghai', 'en'), 'Beijing time');
});

test('end date is computed in the source zone', () => {
  assert.equal(introductoryEndDate(HY4_CUTOFF, 'en', 'Asia/Shanghai'), 'Dec 31, 2026');
  assert.equal(introductoryEndDate(HY4_CUTOFF, 'zh', 'Asia/Shanghai'), '2026-12-31');
  assert.equal(introductoryEndDate('2026-12-01T08:00:00Z', 'en'), 'Nov 30, 2026');
  assert.equal(limitedTimeOffer(tencent, before)?.timeZone, 'Asia/Shanghai');
});

test('Hy4 mark says Beijing time; Google mark still says Pacific', () => {
  const en = renderToStaticMarkup(createElement(LimitedTimeOfferMark, { row: tencent, locale: 'en', now: before }));
  const zh = renderToStaticMarkup(createElement(LimitedTimeOfferMark, { row: tencent, locale: 'zh', now: before }));
  assert.match(en, /Dec 31, 2026<\/time> \(Beijing time\)/);
  assert.match(zh, /2026-12-31<\/time>（北京时间）/);
  assert.doesNotMatch(en + zh, /Pacific|太平洋/);
  const g = renderToStaticMarkup(createElement(LimitedTimeOfferMark, { row: google, locale: 'en', now: before }));
  assert.match(g, /Nov 30, 2026<\/time> \(Pacific time\)/);
});

test('trust label uses the same zone', () => {
  const fact = channelListPriceTrust(tencent as never, 'zh', before);
  assert.match(JSON.stringify(fact), /截止 2026-12-31（北京时间）/);
  const factEn = channelListPriceTrust(google as never, 'en', before);
  assert.match(JSON.stringify(factEn), /Pacific time/);
});
