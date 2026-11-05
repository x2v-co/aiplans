import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaLeaderboard } from './quota-leaderboard';
import { QUOTA_LEADER_ROWS, rankLeaderboard, type LeaderRow } from '../lib/quota-leaderboard';

const rowIds = (html: string) => [...html.matchAll(/data-row="([^"]+)"/g)].map(match => match[1]);

test('default board is one ranked list with visible ranks and no same-order cue', () => {
  for (const locale of ['zh', 'en']) {
    const html = renderToStaticMarkup(createElement(QuotaLeaderboard, { locale }));
    const ranked = rankLeaderboard('month', 'multiple');
    assert.equal(html.split('<table').length - 1, 1);
    assert.match(html, /role="status" aria-live="polite"/);
    assert.match(html, /aria-sort="descending"/);
    assert.deepEqual(rowIds(html), [...ranked.ranked.map(row => row.id), ...ranked.unverified.map(row => row.id)]);
    assert.match(html, /data-rank="1"/);
    assert.match(html, /data-rank="2"/);
    assert.match(html, /data-rank="3"/);
    assert.ok(html.includes(locale === 'zh' ? '全表名次按' : 'Ranked by '));
    assert.ok(html.includes(locale === 'zh' ? '第 1 名 Claude Pro' : '#1 Claude Pro'));
    assert.ok(html.includes(locale === 'zh' ? '>输出为主<' : '>Output-heavy<'));
    assert.ok(html.includes(locale === 'zh' ? '不参与当前名次' : 'Not ranked on this metric'));
    assert.ok(html.includes(locale === 'zh' ? '从高到低' : 'High to low'));
    assert.ok(html.includes(locale === 'zh' ? '从低到高' : 'Low to high'));
    assert.match(html, /aria-pressed="true"[^>]*>/);
    assert.ok(html.includes(locale === 'zh' ? '月费倍数 ↓' : 'Fee multiple ↓'));
    assert.ok(!html.includes('↑'));
    assert.ok(!html.includes('组内排序'));
    assert.ok(!html.includes('Within each workload'));
    assert.ok(!html.includes('不混排'));
    assert.ok(!html.includes('ranked separately'));
    assert.ok(!html.includes(locale === 'zh' ? '两种指标名次相同' : 'Both metrics give the same ranks'));
    assert.ok(html.includes('Volcengine Coding Plan Pro'));
    assert.ok(html.includes('/reports/volcengine-api-valuation-2026-11-05.md'));
    const volcengineRow = html.match(/<tr[^>]*data-row="volcengine-pro-month"[\s\S]*?<\/tr>/)![0];
    assert.ok(volcengineRow.includes(locale === 'zh' ? '粗估' : 'rough'));
    assert.ok(!volcengineRow.includes('4.35'), 'native monthly estimate must not be labeled as weekly extrapolation');
    const cursorRow = html.match(/<tr[^>]*data-row="cursor-legacy-month"[\s\S]*?<\/tr>/)![0];
    assert.ok(cursorRow.includes('Cursor Ultra (legacy)'));
    assert.ok(cursorRow.includes('—'));
    assert.ok(!cursorRow.includes(locale === 'zh' ? '档位未核验' : 'tier unverified'));
    assert.ok(html.includes(locale === 'zh' ? '旧套餐 Cursor Ultra 已由账号持有人确认为 Ultra' : 'Legacy Cursor Ultra is account-owner confirmed as Ultra'));
    assert.match(cursorRow, /data-unranked="true"/);
    assert.ok(!cursorRow.includes('data-rank='));
    assert.ok(html.includes('6.90'));
    assert.ok(html.includes(locale === 'zh' ? '有条件实测 · 非官方额度' : 'Conditional measurement · not an official allowance'));
    assert.ok(html.includes(locale === 'zh' ? '同一窗口按所选指标排成一张名次表' : 'Each window is one list ranked by the selected metric'));
  }
});

test('matching metrics still show ranks and only then a short same-order cue', () => {
  const base = QUOTA_LEADER_ROWS.find(row => row.id === 'codex-pro-month')!;
  const rows: LeaderRow[] = [
    { ...base, id: 'a', plan: 'Plan A', feeUsdMonthly: 10, usd: { low: 180, mid: 200, high: 220 } },
    { ...base, id: 'b', plan: 'Plan B', feeUsdMonthly: 20, usd: { low: 90, mid: 100, high: 110 } },
  ];
  const html = renderToStaticMarkup(createElement(QuotaLeaderboard, { locale: 'zh', rows }));
  assert.match(html, /data-rank="1"/);
  assert.match(html, /data-rank="2"/);
  assert.ok(html.includes('#1'));
  assert.ok(html.includes('#2'));
  assert.ok(html.includes('两种指标名次相同。'));
  assert.ok(!html.includes('组内排序'));
  assert.deepEqual(rowIds(html), ['a', 'b']);
});
