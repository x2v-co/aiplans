import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { estimate } from '../lib/quota/__fixtures__/estimates';
import { quotaChanges, readVerifiedQuotaEstimates } from '../lib/quota/estimates';
import { PlanQuotaEstimates } from './quota-estimates';
import { QuotaChanges } from './quota-changes';
import { PlanCoverage } from './plan-coverage';

function render(locale: 'en' | 'zh', children: React.ReactNode) {
  return renderToStaticMarkup(jsx(NextIntlClientProvider, {
    locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en, children,
  }));
}

test('both locales render labeled estimates, exact mix, confidence, verification date, model and evidence', () => {
  for (const locale of ['en', 'zh'] as const) {
    const copy = (locale === 'zh' ? zh : en).quota;
    const html = render(locale, createElement(PlanQuotaEstimates, { locale, planSlug: 'example-pro', estimates: [estimate()] }));
    for (const value of [copy.title, copy.monthlyEstimate, copy.confidence, 'medium', '2026-10-01', '4,900,000–9,400,000', '~10M', '0%', '75%', '25%', 'example-model', 'https://example.com/evidence', 'https://example.com/screenshot.png']) assert.ok(html.includes(value), value);
    assert.ok(html.includes(`href="/${locale}/quota-changes"`));
    assert.doesNotMatch(html, /便宜|节省|cheaper|saving|application\/ld\+json/i);
  }
});

test('missing tables and empty estimates render the same localized empty state on cards and history', async () => {
  const missing = await readVerifiedQuotaEstimates(async () => { throw Object.assign(new Error('missing relation'), { code: '42P01' }); });
  for (const locale of ['en', 'zh'] as const) {
    const emptyCopy = (locale === 'zh' ? zh : en).quota.empty;
    for (const estimates of [[], missing]) {
      assert.ok(render(locale, createElement(PlanQuotaEstimates, { locale, planSlug: 'example-pro', estimates })).includes(emptyCopy));
      assert.ok(render(locale, createElement(QuotaChanges, { locale, changes: quotaChanges(estimates) })).includes(emptyCopy));
    }
  }
});

test('short windows show unknown monthly values; absent model and unsafe evidence never imply coverage', () => {
  for (const locale of ['en', 'zh'] as const) {
    const copy = (locale === 'zh' ? zh : en).quota;
    for (const window of ['5h', 'daily']) {
      const html = render(locale, createElement(PlanQuotaEstimates, { locale, planSlug: 'example-pro', estimates: [estimate({ window, served_model: null, evidence: [], notes: '<script>unsafe</script>' })] }));
      assert.ok(html.includes(copy.monthlyUnknown));
      assert.ok(html.includes(copy.unknown));
      assert.ok(html.includes(copy.noEvidence));
      assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
    }
    for (const coverage of [undefined, null, 'unknown', 'full', 'partial', 'none'] as const) {
      const html = render(locale, createElement(PlanCoverage, { locale, coverage }));
      assert.ok(html.includes(copy.coverage));
      assert.ok(html.includes(copy.coverageValues[coverage ?? 'unknown']));
    }
  }
});

test('history renders old → new intervals, stable citations and separate evidence and verification dates', () => {
  const changes = quotaChanges([
    estimate({ is_current: false, superseded_by: 2 }),
    estimate({ id: 2, confidence: 'high', created_at: '2026-10-03', verified_at: '2026-10-02', est_tokens_high: '3000000', evidence: [{ id: 9, url: 'https://example.com/new', screenshot_url: null, captured_at: '2026-10-02', evidence_type: 'official_absolute' }] }),
  ]);
  for (const locale of ['en', 'zh'] as const) {
    const copy = (locale === 'zh' ? zh : en).quota;
    const html = render(locale, createElement(QuotaChanges, { locale, changes }));
    for (const value of [copy.previous, copy.next, copy.recordedAt, 'change-1-2', '2026-10-03', '2026-10-02', '2026-10-01', 'medium', 'high', 'Example vendor', 'example-pro', 'example-model', '9,400,000', '12,000,000', 'https://example.com/evidence', 'https://example.com/new']) assert.ok(html.includes(value), value);
  }
});

test('plan cards show benchmark results with scope warnings and deep links instead of empty state', () => {
  for (const locale of ['en', 'zh'] as const) {
    for (const planSlug of ['chatgpt-pro', 'chatgpt-pro-100', 'chatgpt-pro-200', 'chatgpt-pro-500', 'seed-pro', 'cursor-ultra']) {
      const html = render(locale, createElement(PlanQuotaEstimates, { locale, planSlug, estimates: [] }));
      assert.ok(!html.includes((locale === 'zh' ? zh : en).quota.empty));
      assert.match(html, /data-quota-bench=/);
      if (planSlug.startsWith('chatgpt-pro')) {
        assert.match(html, /8,849,743/);
        assert.match(html, /147,495,716–221,243,575/);
        assert.ok(html.includes(locale === 'zh' ? '不代表本价格档额度' : 'not this price tier’s allowance'));
        assert.ok(html.includes(`/${locale}/quota-bench#codex-pro`));
      } else if (planSlug === 'seed-pro') {
        assert.match(html, /89,703/);
        assert.match(html, /13,191,617–13,591,364/);
        assert.ok(html.includes(`/${locale}/quota-bench#volcengine-pro`));
      } else {
        assert.match(html, /1,162,257/);
        assert.ok(html.includes(locale === 'zh' ? '暂不估算容量' : 'capacity withheld'));
        assert.ok(html.includes(locale === 'zh' ? '仅前 12 次' : 'first 12 calls only'));
        assert.doesNotMatch(html, /tokens \/ /);
      }
    }
    for (const planSlug of ['chatgpt-plus', 'seed-lite', 'cursor-pro', 'x-premium-plus']) {
      const html = render(locale, createElement(PlanQuotaEstimates, { locale, planSlug, estimates: [] }));
      assert.doesNotMatch(html, /data-quota-bench=/);
      assert.ok(html.includes((locale === 'zh' ? zh : en).quota.empty));
    }
  }
});
