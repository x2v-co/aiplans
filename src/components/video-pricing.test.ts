import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { catalogForKind, type AiCatalogItem } from '../lib/ai-vertical-catalog';
import type { VerticalModelDetail } from '../lib/vertical-model-detail';
import { auditedPrice } from './audited-catalog';

const video = catalogForKind('video-model');
const omni = video.find(item => item.slug === 'gemini-omni-1-1-flash')!;
const seedance = video.find(item => item.slug === 'seedance')!;

// Render the real page components; only navigation and the DB module are stubbed.
function pageComponent<P>(name: string): ComponentType<P> {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } });
  const loaded = { exports: {} as { default: ComponentType<P> } };
  const execute = runInNewContext(`(function(require, module, exports) { ${outputText}\n})`);
  execute((id: string) => {
    if (id === '@/components/SiteHeader') return { default: () => null, __esModule: true };
    if (id === '@/lib/vertical-model-detail') return { verticalKindPath: () => 'video-models' };
    return require(id.startsWith('@/') ? fileURLToPath(new URL(`../${id.slice(2)}`, import.meta.url)) : id);
  }, loaded, loaded.exports);
  return loaded.exports.default;
}

test('video list and detail show token headline and a resolution-specific estimate in both locales', () => {
  const List = pageComponent<{ locale: string; kind: 'video-model'; initialCatalog: AiCatalogItem[] }>('vertical-landing-page');
  const Detail = pageComponent<{ locale: string; kind: 'video-model'; detail: VerticalModelDetail }>('vertical-model-detail-page');
  for (const locale of ['en', 'zh']) {
    // Use a local logo: this render runs without Next's remote image config.
    const item = { ...omni, providerLogoUrl: '/providers/google.ico' };
    for (const html of [
      renderToStaticMarkup(createElement(List, { locale, kind: 'video-model', initialCatalog: [item, { ...seedance, providerLogoUrl: '/providers/volcengine.ico' }] })),
      renderToStaticMarkup(createElement(Detail, { locale, kind: 'video-model', detail: {
        item, plans: [], usagePrices: [], benchmarks: [], source: 'catalog',
      } })),
    ]) {
      assert.match(html, locale === 'zh' ? /\$17\.50 \/ 百万视频输出 tokens/ : /\$17\.50 \/ 1M video output tokens/);
      assert.match(html, locale === 'zh' ? /≈\$0\.10 \/ 秒 \(推算, 720p, 5,792 tokens\/s\)/ : /≈\$0\.10 \/ second \(estimated, 720p, 5,792 tokens\/s\)/);
      assert.doesNotMatch(html, /\$17\.50 \/ (?:second|秒)/);
    }
    const facts = auditedPrice(seedance, locale);
    assert.match(facts, /^¥46\.00–¥51\.00 \/ /);
    assert.match(facts, /tokens/);
    assert.doesNotMatch(facts, /second|秒|\$/);
  }
});

test('estimates require a known positive token rate and resolution, and honor price status/currency', () => {
  assert.equal(omni.pricePerUnit! * omni.videoTokensPerSecond! / 1_000_000, 0.10136);
  for (const rate of [undefined, 0, -1, NaN, Infinity]) {
    assert.doesNotMatch(auditedPrice({ ...omni, videoTokensPerSecond: rate }, 'en'), /estimated|second/);
  }
  assert.doesNotMatch(auditedPrice({ ...omni, resolutionTier: undefined }, 'en'), /estimated|second/);
  assert.equal(auditedPrice({ ...omni, priceStatus: 'not-public' }, 'en'), 'Price not public');
  assert.equal(auditedPrice({ ...omni, priceStatus: 'needs-verification' }, 'zh'), '待核验');
  assert.match(auditedPrice({ ...omni, currency: 'CNY' }, 'en'), /≈¥0\.10 \/ second/);
  assert.doesNotMatch(auditedPrice({ ...omni, billingUnit: undefined, pricing: 'Contact provider' }, 'en'), /second/);
  assert.match(auditedPrice({ ...omni, billingUnit: 'per_token', videoTokensPerSecond: undefined }, 'en'), /\/ token$/);
  assert.equal(auditedPrice(video.find(item => item.slug === 'veo-3-1')!, 'en'), '$0.40 / second');
});

test('all token-priced video headlines and audit units use per_1m_tokens', () => {
  const tokenRows = video.filter(item => /token|\/1M/i.test(`${item.pricing} ${item.pricingUnit} ${item.unit}`));
  assert.deepEqual(tokenRows.map(item => item.slug).sort(), ['gemini-omni-1-1-flash', 'seedance']);
  for (const item of tokenRows) {
    assert.equal(item.billingUnit, 'per_1m_tokens', item.slug);
    assert.equal(item.pricingUnit, 'per_1m_tokens', item.slug);
    assert.match(auditedPrice(item, 'en'), /\/ 1M video output tokens/);
  }
});
