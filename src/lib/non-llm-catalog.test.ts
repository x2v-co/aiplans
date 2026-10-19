import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NON_LLM_CATALOG } from './non-llm-catalog';
import { catalogForKind } from './ai-vertical-catalog';
import { NonLlmCatalog, NonLlmFacts } from '../components/non-llm-catalog';

const item = (slug: string) => NON_LLM_CATALOG.find(entry => entry.slug === slug)!;

test('verified tariffs retain their actual units, aliases and lifecycle dates', () => {
  assert.deepEqual(item('grok-voice-3.0').usageRates?.map(rate => [rate.unit, rate.price]), [['minute', 0.08], ['per_1m_characters', 15]]);
  assert.match(item('grok-voice-3.0').notes!, /grok-voice-latest → grok-voice-3.0/);
  assert.equal(item('grok-voice-2.0').deprecatedAt, undefined);
  assert.equal(item('grok-voice-2.0').replacementModel, 'grok-voice-3.0');
  assert.match(item('grok-voice-2.0').notes!, /Deprecated/);
  assert.equal(item('grok-voice-2.0').status, 'deprecated');
  assert.equal(item('grok-voice-2.0').shutdownDate, undefined);
  assert.equal(item('grok-voice-transcribe-1.0').shutdownDate, '2026-10-02');
  assert.equal(item('grok-voice-transcribe-1.0').replacementModel, 'grok-voice-transcribe-2.0');
  assert.deepEqual(item('grok-voice-transcribe-2.0').usageRates?.map(rate => [rate.unit, rate.price]), [['hour', 0.1], ['hour', 0.2]]);
  for (const version of ['1.14.0', '1.13.0']) {
    const jev = item(`jev-${version}`);
    assert.equal(jev.inputPricePer1M, 0.042);
    assert.equal(jev.outputPricePer1M, 0);
    assert.equal(jev.contextWindow, 64000);
    assert.match(jev.contextWindowLabel!, /262k/);
    assert.match(jev.notes!, /jev-latest → jev-1.13.0; jev-preview → jev-1.14.0/);
    assert.equal(jev.needsVerification, undefined);
    assert.match(jev.notes!, /no jev-latest switch date is published/);
  }
  for (const [suffix, input, output] of [['', 5, 38], ['-flash', 1.75, 19]] as const) {
    const mai = item(`microsoft-mai-image-2.6${suffix}`);
    assert.equal(mai.inputPricePer1M, input);
    assert.equal(mai.outputPricePer1M, output);
    assert.equal(mai.pricingChannel, 'Vercel AI Gateway');
    assert.equal(mai.releasedAt, '2026-10-13');
  }
  assert.equal(item('microsoft-mai-image-2.6').usageRates?.find(rate => rate.unit === 'image')?.approximate, true);
  assert.ok(!item('microsoft-mai-image-2.6-flash').usageRates?.some(rate => rate.unit === 'image'));
  const moondream = item('moondream-cloud');
  assert.equal(moondream.shutdownDate, '2026-11-13');
  assert.equal(moondream.deprecatedAt, '2026-11-13');
  assert.equal(moondream.priceStatus, 'priced');
  assert.equal(moondream.usageRates?.length, 9);
  assert.match(moondream.notes!, /refunded; models stay open/);
  const matrix = catalogForKind('world-model').find(entry => entry.slug === 'skywork-matrix-game-4')!;
  assert.equal(matrix.license, 'Apache-2.0');
  assert.ok(matrix.access?.includes('open-weights'));
  assert.equal(matrix.priceStatus, 'not_applicable');
  assert.equal(matrix.pricePerUnit, undefined);
});

test('voice and image lists/details render units, channel and lifecycle in both locales without DB data', () => {
  for (const locale of ['en', 'zh']) {
    for (const kind of ['voice-model', 'image-model'] as const) {
      const entries = catalogForKind(kind);
      const html = renderToStaticMarkup(createElement(NonLlmCatalog, { items: entries, locale }));
      for (const entry of entries) assert.ok(html.includes(`/${locale}/${kind}s/${entry.slug}`));
      assert.match(html, /2026-10-15/);
    }
    const voice = renderToStaticMarkup(createElement(NonLlmFacts, { item: item('grok-voice-3.0'), locale }));
    assert.match(voice, /\$0.08/);
    assert.match(voice, locale === 'zh' ? /百万字符/ : /1M characters/);
    const image = renderToStaticMarkup(createElement(NonLlmFacts, { item: item('microsoft-mai-image-2.6'), locale }));
    assert.match(image, /Vercel AI Gateway/);
    assert.match(image, /≈\$0.01/);
    const lifecycle = renderToStaticMarkup(createElement(NonLlmFacts, { item: item('moondream-cloud'), locale }));
    assert.match(lifecycle, /2026-11-13/);
    assert.match(lifecycle, /\$0\.3 \//);
    const unverified = renderToStaticMarkup(createElement(NonLlmFacts, { item: { ...item('grok-voice-3.0'), priceStatus: 'needs-verification' }, locale }));
    assert.doesNotMatch(unverified, /\$0.08|\$15/);
    const empty = renderToStaticMarkup(createElement(NonLlmFacts, { item: { ...item('moondream-cloud'), verifiedAt: undefined, notes: undefined, shutdownDate: undefined }, locale }));
    assert.match(empty, /—/);
  }
});

test('both verticals have list/detail routes, localized navigation and static sitemap entries', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../components/SiteHeader.tsx', import.meta.url), 'utf8');
  for (const vertical of ['voice', 'image']) {
    assert.ok(sitemap.includes(`path: '/${vertical}-models'`));
    assert.ok(sitemap.includes(`'${vertical}-model'`));
    assert.ok(header.includes(`t('${vertical}Models')`));
    for (const path of [`${vertical}-models/page.tsx`, `${vertical}-models/[slug]/page.tsx`]) {
      assert.match(readFileSync(new URL(`../app/[locale]/${path}`, import.meta.url), 'utf8'), /generateMetadata/);
    }
  }
});
