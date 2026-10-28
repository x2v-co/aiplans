import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaBenchResults } from './quota-bench-results';
import data from '../../public/reports/quota-bench-2026-10.json';

test('published measurements preserve native windows and withhold unreconciled capacity', () => {
  const codex = data.records.find(r => r.id === 'codex-pro')!;
  assert.equal(codex.window, 'weekly');
  assert.equal(codex.tierVerified, false);
  assert.equal(codex.tokens.input + codex.tokens.cacheRead + codex.tokens.output, 3363758);
  const control = codex.controlTokens!;
  const total = codex.tokens.input + codex.tokens.cacheRead + codex.tokens.output + control.input + control.cacheRead + control.output;
  assert.equal(codex.estimate!.mid, total / .05);
  assert.equal(data.records.find(r => r.id === 'cursor-ultra')!.estimate, null);
  assert.equal(data.records.find(r => r.id === 'volcengine-pro')!.window, '5h');
});

test('both locales show caveats, controller accounting and downloadable evidence', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaBenchResults, { locale }));
    for (const value of ['147,495,716', '221,243,575', '5,447,936', '/reports/quota-bench-2026-10.json', '/reports/quota-bench-2026-10.md']) assert.ok(html.includes(value), value);
    assert.ok(html.includes(locale === 'zh' ? 'Pro 子档未核验' : 'Pro sub-tier unverified'));
    assert.ok(html.includes(locale === 'zh' ? '待核对' : 'Pending reconciliation'));
    assert.doesNotMatch(html, /\/Users\/|account_id|AUTH_TOKEN|COOKIE/);
  }
});
