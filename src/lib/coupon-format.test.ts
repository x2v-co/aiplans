import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactTokenCount,
  couponCopyTarget,
  couponLinkLabel,
  formatCouponDiscount,
  isCouponExpired,
} from './coupon-format';

// Minimal stand-in for useTranslations('coupons'): interpolates {name}.
const tt = (key: string, params?: Record<string, string | number>) => {
  const patterns: Record<string, string> = {
    percentOff: '{value}% OFF',
    creditAmount: '${value} CREDIT',
    tokenCredit: '{value} token grant',
    badgeToken: '{value} tokens',
  };
  return (patterns[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(params?.[k] ?? ''));
};

test('percentage/fixed formatting', () => {
  assert.equal(formatCouponDiscount({ discount_type: 'percentage', discount_value: 10 }, 'en', tt), '10% OFF');
  assert.equal(formatCouponDiscount({ discountType: 'fixed', discountValue: 5 }, 'en', tt), '$5 CREDIT');
});

test('trial token packs compact per locale', () => {
  const c = { discount_type: 'trial', discount_value: 20_000_000 };
  assert.equal(formatCouponDiscount(c, 'en', tt), '20M token grant');
  assert.equal(formatCouponDiscount(c, 'zh', tt), '2000万 token grant');
  assert.equal(formatCouponDiscount(c, 'en', tt, 'badgeToken'), '20M tokens');
});

test('copy target is the invite link for trial coupons, the code otherwise', () => {
  assert.equal(
    couponCopyTarget({ code: 'BIGMODEL-INVITE-20M', discount_type: 'trial', offer_url: 'https://bigmodel.cn/x?icode=a' }),
    'https://bigmodel.cn/x?icode=a',
  );
  assert.equal(
    couponCopyTarget({ code: 'ZAGRFMAR', discountType: 'percentage', offerUrl: 'https://volcengine.com/p' }),
    'ZAGRFMAR',
  );
  assert.equal(couponCopyTarget({ code: 'X', discount_type: 'trial' }), 'X');
});

test('link label is host plus path without trailing slash', () => {
  assert.equal(couponLinkLabel('https://www.bigmodel.cn/invite/'), 'bigmodel.cn/invite');
  assert.equal(couponLinkLabel('https://z.ai/subscribe?ic=X'), 'z.ai/subscribe');
  assert.equal(couponLinkLabel('not-a-url'), 'not-a-url');
});

test('null expiry means no published expiry, not 1970', () => {
  assert.equal(isCouponExpired(null), false);
  assert.equal(isCouponExpired(new Date(Date.now() - 86_400_000).toISOString()), true);
  assert.equal(isCouponExpired(new Date(Date.now() + 86_400_000).toISOString()), false);
});

test('compact token count locale selection', () => {
  assert.equal(compactTokenCount(20_000_000, 'zh'), '2000万');
  assert.equal(compactTokenCount(20_000_000, 'en'), '20M');
});
