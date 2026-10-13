import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PRICING_GUIDES,
  PRICING_GUIDE_SLUGS,
  guideForModelSlug,
  guideForProviderSlug,
  isPricingGuideSlug,
  isOpenAIModelSlug,
  OPENAI_MODEL_SLUG_PREFIXES,
  latestGuideDate,
  summarizeGuidePrices,
} from './pricing-guides';
import { buildMetadata, faqPage } from './seo';

test('maps search-opportunity model families to their pricing guides', () => {
  assert.equal(guideForModelSlug('chatglm-4-air'), 'glm-chatglm-api-pricing');
  assert.equal(guideForModelSlug('claude-opus-5'), 'claude-anthropic-pricing');
  assert.equal(guideForModelSlug('grok-4-fast'), 'grok-pricing');
  assert.equal(guideForModelSlug('kimi-k2.5'), 'kimi-api-pricing');
  assert.equal(guideForModelSlug('gpt-5'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('openai-gpt-6-1-sol'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('GPT-4.1'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('deepseek-v3'), null);
});

test('maps relevant providers and validates only own guide slugs', () => {
  assert.equal(guideForProviderSlug('anthropic'), 'claude-anthropic-pricing');
  assert.equal(guideForProviderSlug('moonshot-china'), 'kimi-api-pricing');
  assert.equal(guideForProviderSlug('openai'), 'openai-api-pricing');
  assert.equal(guideForProviderSlug('openrouter'), null);
  assert.equal(isPricingGuideSlug('openai-api-pricing'), true);
  assert.equal(isPricingGuideSlug('grok-pricing'), true);
  for (const slug of ['not-a-guide', 'toString', 'constructor', '__proto__']) {
    assert.equal(isPricingGuideSlug(slug), false);
  }
});

test('every guide is discoverable through the sitemap and both IndexNow locales', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  const indexnow = readFileSync(new URL('../../scripts/submit-indexnow.ts', import.meta.url), 'utf8');
  for (const slug of PRICING_GUIDE_SLUGS) {
    assert.ok(sitemap.includes(`'/guides/${slug}'`), `sitemap missing ${slug}`);
    for (const locale of ['en', 'zh'] as const) {
      assert.ok(indexnow.includes(`'/${locale}/guides/${slug}'`));
      const guide = PRICING_GUIDES[slug];
      assert.ok(guide.title[locale]);
      assert.ok(guide.description[locale]);
      assert.ok(guide.intro[locale]);
      for (const section of guide.sections) {
        assert.ok(section.heading[locale]);
        assert.ok(section.body[locale]);
      }
    }
  }
});

test('OpenAI guide has bilingual FAQ, official citations and locale metadata', () => {
  const guide = PRICING_GUIDES['openai-api-pricing'];
  assert.ok(guide.sources && guide.sources.length >= 2);
  assert.ok(guide.reviewedAt && Number.isFinite(Date.parse(guide.reviewedAt)));
  assert.ok(guide.faqs && guide.faqs.length >= 4);
  for (const locale of ['en', 'zh'] as const) {
    const faqs: Array<{ question: string; answer: string }> = guide.faqs.map((faq) => ({ question: faq.question[locale], answer: faq.answer[locale] }));
    const schema = JSON.parse(faqPage(faqs));
    assert.equal(schema.mainEntity.length, faqs.length);
    for (let i = 0; i < faqs.length; i++) {
      assert.ok(faqs[i].question && faqs[i].answer);
      assert.equal(schema.mainEntity[i].name, faqs[i].question);
      assert.equal(schema.mainEntity[i].acceptedAnswer.text, faqs[i].answer);
    }
    guide.sources.forEach((source) => {
      assert.ok(source.label[locale]);
      assert.equal(new URL(source.url).hostname, 'developers.openai.com');
    });
    const metadata = buildMetadata({ locale, path: `/guides/${guide.slug}`, title: guide.title, description: guide.description });
    assert.equal(metadata.alternates?.canonical, `https://aiplans.dev/${locale}/guides/${guide.slug}`);
    assert.equal(metadata.alternates?.languages?.['zh-CN'], `https://aiplans.dev/zh/guides/${guide.slug}`);
    assert.equal(metadata.alternates?.languages?.en, `https://aiplans.dev/en/guides/${guide.slug}`);
  }
});

type PriceRow = Parameters<typeof summarizeGuidePrices>[0][number];
const row = (overrides: Partial<PriceRow> = {}): PriceRow => ({
  model_id: 1,
  model_name: 'GPT Test',
  model_slug: 'gpt-test',
  released_at: null,
  provider_name: 'Test Channel',
  provider_slug: 'test-channel',
  provider_type: 'aggregator',
  input_price: 2,
  output_price: 10,
  currency: 'USD',
  last_verified: '2026-10-01',
  ...overrides,
});

test('calculates the stated 1M input plus 250K output workload', () => {
  const [model] = summarizeGuidePrices([row()]);
  assert.equal(model.exampleCostUsd, 4.5);
  assert.equal(model.cheapest.inputPrice, 2);
  assert.equal(model.channelCount, 1);
});

test('missing or invalid output prices are unknown, never a zero-cost estimate', () => {
  for (const output_price of [null, -1, NaN, Infinity]) {
    const [model] = summarizeGuidePrices([row({ output_price })]);
    assert.equal(model.exampleCostUsd, null);
    assert.equal(model.cheapest.outputPrice, null);
  }
  const [free] = summarizeGuidePrices([row({ input_price: 0, output_price: 0 })]);
  assert.equal(free.exampleCostUsd, 0);
});

test('selects by input rate and preserves the selected channel verification date', () => {
  const [model] = summarizeGuidePrices([
    row({ provider_slug: 'low-input', input_price: 1, output_price: 100, last_verified: '2026-09-01' }),
    row({ provider_slug: 'openai', provider_type: 'official', input_price: 2, output_price: 2, last_verified: '2026-10-13' }),
  ]);
  assert.equal(model.cheapest.providerSlug, 'low-input');
  assert.equal(model.exampleCostUsd, 26);
  assert.equal(model.lastVerified, '2026-09-01');
  assert.equal(model.official?.inputPrice, 2);
  assert.equal(model.channelCount, 2);
});

test('does not publish invalid input prices and limits the snapshot to 12 models', () => {
  assert.deepEqual(summarizeGuidePrices([]), []);
  for (const input_price of [null, -1, NaN, Infinity]) {
    assert.deepEqual(summarizeGuidePrices([row({ input_price })]), []);
  }
  const rows = Array.from({ length: 15 }, (_, i) => row({ model_id: i, model_slug: `gpt-test-${i}` }));
  const models = summarizeGuidePrices(rows);
  assert.equal(models.length, 12);
  assert.equal(models[0].slug, 'gpt-test-0');
  assert.equal(models[11].slug, 'gpt-test-11');
});

test('guide price query keeps legacy rows with NULL price_unit and does not require legacy models.type = llm', () => {
  const source = readFileSync(new URL('./pricing-guides.ts', import.meta.url), 'utf8');
  const query = source.slice(source.indexOf('export async function getPricingGuideModels'), source.indexOf('export function summarizeGuidePrices'));
  assert.match(query, /COALESCE\(cp\.price_unit, 'per_1m_tokens'\) = 'per_1m_tokens'/);
  assert.doesNotMatch(query, /AND cp\.price_unit = /);
  assert.doesNotMatch(query, /m\.type = 'llm'/);
  assert.match(query, /COALESCE\(m\.model_category, 'text'\) = 'text'/);
});

test('dateModified uses the newer of reviewedAt and latest data verification', () => {
  assert.equal(latestGuideDate('2026-10-13', '2026-11-02T08:00:00Z'), '2026-11-02T08:00:00.000Z');
  assert.equal(latestGuideDate('2026-10-13', '2026-09-01T00:00:00Z'), '2026-10-13T00:00:00.000Z');
  assert.equal(latestGuideDate('2026-10-13', null), '2026-10-13T00:00:00.000Z');
  assert.equal(latestGuideDate(undefined, null), undefined);
});

test('OpenAI family: SQL patterns and internal links share one definition', () => {
  const guide = PRICING_GUIDES['openai-api-pricing'];
  assert.deepEqual(guide.queryPatterns, OPENAI_MODEL_SLUG_PREFIXES.map((p) => `${p}%`));
  const likeToRegex = (p: string) => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
  const sqlMatches = (slug: string) => guide.queryPatterns.some((p) => likeToRegex(p).test(slug.toLowerCase()));
  const family = [
    'gpt-5', 'gpt-4.1-mini', 'gpt-4o', 'GPT-4.1', 'gpt-oss-120b', 'gpt-oss-20b',
    'openai-gpt-6-1-sol', 'openai-gpt-oss-120b', '~openai-gpt-5', '~openai-gpt-oss-20b',
  ];
  for (const slug of family) {
    assert.equal(sqlMatches(slug), true, `SQL should match ${slug}`);
    assert.equal(isOpenAIModelSlug(slug), true, slug);
    assert.equal(guideForModelSlug(slug), 'openai-api-pricing', slug);
  }
  for (const slug of ['community-gpt-tuned', 'chatgpt-clone', 'deepseek-v3', 'claude-opus-5']) {
    assert.equal(sqlMatches(slug), isOpenAIModelSlug(slug), slug);
    assert.notEqual(guideForModelSlug(slug), 'openai-api-pricing', slug);
  }
});
