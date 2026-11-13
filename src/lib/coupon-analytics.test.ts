import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_NOT_SET,
} from './funnel-analytics';
import {
  couponEventParams,
  couponOutboundDataset,
  couponPageFamily,
  localeFromPath,
  readCouponOutbound,
  sanitizeCouponId,
  sanitizeCouponPlacement,
  sanitizeLocale,
} from './coupon-analytics';

test('sanitizeCouponId accepts numeric ids and rejects redeem codes', () => {
  assert.equal(sanitizeCouponId(42), '42');
  assert.equal(sanitizeCouponId('17'), '17');
  assert.equal(sanitizeCouponId(0), null);
  assert.equal(sanitizeCouponId(-3), null);
  assert.equal(sanitizeCouponId('ZAGRFMAR'), null);
  assert.equal(sanitizeCouponId('BIGMODEL-INVITE-20M'), null);
  assert.equal(sanitizeCouponId('https://z.ai/subscribe?ic=X'), null);
  assert.equal(sanitizeCouponId(''), null);
  assert.equal(sanitizeCouponId(null), null);
});

test('placement and locale stay on the allowlist', () => {
  assert.equal(sanitizeCouponPlacement('coupons'), 'coupons');
  assert.equal(sanitizeCouponPlacement('badge-xs'), ANALYTICS_NOT_SET);
  assert.equal(sanitizeCouponPlacement('unknown'), ANALYTICS_NOT_SET);
  assert.equal(sanitizeLocale('zh'), 'zh');
  assert.equal(sanitizeLocale('EN'), 'en');
  assert.equal(sanitizeLocale('fr'), ANALYTICS_NOT_SET);
  assert.equal(localeFromPath('/zh/coupons'), 'zh');
  assert.equal(localeFromPath('/en/api-pricing'), 'en');
  assert.equal(localeFromPath('/coupons'), ANALYTICS_NOT_SET);
});

test('coupon page family names /coupons and /plans, else reuses page_group', () => {
  assert.equal(couponPageFamily('/zh/coupons'), 'coupons');
  assert.equal(couponPageFamily('/en/coupons/'), 'coupons');
  assert.equal(couponPageFamily('/en/plans'), 'plans');
  assert.equal(couponPageFamily('/zh/api-pricing'), 'api-pricing');
  assert.equal(couponPageFamily('/en/compare/plans/kimi-k2.5'), 'compare-plan');
  assert.equal(couponPageFamily('/en/models/gpt-4o'), 'model');
  assert.equal(couponPageFamily('/zh/providers/openai'), 'provider');
  assert.equal(couponPageFamily(null), ANALYTICS_NOT_SET);
});

test('coupon event params never include the redeem code', () => {
  const params = couponEventParams({
    couponId: 17,
    providerSlug: 'Volcengine',
    channelSlug: 'volcengine',
    placement: 'coupons',
    locale: 'zh',
    pathname: '/zh/coupons',
    action: 'copy',
  });
  assert.deepEqual(params, {
    provider_slug: 'volcengine',
    channel_slug: 'volcengine',
    coupon_id: '17',
    placement: 'coupons',
    page_family: 'coupons',
    locale: 'zh',
    action: 'copy',
  });
  assert.equal(JSON.stringify(params).includes('ZAGRFMAR'), false);

  const rejected = couponEventParams({
    couponId: 'ZAGRFMAR',
    placement: 'hacked',
    action: 'outbound',
  });
  assert.equal(rejected.coupon_id, ANALYTICS_NOT_SET);
  assert.equal(rejected.placement, ANALYTICS_NOT_SET);
  assert.equal(rejected.action, 'outbound');
  assert.equal(rejected.channel_slug, ANALYTICS_NOT_SET);
});

test('channel_slug falls back to provider_slug', () => {
  const params = couponEventParams({
    couponId: 1,
    providerSlug: 'openai',
    placement: 'plans',
    locale: 'en',
    pathname: '/en/plans',
    action: 'outbound',
  });
  assert.equal(params.channel_slug, 'openai');
  assert.equal(params.page_family, 'plans');
});

test('coupon outbound dataset tags the link for global outbound_click', () => {
  assert.deepEqual(couponOutboundDataset({
    couponId: 9,
    providerSlug: 'OpenRouter',
    channelSlug: 'OpenRouter',
    channelType: 'aggregator',
    modelSlug: 'kimi-k2.5',
    placement: 'api-pricing',
  }), {
    'data-channel-slug': 'openrouter',
    'data-channel-type': 'aggregator',
    'data-model-slug': 'kimi-k2.5',
    'data-link-source': 'coupon',
    'data-coupon-id': '9',
    'data-coupon-placement': 'api-pricing',
    'data-provider-slug': 'openrouter',
  });
});

test('readCouponOutbound recognizes coupon links and ignores bare channel tags', () => {
  assert.deepEqual(readCouponOutbound({
    linkSource: 'coupon',
    couponId: '9',
    couponPlacement: 'compare',
    providerSlug: 'openai',
    channelSlug: 'azure-openai',
  }), {
    isCoupon: true,
    coupon_id: '9',
    placement: 'compare',
    provider_slug: 'openai',
    channel_slug: 'azure-openai',
  });
  assert.equal(readCouponOutbound({ channelSlug: 'openrouter' }).isCoupon, false);
  assert.equal(readCouponOutbound({ couponId: 'ZAGRFMAR' }).isCoupon, false);
  assert.equal(readCouponOutbound({ couponId: '12' }).isCoupon, true);
});
