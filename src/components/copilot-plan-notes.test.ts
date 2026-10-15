import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { CopilotPlanNotes } from './copilot-plan-notes';

test('Copilot source notes render in both locales and missing/older rows render nothing', () => {
  for (const locale of ['en', 'zh'] as const) {
    const messages = locale === 'en' ? en : zh;
    const render = (props: Parameters<typeof CopilotPlanNotes>[0]) => renderToStaticMarkup(jsx(NextIntlClientProvider, {
      locale, timeZone: 'UTC', messages, children: createElement(CopilotPlanNotes, props),
    }));
    for (const props of [{}, { slug: null, notes: null }, { slug: 'copilot-pro' }, { slug: 'copilot-pro', notes: ' ' }, { slug: 'other', notes: 'Other plan' }]) {
      assert.equal(render(props), '');
    }
    const html = render({ slug: 'copilot-pro', notes: 'Training <opt-out> & preview\n[needs-verification] multiplier' });
    assert.ok(html.includes(messages.copilotPlan.notes));
    assert.ok(html.includes('Training &lt;opt-out&gt; &amp; preview'));
    assert.ok(html.includes('[needs-verification] multiplier'));
  }
});
