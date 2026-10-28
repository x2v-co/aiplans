import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaBenchResults } from './quota-bench-results';
import data from '../../public/reports/quota-bench-2026-10.json';

test('published measurements preserve native windows and withhold unreconciled capacity', () => {
  const codex = data.records.find(r => r.id === 'codex-pro')!;
  assert.equal(codex.window, 'weekly');
  assert.equal(codex.tierVerified, true);
  assert.equal(codex.planSlug, 'chatgpt-pro-200');
  assert.equal(codex.tierVerification!.source, 'account_owner_confirmation');
  assert.equal(codex.tierVerification!.priceUsdPerMonth, 200);
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
    assert.ok(html.includes(locale === 'zh' ? '仅适用于 ChatGPT Pro 200' : 'Applies only to ChatGPT Pro 200'));
    assert.ok(html.includes(locale === 'zh' ? '待核对' : 'Pending reconciliation'));
    assert.doesNotMatch(html, /\/Users\/|account_id|AUTH_TOKEN|COOKIE/);
  }
});

test('Volcengine three-window estimates reconcile to the same 30-call ledger', async () => {
  const evidence = (await import('../../public/reports/volcengine-three-windows-2026-10-28.json')).default;
  const record = data.records.find(r => r.id === 'volcengine-pro')!;
  assert.equal(evidence.ledger.length, 30);
  assert.equal(new Set(evidence.ledger.map(r => r.call)).size, 30);
  const tokens = evidence.ledger.reduce((sum, r) => sum + r.input + r.output + r.cacheRead + r.cacheWrite, 0);
  assert.equal(tokens, 1258698);
  assert.equal(tokens, record.tokens.input + record.tokens.output);
  assert.equal(record.windowMeasurements!.length, 3);
  for (const w of record.windowMeasurements!) {
    const delta = Math.round((w.usedAfter - w.usedBefore) * 100) / 100;
    assert.equal(w.estimate.mid, Math.round(tokens * 100 / delta));
    assert.ok(Math.abs(w.estimate.low - tokens * 100 / (delta + .01)) <= 1);
    assert.ok(Math.abs(w.estimate.high - tokens * 100 / (delta - .01)) <= 1);
  }
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaBenchResults, { locale }));
    assert.ok(html.includes('/reports/volcengine-three-windows-2026-10-28.md'));
    assert.ok(html.includes('/reports/volcengine-three-windows-2026-10-28.json'));
    assert.ok(html.includes(locale === 'zh' ? '月（粗估）' : 'month (rough)'));
  }
});
