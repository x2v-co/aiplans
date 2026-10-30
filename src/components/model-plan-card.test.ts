import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { ModelPlanCard, type ModelPlanCardRow } from './model-plan-card';

const plan: ModelPlanCardRow = {
  id: 1, name: 'Pro [needs-verification]', slug: 'pro', tier: 'pro',
  price: 20, annual_price: 200, currency: 'USD', price_unit: 'per_month',
  features: ['Priority support.', 'PRIORITY  support.', 'More quota', 'Tools', 'Team access', 'Fifth feature'],
  notes: 'More quota\n[aiplans:review-source] https://example.com/pricing\nSource: https://example.com/pricing',
  access_from_china: false, plan_kind: 'chat', last_verified: '2026-10-29',
  third_party_coverage_note: 'Priority support.', third_party_coverage: 'unknown',
  providers: { id: 1, name: 'Vendor', slug: 'vendor', logo: null, pricing_url: 'https://example.com/pricing' },
};

function render(locale: 'zh' | 'en', value = plan) {
  const providerProps = {
    locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en,
    children: createElement(ModelPlanCard, { plan: value, locale, now: new Date('2026-10-30T00:00:00Z') }),
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
}

test('both locales have four highlights, one date/link, closed details and no raw annotations or URLs in prose', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = render(locale);
    const visible = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
    assert.equal((visible.match(/<li\b/g) ?? []).length, 4);
    assert.equal((html.match(/<a\b/g) ?? []).length, 1);
    assert.equal((html.match(/<time\b/g) ?? []).length, 1);
    assert.equal((html.match(/Priority support\./g) ?? []).length, 1);
    assert.equal((html.match(/More quota/g) ?? []).length, 1);
    assert.match(html, /<details class=/);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b|\[needs-verification\]|\[aiplans:|>[^<]*https?:\/\//);
    assert.doesNotMatch(visible, /Fifth feature/);
    assert.match(html, /Fifth feature/);
    assert.match(html, /line-clamp-2/);
    assert.match(html, locale === 'zh' ? /待核验/ : /Unverified/);
    assert.match(html, locale === 'zh' ? />来源<\/a>/ : />Source<\/a>/);
    assert.match(html, /2026-10-29/);
    assert.match(html, locale === 'zh' ? /月/ : /month/);
    assert.match(html, locale === 'zh' ? /年/ : /year/);
  }
});

test('missing verification/source stays explicit; absent features do not crash', () => {
  const html = render('en', { ...plan, features: {}, notes: null, last_verified: null, providers: null });
  assert.match(html, /Unverified/);
  assert.match(html, /Last verified.*Not recorded/);
  assert.match(html, /Source not recorded/);
  assert.doesNotMatch(html, /<a\b|<time\b/);
});

test('estimated highlights and expired/stale verification remain visible without expanding details', () => {
  const html = render('zh', { ...plan, features: ['大约 100 万 token'], legacy_ends_on: '2026-10-01', last_verified: '2026-09-01' });
  const visible = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
  assert.match(visible, /估算/);
  assert.match(visible, /已过期/);
  assert.match(visible, /核验已超过 30 天/);
});
