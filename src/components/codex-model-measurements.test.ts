import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../public/reports/codex-models-2026-10-28.json';
import { CodexModelMeasurements } from './codex-model-measurements';
import { codexQuotaCaveats, codexQuotaCopy, codexQuotaFaq } from '../lib/codex-pro200';

test('Codex retest reconciles successful calls and excludes mixed or changed windows', () => {
  assert.equal(data.planSlug, 'chatgpt-pro-200');
  assert.deepEqual(data.records.map(r => r.calls), [32, 72]);
  for (const r of data.records) {
    assert.equal(r.ledger.length, r.calls);
    assert.ok(r.ledger.every(c => c.complete && c.toolEvents === 0));
    assert.equal(r.ledger.reduce((n, c) => n + c.input + c.cacheRead + c.cacheWrite + c.output, 0), r.totalTokens);
    assert.deepEqual(r.unavailableWindows, ['5h', 'monthly']);
  }
  const astra = data.records[0];
  const b = astra.batches.find(b => b.batch === astra.selectedBatch)!;
  assert.equal(b.controllerQuiet, true);
  assert.equal(b.sameWindow, true);
  const e = astra.estimate!;
  assert.equal(e.totalTokens, Object.values(b.tokens).reduce((a, b) => a + b, 0));
  assert.equal(e.low, Math.round(e.totalTokens / .04));
  assert.equal(e.high, Math.round(e.totalTokens / .02));
  const sol = data.records[1];
  assert.equal(sol.estimate, null);
  assert.equal(sol.status, 'pending');
  const last = sol.batches.at(-1)!;
  assert.equal(last.sameWindow, false);
  assert.notEqual(last.meters.before[0].resetsAt, last.meters['after-settled'][0].resetsAt);
});

test('both locales show actual Sol usage without inventing capacity', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(CodexModelMeasurements, { locale }));
    for (const s of ['gpt-6-astra', 'gpt-6.1-sol', '8,729,647', '/reports/codex-models-2026-10-30.json']) assert.ok(html.includes(s));
    const copy = codexQuotaCopy(locale);
    for (const value of [copy.astraCapacity, copy.solCapacity, '2026-10-30', '/reports/codex-models-2026-10-28.md', ...codexQuotaCaveats(locale)]) assert.ok(html.includes(value), value);
    const sol = html.match(/<tr[^>]*data-measured-model="gpt-6.1-sol"[\s\S]*?<\/tr>/)![0];
    assert.ok(sol.includes(copy.solCapacity));
    assert.doesNotMatch(sol, /title=|点估计|上界|point estimate|upper bound|139\.5M|186\.0M|274,225,750/i);
    assert.doesNotMatch(html, /倍率|提升\s*[\dX]|\d+(?:\.\d+)?\s*倍|\d+(?:\.\d+)?\s*(?:x|×|times|fold)\b/i);
    assert.doesNotMatch(html, /\/Users\/|account_id|AUTH_TOKEN/);
  }
});

test('Sol model page and FAQ expose only its conditional lower bound in both locales', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(CodexModelMeasurements, { locale, modelSlug: 'gpt-6.1-sol' }));
    const faq = codexQuotaFaq(locale, 'gpt-6.1-sol');
    for (const text of [html, faq.answer]) {
      assert.ok(text.includes(codexQuotaCopy(locale).solCapacity));
      assert.doesNotMatch(text, /139\.5M|186\.0M|点估计|上界|point estimate|upper bound|倍率/i);
      for (const note of codexQuotaCaveats(locale)) assert.ok(text.includes(note));
    }
    assert.doesNotMatch(html, /data-measured-model="gpt-6-astra"/);
  }
});
