import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// Keep SEO coverage in the existing PR-check test entrypoint.
import './model-pricing-seo.test';
import './pricing-seo.test';
import {
  PRICING_GUIDES,
  PRICING_GUIDE_SLUGS,
  guideForModelSlug,
  guideForProviderSlug,
  getPricingGuideModels,
  isPricingGuideSlug,
  isOpenAIModelSlug,
  OPENAI_MODEL_SLUG_PREFIXES,
  latestGuideDate,
  summarizeGuidePrices,
} from './pricing-guides';
import { buildMetadata, faqPage } from './seo';
import { STATIC_PATHS } from './sitemap-static-paths';

test('maps search-opportunity model families to their pricing guides', () => {
  assert.equal(guideForModelSlug('chatglm-4-air'), 'glm-chatglm-api-pricing');
  assert.equal(guideForModelSlug('claude-opus-5'), 'claude-anthropic-pricing');
  assert.equal(guideForModelSlug('grok-4-fast'), 'grok-pricing');
  assert.equal(guideForModelSlug('kimi-k2.5'), 'kimi-api-pricing');
  assert.equal(guideForModelSlug('gpt-5'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('openai-gpt-6-1-sol'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('GPT-4.1'), 'openai-api-pricing');
  assert.equal(guideForModelSlug('deepseek-v3'), null);
  assert.equal(guideForModelSlug('cursor'), null);
});

test('maps relevant providers and validates only own guide slugs', () => {
  assert.equal(guideForProviderSlug('anthropic'), 'claude-anthropic-pricing');
  assert.equal(guideForProviderSlug('moonshot-china'), 'kimi-api-pricing');
  assert.equal(guideForProviderSlug('openai'), 'openai-api-pricing');
  assert.equal(guideForProviderSlug('cursor'), null);
  assert.equal(guideForProviderSlug('xai'), 'cursor-x-subscription-pricing');
  assert.equal(guideForProviderSlug('openrouter'), null);
  assert.equal(isPricingGuideSlug('openai-api-pricing'), true);
  assert.equal(isPricingGuideSlug('grok-pricing'), true);
  for (const slug of ['not-a-guide', 'toString', 'constructor', '__proto__']) {
    assert.equal(isPricingGuideSlug(slug), false);
  }
});

test('the sitemap and guides index discover every slug from the shared catalog', () => {
  // Fixed sitemap paths live in sitemap-static-paths.ts (with their lastmod source).
  const sitemap = readFileSync(new URL('./sitemap-static-paths.ts', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../app/[locale]/guides/page.tsx', import.meta.url), 'utf8');
  assert.match(sitemap, /PRICING_GUIDE_SLUGS\.map/);
  assert.ok(sitemap.includes('`/guides/${slug}`'));
  assert.match(index, /PRICING_GUIDE_SLUGS\.map/);
  assert.ok(index.includes('`/${locale}/guides/${slug}`'));
  for (const slug of PRICING_GUIDE_SLUGS) {
    assert.equal(PRICING_GUIDES[slug].slug, slug);
    assert.equal(isPricingGuideSlug(slug), true);
    assert.ok(STATIC_PATHS.some((entry) => entry.path === `/guides/${slug}`));
  }
});

test('all research guides remain discoverable in both IndexNow locales', () => {
  const indexnow = readFileSync(new URL('../../scripts/submit-indexnow.ts', import.meta.url), 'utf8');
  for (const slug of PRICING_GUIDE_SLUGS) {
    // The submission script has a curated research list, separate from the full sitemap.
    for (const locale of ['en', 'zh'] as const) {
      assert.ok(indexnow.includes(`'/${locale}/guides/${slug}'`));
    }
  }
});

test('Codex Pro 200 benchmark preserves measurement limits and the final editorial policy', () => {
  const guide = PRICING_GUIDES['codex-pro-200-quota-benchmark'];
  assert.equal(guide.priceTable, false);
  assert.equal(guide.planTable, undefined);
  assert.deepEqual(guide.queryPatterns, ['%gpt-6-astra%', '%gpt-6-1-sol%']);
  assert.deepEqual(guide.providerSlugs, ['openai']);
  assert.equal(guide.reviewedAt, '2026-10-30');

  for (const locale of ['en', 'zh'] as const) {
    const text = [guide.intro[locale], ...guide.sections.map((section) => section.body[locale]),
      ...(guide.faqs ?? []).map((faq) => faq.answer[locale]),
      ...(guide.sources ?? []).map((source) => source.label[locale])].join('\n');
    assert.doesNotMatch(`${guide.title[locale]} ${guide.description[locale]}`, /翻倍|doubl(?:e|ed|ing)/i);
    assert.doesNotMatch(text, /凌晨|early 2026-10-30|15 hours ago|15:50/i);
    assert.doesNotMatch(text, /\[[^\]]+\]\([^)]+\)|^> /m, 'draft markup must not reach plain-text rendering');
    assert.match(text, /139,508,475/);
    assert.match(text, /111,606,780/);
    assert.match(text, /186,011,300/);
    assert.match(text, /274,225,750/);
    assert.match(text, /2026-10-29/);
    assert.match(guide.intro[locale], locale === 'zh'
      ? /9 月 29 日之后的原额度档位未核实/ : /allowance tier after September 29 has not been verified/);
    assert.match(guide.faqs![0].answer[locale], locale === 'zh'
      ? /既不能证明也不能否定官方说法/ : /neither prove nor disprove/);
    const metadata = buildMetadata({ locale, path: `/guides/${guide.slug}`, title: guide.title, description: guide.description });
    assert.equal(metadata.alternates?.canonical, `https://aiplans.dev/${locale}/guides/${guide.slug}`);
  }
});

test('Codex benchmark links retain official evidence, aiplans reports and locale-specific canonical paths', () => {
  const guide = PRICING_GUIDES['codex-pro-200-quota-benchmark'];
  assert.deepEqual(guide.sourcesTitle, {
    en: 'Sources, measurement reports and review date', zh: '来源、实测报告与核对日期',
  });
  const sources = new Set(guide.sources?.map((source) => source.url));
  for (const url of [
    'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers',
    'https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex',
    'https://x.com/thsottiaux/status/2115850175868727621',
    'https://x.com/thsottiaux/status/2104951965184925941',
    'https://developers.openai.com/codex/pricing',
    'https://aiplans.dev/reports/codex-models-2026-10-30.md',
    'https://aiplans.dev/reports/codex-models-2026-10-28.md',
  ]) assert.ok(sources.has(url), `missing source: ${url}`);
  for (const source of guide.sources ?? []) {
    if (new URL(source.url).hostname !== 'help.openai.com') continue;
    for (const locale of ['en', 'zh'] as const) assert.match(source.label[locale], /2026-10-30/);
  }
  for (const locale of ['en', 'zh'] as const) {
    const links = new Set(guide.relatedLinks?.map((link) => link.url[locale]));
    for (const path of [
      '/providers/openai#chatgpt-pro-200', '/models/openai-gpt-6-astra', '/models/openai-gpt-6-1-sol',
      '/compare/plans/openai-gpt-6-astra', '/compare/plans/openai-gpt-6-1-sol',
      '/quota-bench', '/guides/openai-api-pricing',
    ]) assert.ok(links.has(`/${locale}${path}`), `missing ${locale} link: ${path}`);
    assert.ok(links.has('/reports/codex-models-2026-10-30.json'));
    for (const url of links) assert.ok(url.startsWith(`/${locale}/`) || url.startsWith('/reports/'));
  }
});

test('every guide has reviewed sources, at least three FAQs and complete bilingual text', () => {
  const checkText = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      assert.ok(value.trim().length > 0, `empty text at ${path}`);
      assert.doesNotMatch(value, /最低价|the cheapest/i, `unsupported price claim at ${path}`);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => checkText(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      if ('en' in value || 'zh' in value) {
        for (const locale of ['en', 'zh'] as const) {
          assert.ok(locale in value, `missing ${locale} at ${path}`);
          const localizedText: unknown = (value as Record<string, unknown>)[locale];
          assert.ok(typeof localizedText === 'string', `invalid ${locale} at ${path}`);
          assert.ok(localizedText.trim().length > 0, `empty ${locale} at ${path}`);
        }
      }
      Object.entries(value).forEach(([key, item]) => checkText(item, `${path}.${key}`));
    }
  };
  for (const slug of PRICING_GUIDE_SLUGS) {
    const guide = PRICING_GUIDES[slug];
    assert.ok(guide.sources && guide.sources.length >= 1, `missing sources for ${slug}`);
    const reviewedAt = slug === 'codex-pro-200-quota-benchmark' ? '2026-10-30'
      : slug === 'claude-anthropic-pricing' ? '2026-10-18' : '2026-10-13';
    assert.equal(guide.reviewedAt, reviewedAt);
    assert.ok(guide.reviewedAt && Number.isFinite(Date.parse(guide.reviewedAt)));
    assert.ok(guide.faqs && guide.faqs.length >= 3, `missing FAQs for ${slug}`);
    guide.sources.forEach((source) => assert.equal(new URL(source.url).protocol, 'https:'));
    checkText(guide, slug);
  }
});

test('Cursor is a static subscription guide with related-model patterns; empty patterns never load model prices', async () => {
  const guide = PRICING_GUIDES['cursor-x-subscription-pricing'];
  assert.equal(guide.priceTable, false);
  assert.deepEqual(guide.queryPatterns, ['%grok%', 'claude-%', 'gpt-%']);
  assert.deepEqual(guide.providerSlugs, ['xai']);
  assert.ok(guide.planTable && guide.planTable.length > 0);
  assert.equal(guide.faqs?.length, 4);
  assert.deepEqual(await getPricingGuideModels({ ...PRICING_GUIDES['openai-api-pricing'], queryPatterns: [] }), []);
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

test('guide examples and cheapest selection use scheduled regular prices after introductory expiry', () => {
  const prices = [row({ provider_slug: 'google', input_price: 2, output_price: 10,
    promo_ends_at: '2026-12-01T08:00:00Z', regular_input_price_per_1m: 4, regular_output_price_per_1m: 20 }),
    row({ provider_slug: 'other', input_price: 3, output_price: 15 })];
  assert.equal(summarizeGuidePrices(prices, new Date('2026-12-01T07:59:59Z'))[0].cheapest.providerSlug, 'google');
  const after = summarizeGuidePrices(prices, new Date('2026-12-01T08:00:00Z'))[0];
  assert.equal(after.cheapest.providerSlug, 'other');
  assert.equal(after.exampleCostUsd, 6.75);
});

test('Claude guide reflects subscriber API credits from the official doc', () => {
  const guide = PRICING_GUIDES['claude-anthropic-pricing'];
  const text = JSON.stringify(guide);
  assert.doesNotMatch(text, /订阅通常不包含通用 API 额度|does not normally include general-purpose API credits/);
  for (const needle of ['100 美元', '200 美元', '500 美元', '$100', '$200', '$500', 'Claude Code', '不滚存', 'no rollover']) assert.ok(text.includes(needle), needle);
  assert.ok(guide.sources?.some(s => s.url === 'https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers'));
});
