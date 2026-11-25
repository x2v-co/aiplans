import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CitablePriceDownload } from './citable-price-download';

test('both locales describe the citation sample without a republication license or a fixed catalog size', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = renderToStaticMarkup(createElement(CitablePriceDownload, { locale }));
    assert.match(html, /\/api\/citable-prices\?format=json/);
    assert.match(html, /\/api\/citable-prices\?format=csv/);
    assert.match(html, new RegExp(`/${locale}/methodology`));
    assert.equal(html.includes('497'), false);
    assert.equal(html.includes('711'), false);
    assert.equal(html.includes('全网最低'), false);
    assert.equal(html.toLowerCase().includes('cc0-1.0'), false);
    assert.equal(html.toLowerCase().includes('mit license'), false);
    if (locale === 'zh') {
      assert.match(html, /下载不包含实时报价/);
      assert.match(html, /不就这些第三方价格授予 CC0、MIT/);
      assert.match(html, /更早的快照文件不在这里提供/);
    } else {
      assert.match(html, /contains no live quotes/);
      assert.match(html, /does not grant a CC0, MIT/);
      assert.match(html, /Earlier snapshot files are not kept here/);
    }
  }
});

test('radar and export commands stay local', () => {
  for (const file of ['scripts/price-change-radar.ts', 'scripts/export-citable-prices.ts']) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.equal(/\bfeishu\b|webhook|workflow_dispatch/i.test(source), false);
    assert.equal(source.includes('fetch('), false);
  }
});
