import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { ChannelTermsBadges } from './channel-terms-badges';
import { QUOTA_UNITS, type ChannelTermsFields } from '../lib/channel-terms';

function render(locale: 'en' | 'zh', terms?: ChannelTermsFields | null) {
  return renderToStaticMarkup(jsx(NextIntlClientProvider, {
    locale, timeZone: 'UTC', messages: locale === 'en' ? en : zh,
    children: createElement(ChannelTermsBadges, { terms }),
  }));
}

test('localized warning and quota badges render the note as an escaped tooltip', () => {
  for (const locale of ['en', 'zh'] as const) {
    const messages = locale === 'en' ? en : zh;
    for (const quota_unit of QUOTA_UNITS) {
      const html = render(locale, {
        data_for_discount: true, data_for_discount_note: 'Training <prompts> & outputs', quota_unit,
      });
      assert.ok(html.includes(messages.channelTerms.training));
      assert.ok(html.includes(messages.channelTerms.quota.replace('{unit}', messages.channelTerms.units[quota_unit])));
      assert.ok(html.includes('title="Training &lt;prompts&gt; &amp; outputs"'));
    }
  }
});

test('older rows render without badges and explicit false still allows a quota badge', () => {
  for (const locale of ['en', 'zh'] as const) {
    for (const terms of [undefined, null, {}, { data_for_discount: null, quota_unit: null }]) {
      assert.equal(render(locale, terms), '');
    }
    const html = render(locale, { data_for_discount: false, quota_unit: 'usd' });
    assert.match(html, /USD/);
    assert.ok(!html.includes((locale === 'en' ? en : zh).channelTerms.training));
    assert.ok(!render(locale, { data_for_discount: true }).includes('title='));
  }
});
