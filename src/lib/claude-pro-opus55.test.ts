import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../public/reports/claude-pro-opus55-2026-11-04.json';
import { ClaudeProQuota } from '../components/claude-pro-quota';
import { buildModelPricingSeo } from './model-pricing-seo';
import { buildCompareFaqs } from '../app/[locale]/compare/plans/[model]/faqs';
import type { PlanComparison } from './compare-plans';
import { faqPage } from './seo';
import { claudeProQuotaCopy, claudeProQuotaNotes, isClaudeProQuotaModel } from './claude-pro-opus55';

test('ledger is labelled x2v first-party, links the artifact and keeps the measured figures', () => {
  assert.equal(data.source.kind, 'x2v-first-party');
  assert.equal(data.source.official, false);
  assert.equal(data.source.url, 'https://claude.ai/artifact/DcK5UbxR1SmkgDn38QtBo2');
  assert.equal(data.method.calls, 147);
  assert.deepEqual(data.method.listPricesUsdPerM, { input: 4, output: 20, cacheWrite1h: 8, cacheRead: 0.2 });
  assert.equal(data.method.meterFit.fiveHourOutputEquivalentUsd, 25.75);
  assert.deepEqual(data.windows.map(w => w.window), ['5h', 'week', 'month']);
  assert.deepEqual(data.windows[2].multipleOfPlanPrice, [40, 70]);
});

test('Opus 5.5 model page section and both FAQ schemas render in zh and en', () => {
  assert.ok(isClaudeProQuotaModel('anthropic-claude-opus-5-5'));
  for (const slug of ['anthropic-claude-opus-5-batch', 'anthropic-claude-opus-4-8']) assert.equal(isClaudeProQuotaModel(slug), false);
  for (const locale of ['zh', 'en'] as const) {
    const c = claudeProQuotaCopy(locale);
    const html = renderToStaticMarkup(createElement(ClaudeProQuota, { locale }));
    const model = { slug: 'anthropic-claude-opus-5-5', name: 'Claude Opus 5.5', provider: { name: 'Anthropic' } };
    const comparison = { model, officialPlans: [], thirdPartyPlans: [], summary: {} } as unknown as PlanComparison;
    const schemas = [buildModelPricingSeo(model, [], locale).faqs, buildCompareFaqs(comparison, locale)].map(f => faqPage(f));
    for (const text of [html, ...schemas]) {
      for (const s of ['2026-11-04', c.r5hOut, c.rWeekAg, c.rMonthAg, ...claudeProQuotaNotes(locale)]) assert.ok(text.includes(s), s);
      assert.ok(text.includes(data.source.url));
    }
    assert.ok(html.includes('/reports/claude-pro-opus55-2026-11-04.md'));
    assert.match(c.label, locale === 'zh' ? /x2v 实测.*非 Anthropic 官方/ : /x2v first-party.*not an official Anthropic/);
  }
});

test('Claude Pro Opus 5.5 guide is bilingual, sourced, in the sitemap and links plan and model pages', async () => {
  const { PRICING_GUIDES, PRICING_GUIDE_SLUGS, guideForProviderSlug } = await import('./pricing-guides');
  const { STATIC_PATHS } = await import('./sitemap-static-paths');
  const g = PRICING_GUIDES['claude-pro-opus-5-5-quota'];
  assert.ok(PRICING_GUIDE_SLUGS.includes('claude-pro-opus-5-5-quota'));
  assert.ok(STATIC_PATHS.some(p => p.path === '/guides/claude-pro-opus-5-5-quota'));
  assert.equal(guideForProviderSlug('anthropic'), 'claude-anthropic-pricing');
  assert.ok(g.sources?.some(s => s.url === data.source.url));
  for (const locale of ['zh', 'en'] as const) {
    const links = g.relatedLinks!.map(l => l.url[locale]);
    assert.ok(links.includes(`/${locale}/providers/anthropic#claude-pro`));
    assert.ok(links.includes(`/${locale}/models/anthropic-claude-opus-5-5`));
    const text = g.sections.map(s => s.body[locale]).join('\n');
    for (const s of ['$25.75', '$31.75', '10:54', '11.0M', '28%', '7.2', '$1,390']) assert.ok(text.includes(s), s);
    assert.match(g.intro[locale], locale === 'zh' ? /x2v 实测.*不是 Anthropic/ : /x2v first-party.*not a quota published by Anthropic/);
  }
});
