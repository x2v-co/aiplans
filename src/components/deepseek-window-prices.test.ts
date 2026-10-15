import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { DeepSeekWindowPrices } from './deepseek-window-prices';
import type { ChannelPriceVariant } from '../lib/grouped-products';

const variants: ChannelPriceVariant[] = ['peak', 'off-peak'].map((window, i) => ({
  id: i, variant_key: window, variant_name: window, variant_kind: 'time_window', is_headline: i === 0,
  input_price_per_1m: 0.3 / (i + 1), output_price_per_1m: 1.2 / (i + 1), cached_input_price_per_1m: 0.006 / (i + 1),
  currency: 'USD', price_unit: 'per_1m_tokens', constraints_json: { time_window: window, peak_schedule: 'verified' },
}));
function render(locale: 'en' | 'zh', rows?: ChannelPriceVariant[] | null) {
  return renderToStaticMarkup(jsx(NextIntlClientProvider, { locale, timeZone: 'UTC', messages: locale === 'en' ? en : zh,
    children: createElement(DeepSeekWindowPrices, { variants: rows }),
  }));
}
test('both locales label the peak list and show every rate with the UTC schedule tooltip', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = render(locale, variants);
    const messages = (locale === 'en' ? en : zh).deepseekWindows;
    assert.ok(html.includes(messages.label));
    assert.ok(html.includes(messages.list));
    for (const value of ['0.006', '0.003', '0.15', '0.30', '0.60', '1.20']) assert.ok(html.includes(value), value);
    assert.ok(html.includes(`title="${messages.window.replaceAll('&', '&amp;')}"`));
  }
});
test('missing rows, metadata, and unverified OpenCode schedules render gracefully', () => {
  for (const rows of [undefined, null, [], [variants[0]], variants.map(v => ({ ...v, constraints_json: null }))]) assert.equal(render('en', rows), '');
  assert.ok(render('en', variants.map(v => ({ ...v, cached_input_price_per_1m: null }))).includes('—'));
});
