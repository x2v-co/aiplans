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
  features_zh: ['优先支持。', '更多额度', '工具', '团队权限', '第五条功能'],
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
    assert.equal((html.match(locale === 'zh' ? /优先支持。/g : /Priority support\./g) ?? []).length, 1);
    assert.equal((html.match(locale === 'zh' ? /更多额度/g : /More quota/g) ?? []).length, 1);
    assert.match(html, /<details class=/);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b|\[needs-verification\]|\[aiplans:|>[^<]*https?:\/\//);
    assert.doesNotMatch(visible, /Fifth feature|第五条功能/);
    assert.match(html, locale === 'zh' ? /第五条功能/ : /Fifth feature/);
    assert.match(html, /line-clamp-2/);
    assert.match(html, locale === 'zh' ? /待核验/ : /Unverified/);
    assert.match(html, locale === 'zh' ? />来源<\/a>/ : />Source<\/a>/);
    assert.match(html, /2026-10-29/);
    assert.match(html, locale === 'zh' ? /月/ : /month/);
    assert.match(html, locale === 'zh' ? /年/ : /year/);
  }
});

test('missing verification hides the date row; missing source remains explicit', () => {
  const html = render('en', { ...plan, features: {}, notes: null, last_verified: null, providers: null });
  assert.match(html, /Unverified/);
  assert.doesNotMatch(html, /Last verified|Not recorded/);
  assert.match(html, /Source not recorded/);
  assert.doesNotMatch(html, /<a\b|<time\b/);
});

test('estimated highlights and expired/stale verification remain visible without expanding details', () => {
  const html = render('zh', { ...plan, features_zh: undefined, features: ['大约 100 万 token'], legacy_ends_on: '2026-10-01', last_verified: '2026-09-01' });
  const visible = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
  assert.match(visible, /估算/);
  assert.match(visible, /已过期/);
  assert.match(visible, /核验已超过 30 天/);
});

test('null, contact-sales, zero paid and genuine free prices have distinct bilingual displays', () => {
  for (const locale of ['zh', 'en'] as const) {
    for (const overrides of [{ price: 0, tier: 'enterprise' }, { price: 99, is_contact_sales: true }]) {
      const html = render(locale, { ...plan, ...overrides });
      assert.match(html, locale === 'zh' ? /联系销售\/询价/ : /Contact sales \/ Request a quote/);
      assert.doesNotMatch(html, /\$0\.00|\$99\.00|\$200\.00/);
    }
    assert.match(render(locale, { ...plan, price: null }), locale === 'zh' ? /价格未公开/ : /Price not published/);
    assert.match(render(locale, { ...plan, tier: 'free', price: 0 }), locale === 'zh' ? />免费</ : />Free</);
    assert.doesNotMatch(render(locale, { ...plan, last_verified: null }), /<time\b|未记录|Not recorded/);
  }
});

test('SSR and serialized client props give identical dates, flags and prices across host timezones', () => {
  const oldZone = process.env.TZ;
  try {
    for (const locale of ['zh', 'en'] as const) for (const currency of ['CNY', 'USD']) {
      const value = { ...plan, currency, last_verified: '2026-10-29 00:15:00', price: 1234.5 };
      process.env.TZ = 'UTC';
      const server = render(locale, value);
      for (const zone of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = zone;
        assert.equal(render(locale, JSON.parse(JSON.stringify(value))), server);
      }
      assert.match(server, /2026-10-29/);
      assert.ok(server.includes(currency === 'CNY' ? '¥1,234.50' : '$1,234.50'));
    }
  } finally {
    if (oldZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldZone;
  }
});

test('source verification prose cannot contradict the card verification field in either locale', () => {
  for (const locale of ['zh', 'en'] as const) {
    const html = render(locale, { ...plan, features_zh: undefined,
      features: [locale === 'zh' ? '支持文件上传。来源：文档 2026-10-15 核验。' : 'File uploads. Sources: https://example.com; verified 2026-10-15.'],
    });
    assert.doesNotMatch(html, /2026-10-15|Sources:|来源：/);
    assert.equal((html.match(/2026-10-29/g) ?? []).length, 2, 'one dateTime attribute and one date text');
  }
});

test('the static card uses its explicit locale even without or inside a different translation context', () => {
  const props = { plan, locale: 'zh', now: new Date('2026-10-30T00:00:00Z') };
  const node = createElement(ModelPlanCard, props);
  const html = renderToStaticMarkup(node);
  const oppositeContext = { locale: 'en', messages: en, timeZone: 'UTC', children: node };
  assert.equal(renderToStaticMarkup(createElement(NextIntlClientProvider, oppositeContext)), html);
  assert.match(html, /更多额度/);
  assert.doesNotMatch(html, /More quota/);
});
