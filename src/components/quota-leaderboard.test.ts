import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaLeaderboard } from './quota-leaderboard';

test('both locales expose the active sort and explain identical monthly rankings', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaLeaderboard, { locale }));
    assert.match(html, /role="status" aria-live="polite"/);
    assert.match(html, /aria-sort="descending"/);
    assert.ok(html.includes(locale === 'zh' ? '当前窗口两种排序结果相同。' : 'Both sorts give the same order for this window.'));
    assert.ok(html.includes('Volcengine Coding Plan Pro'));
    assert.ok(html.includes('/reports/volcengine-api-valuation-2026-11-05.md'));
    const volcengineRow = html.match(/<tr[^>]*data-row="volcengine-pro-month"[\s\S]*?<\/tr>/)![0];
    assert.ok(volcengineRow.includes(locale === 'zh' ? '粗估' : 'rough'));
    assert.ok(!volcengineRow.includes('4.35'), 'native monthly estimate must not be labeled as weekly extrapolation');
    assert.ok(html.includes('6.90'));
    assert.ok(html.includes(locale === 'zh' ? '有条件实测 · 非官方额度' : 'Conditional measurement · not an official allowance'));
  }
});
