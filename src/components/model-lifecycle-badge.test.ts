import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { ModelLifecycleBadge } from './model-lifecycle-badge';

function render(locale: 'en' | 'zh', shutdownDate: string | null, replacement?: string | null) {
  return renderToStaticMarkup(jsx(NextIntlClientProvider, {
    locale, timeZone: 'UTC', messages: locale === 'en' ? en : zh,
    children: createElement(ModelLifecycleBadge, { shutdownDate, replacement }),
  }));
}

test('lifecycle badge shows the shutdown day and the recommended replacement in both locales', () => {
  const enHtml = render('en', '2026-11-15', '@cf/deepgram/nova-3');
  assert.match(enHtml, /November 15, 2026/);
  assert.match(enHtml, /recommended replacement: @cf\/deepgram\/nova-3/);
  const zhHtml = render('zh', '2026-11-15', '@cf/black-forest-labs/flux-2-klein-9b');
  assert.match(zhHtml, /2026年11月15日/);
  assert.match(zhHtml, /推荐替代模型：@cf\/black-forest-labs\/flux-2-klein-9b/);
  assert.equal(render('en', null, '@cf/deepgram/nova-3'), '');
  assert.doesNotMatch(render('zh', '2026-11-15', null), /推荐替代/);
});
