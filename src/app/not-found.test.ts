import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Metadata } from 'next';
import RootNotFound, { metadata } from './not-found';
import LocalizedNotFound, { generateMetadata } from './[locale]/not-found';

function assertNotFoundMetadata(value: Metadata, title: string) {
  // An absolute title overrides the locale layout's homepage default/template.
  assert.deepEqual(value.title, { absolute: title });
  assert.deepEqual(value.robots, {
    index: false, follow: true, googleBot: { index: false, follow: true },
  });
}

test('root 404 has an absolute English title and noindex metadata', () => {
  assertNotFoundMetadata(metadata, 'Page not found | aiplans');
  assert.match(renderToStaticMarkup(createElement(RootNotFound)), /<h1>404<\/h1>/);
});

test('localized 404 titles override homepage metadata in both locales', async () => {
  for (const [locale, title] of [['en', 'Page not found | aiplans'], ['zh', '页面不存在 | aiplans']]) {
    assertNotFoundMetadata(await generateMetadata({ params: Promise.resolve({ locale }) }), title);
  }
  assert.match(renderToStaticMarkup(createElement(LocalizedNotFound)), /<h1[^>]*>404<\/h1>/);
});
