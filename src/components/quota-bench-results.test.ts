import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaBenchResults } from './quota-bench-results';
import data from '../../public/reports/quota-bench-2026-10.json';

test('published measurements preserve native windows and scope conditional capacity', () => {
  const codex = data.records.find(r => r.id === 'codex-pro')!;
  assert.equal(codex.window, 'weekly');
  assert.equal(codex.tierVerified, true);
  assert.equal(codex.planSlug, 'chatgpt-pro-200');
  assert.equal(codex.tierVerification!.source, 'account_owner_confirmation');
  assert.equal(codex.tierVerification!.priceUsdPerMonth, 200);
  assert.equal(codex.tokens.input + codex.tokens.cacheRead + codex.tokens.output, 2595323);
  assert.equal(codex.controlTokens, null);
  assert.equal(codex.estimate!.mid, Math.round(2595323 / .03));
  const cursor = data.records.find(r => r.id === 'cursor-ultra')!;
  assert.equal(cursor.status, 'conditional');
  assert.equal(cursor.estimate!.mid, 5454149660);
  assert.equal(cursor.estimateBasis!.calls, 12);
  assert.equal(cursor.tierVerified, false);
  assert.equal(cursor.planSlug, null);
  assert.equal(cursor.tierVerification!.source, 'unverified');
  assert.equal(cursor.measurementReport, '/reports/quota-bench-2026-10.md');
  assert.equal(cursor.measurementData, '/reports/quota-bench-2026-10-ledger.json');
  assert.equal(data.records.find(r => r.id === 'volcengine-pro')!.window, '5h');
});

test('both locales show caveats, controller accounting and downloadable evidence', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaBenchResults, { locale }));
    for (const value of ['64,883,075', '129,766,150', '6,679,074', '5,417,297,297–5,491,506,849', '$3,022', '$3,001–$3,042', '$0.444198', '$789', '$592–$1,184', '$23.676094', '2026-10-29', 'https://cursor.com/docs/models/cursor-composer-2-5', '/reports/quota-bench-2026-10.json', '/reports/quota-bench-2026-10.md', '/reports/quota-bench-2026-10-ledger.json']) assert.ok(html.includes(value), value);
    assert.ok(html.includes(locale === 'zh' ? '仅适用于 ChatGPT Pro 200' : 'Applies only to ChatGPT Pro 200'));
    const phrases = locale === 'zh'
      ? ['有条件实测 · 非官方承诺 · 低置信度', '套餐档位：未核验', '有条件实测，非官方承诺', '第 4 批未计入', 'CSV 未对账', '重置点未核验', '套餐档位未核验']
      : ['Conditional measurement · not an official allowance · low confidence', 'Plan tier: unverified', 'Conditional measurement, not an official allowance', 'batch 4 excluded', 'CSV not reconciled', 'reset point not verified', 'plan tier unverified'];
    for (const phrase of phrases) assert.ok(html.includes(phrase), phrase);
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
