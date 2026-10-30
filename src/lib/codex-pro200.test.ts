import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { CodexModelMeasurements } from '../components/codex-model-measurements';
import CalculatorView from '../app/[locale]/calculator/calculator-view';
import QuotaBenchPage from '../app/[locale]/quota-bench/page';
import { buildModelPricingSeo } from './model-pricing-seo';
import { buildCompareFaqs } from '../app/[locale]/compare/plans/[model]/faqs';
import type { PlanComparison } from './compare-plans';
import { faqPage } from './seo';
import { codexQuotaCaveats, codexQuotaCopy, isCodexQuotaModel } from './codex-pro200';
import { tokenRange } from './quota/estimates';
import { estimate } from './quota/__fixtures__/estimates';

test('canonical model pages and both FAQ schemas use the same scoped 10-30 figures', () => {
  for (const locale of ['zh', 'en'] as const) {
    const copy = codexQuotaCopy(locale);
    for (const slug of ['openai-gpt-6-astra', 'openai-gpt-6-1-sol']) {
      assert.ok(isCodexQuotaModel(slug));
      const sol = slug.endsWith('sol');
      const capacity = sol ? copy.solCapacity : copy.astraCapacity;
      const html = renderToStaticMarkup(createElement(CodexModelMeasurements, { locale, modelSlug: slug }));
      const model = { slug, name: sol ? 'GPT-6.1 Sol' : 'GPT-6 Astra', provider: { name: 'OpenAI' } };
      const comparison = { model, officialPlans: [], thirdPartyPlans: [], summary: {} } as unknown as PlanComparison;
      const faqLists = [buildModelPricingSeo(model, [], locale).faqs, buildCompareFaqs(comparison, locale)];
      for (const text of [html, ...faqLists.map(faqs => faqPage(faqs))]) {
        assert.ok(text.includes(capacity), capacity);
        assert.ok(text.includes('2026-10-30'));
        for (const note of codexQuotaCaveats(locale)) assert.ok(text.includes(note), note);
        assert.doesNotMatch(text, /倍率|提升\s*[\dX]|\d+(?:\.\d+)?\s*(?:倍|times|fold)\b/i);
        if (sol) assert.doesNotMatch(text, /139\.5M|186\.0M|点估计|上界|point estimate|upper bound/i);
      }
    }
    for (const slug of ['openai-gpt-6-1-sol-batch', 'openai-gpt-6-astra-batch', 'gpt-6.1-terra']) assert.equal(isCodexQuotaModel(slug), false);
    for (const plan_slug of ['chatgpt-pro', 'chatgpt-pro-200']) assert.equal(tokenRange(estimate({ plan_slug }), locale, true), null);
  }
});

test('calculator and report index render both locales with current figures, caveats and history', async () => {
  const render = (element: React.ReactNode, locale: string) => renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {} },
  }, createElement(PathnameContext.Provider, { value: `/${locale}/quota-bench` }, element)));
  for (const locale of ['zh', 'en']) {
    const calculator = render(createElement(CalculatorView, {
      locale, products: [], initialState: { period: 'month', requests: 1, inputTokens: 1, outputTokens: 1, cacheRate: 0, batchRate: 0, region: 'all', modelSlugs: [] },
    }), locale);
    const report = render(await QuotaBenchPage({ params: Promise.resolve({ locale }) }), locale);
    for (const html of [calculator, report]) {
      assert.ok(html.includes(codexQuotaCopy(locale).astraCapacity));
      assert.ok(html.includes(codexQuotaCopy(locale).solCapacity));
      assert.ok(html.includes('/reports/codex-models-2026-10-28.md'));
      assert.ok(html.includes('2026-10-30'));
      for (const note of codexQuotaCaveats(locale)) assert.ok(html.includes(note), note);
      assert.doesNotMatch(html, /倍率|提升\s*[\dX]|\d+(?:\.\d+)?\s*倍|\d+(?:\.\d+)?\s*(?:x|times|fold)\b/i);
    }
    const schema = JSON.parse(report.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    assert.ok(schema.mainEntity[0].acceptedAnswer.text.includes(codexQuotaCopy(locale).solCapacity));
  }
});
