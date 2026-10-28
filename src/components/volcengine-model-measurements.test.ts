import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../public/reports/volcengine-models-2026-10-28.json';
import { VolcengineModelMeasurements } from './volcengine-model-measurements';

test('each model reconciles to its own ledger and independently observed windows', () => {
  assert.deepEqual(data.records.map(r => r.model), ['deepseek-v4.1-flash', 'deepseek-v4-pro', 'glm-5.3', 'glm-5.3-flash']);
  for (const r of data.records) {
    assert.equal(r.ledger.length, r.calls);
    assert.equal(new Set(r.ledger.map(call => call.call)).size, r.calls);
    assert.ok(r.ledger.every(call => call.models.length === 1 && call.models[0] === r.servedModel));
    const total = r.ledger.reduce((sum, call) => sum + call.input + call.output + call.cacheRead + call.cacheWrite, 0);
    assert.equal(total, r.totalTokens);
    assert.equal(r.batches.reduce((sum, b) => sum + b.tokens, 0), total);
    assert.deepEqual(r.windows.map(w => w.window), ['5h', 'weekly', 'monthly']);
    for (const w of r.windows) {
      assert.equal(w.deltaPp, Math.round((w.usedAfter - w.usedBefore) * 100) / 100);
      assert.equal(w.mid, Math.round(total * 100 / w.deltaPp));
      assert.ok(Math.abs(w.low - total * 100 / (w.deltaPp + .01)) <= 1);
      assert.ok(Math.abs(w.high - total * 100 / (w.deltaPp - .01)) <= 1);
    }
    const end = r.meters.at(-1)!;
    const reread = r.meters.at(-2)!;
    assert.equal(end.afterCalls, r.calls);
    assert.deepEqual([end.used5h,end.usedWeek,end.usedMonth], [reread.used5h,reread.usedWeek,reread.usedMonth]);
  }
});

test('bilingual model comparison exposes all models with monthly and shared-pool qualifications', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(VolcengineModelMeasurements, { locale }));
    for (const r of data.records) assert.ok(html.includes(`data-measured-model="${r.model}"`));
    assert.ok(html.includes(locale === 'zh' ? '容量不能相加' : 'capacities cannot be added'));
    assert.ok(html.includes(locale === 'zh' ? '月（粗估）' : 'Month (rough)'));
    assert.ok(html.includes('/reports/volcengine-models-2026-10-28.md'));
    assert.ok(html.includes('/reports/volcengine-models-2026-10-28.json'));
    assert.doesNotMatch(html, /\/Users\/|AUTH_TOKEN|api_key/);
  }
});

test('GLM Flash pilot and long-input evidence remain separate without losing calls', () => {
  const glm = data.records.find(r => r.model === 'glm-5.3-flash')!;
  assert.equal(glm.calls, 20);
  assert.equal(glm.pilot!.calls, 4);
  assert.equal(glm.pilot!.windows.find(w => w.window === 'monthly')!.high, null);
  assert.ok(glm.ledger.every(call => call.input >= 160000));
  assert.ok(glm.pilot!.ledger.every(call => call.input < 50000));
  assert.equal(data.records.reduce((n, r) => n + r.calls + (r.pilot?.calls ?? 0), 0), 72);
  assert.equal(data.records.reduce((n, r) => n + r.totalTokens + (r.pilot?.totalTokens ?? 0), 0), 5451341);
});
