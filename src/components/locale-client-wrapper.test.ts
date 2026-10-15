import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LocaleClientWrapper from './locale-client-wrapper';
import { ChannelTermsBadges } from './channel-terms-badges';
import en from '../../messages/en.json';

test('next-intl client components render inside LocaleClientWrapper', () => {
  const child = h(ChannelTermsBadges, { terms: { data_for_discount: true, quota_unit: 'usd' } as never });
  const html = renderToStaticMarkup(h(LocaleClientWrapper, { locale: 'en', messages: en, children: child }));
  assert.ok(html.length > 0);
});
