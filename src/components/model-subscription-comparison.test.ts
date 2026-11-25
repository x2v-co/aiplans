import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ComparePlansView from '@/app/[locale]/compare/plans/[model]/compare-plans-view';
import type { PlanComparison } from '@/lib/compare-plans';
import { loadQueryModule } from '@/lib/test-helpers/query-module';

const data = { model: { slug: 'gpt-5.2', name: 'GPT-5.2', provider: { slug: 'openai', name: 'OpenAI', website: null } },
  officialPlans: [{ plan: { slug: 'fixture-pro', name: 'Fixture Pro', isOfficial: true, planKind: 'coding',
    features: ['Batch access stays distinct', 'Cached input terms retained'], quotaUnit: 'tokens' },
    channel: { slug: 'openai', name: 'OpenAI' }, pricing: { billingModel: 'subscription', monthly: 20,
      yearly: 200, yearlyMonthly: 200 / 12, yearlyDiscountPercent: 100 / 6, currency: 'USD' } }],
  thirdPartyPlans: [], summary: { totalPlans: 1, cheapestByKind: [] } } as unknown as PlanComparison;

test('embedded comparison renders original subscription features, tiers and billing controls without an extra header/main/h1', () => {
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en,
      children: createElement(ComparePlansView, { embedded: true, locale, data, faqs: [], couponByProvider: {}, quotaEstimates: [] }) }));
    assert.match(html, /subscription-comparison/);
    assert.match(html, /Fixture Pro/);
    assert.match(html, /Batch access stays distinct/);
    assert.match(html, /Cached input terms retained/);
    assert.match(html, /20\.00/);
    assert.match(html, /role="switch"/);
    assert.match(html, /<h2/);
    assert.doesNotMatch(html, /<main|<header|<h1/);
  }
});

test('canonical model integration passes identical payload, FAQs, plan-scoped coupons and quota inputs to the existing renderer', async () => {
  const coupons = { openai: [] };
  const faqs = [{ question: 'Fixture question', answer: 'Fixture answer' }];
  const mod = loadQueryModule(new URL('./model-subscription-comparison.tsx', import.meta.url), {
    '@/lib/model-plan-comparison': { getIntegratedPlanComparison: async () => data },
    '@/lib/coupons': { getActiveCouponMap: async (scope: string) => { assert.equal(scope, 'plan'); return coupons; } },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async (slugs: string[]) => {
      assert.deepEqual(Array.from(slugs), ['fixture-pro']); return [];
    } },
    '@/lib/pricing-guides': { guideForModelSlug: () => null },
    '@/app/[locale]/compare/plans/[model]/faqs': { buildCompareFaqs: (payload: unknown) => {
      assert.equal(payload, data); return faqs;
    } },
    '@/app/[locale]/compare/plans/[model]/compare-plans-view': { __esModule: true, default: ComparePlansView },
  });
  const element = await (mod.default as (props: { slug: string; locale: string }) => Promise<ReactElement<Record<string, unknown>>>)({ slug: data.model.slug, locale: 'en' });
  assert.equal(element.type, ComparePlansView);
  assert.equal(element.props.data, data);
  assert.equal(element.props.faqs, faqs);
  assert.equal(element.props.couponByProvider, coupons);
  assert.equal(element.props.embedded, true);
});
