import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMultiple, leaderboardOrdersMatch, QUOTA_LEADER_ROWS, rankLeaderboard, WEEKS_PER_MONTH, type LeaderRow } from './quota-leaderboard';
import evidence from '../../public/reports/volcengine-three-windows-2026-10-28.json';
import valuation from '../../public/reports/volcengine-api-valuation-2026-11-05.json';
import { convertCurrency } from './currency';

test('Codex is on the monthly board as weekly × 4.35, marked rough', () => {
  const m = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-month')!;
  const w = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-week')!;
  assert.equal(m.rough, true);
  assert.equal(m.usd.mid, w.usd.mid * WEEKS_PER_MONTH);
  assert.equal(Math.round(feeMultiple(m)!.mid), Math.round(feeMultiple(w)!.mid));
});

test('monthly rows derived from weekly are marked rough', () => {
  const x = QUOTA_LEADER_ROWS.find(r => r.id === 'x-ultra-month')!;
  assert.equal(x.rough, true);
  assert.equal(Math.round(x.usd.mid), Math.round(1500 * WEEKS_PER_MONTH));
  for (const r of QUOTA_LEADER_ROWS.filter(r => r.id.startsWith('claude-pro-month'))) assert.equal(r.rough, true);
});

test('fee multiple: month = value / fee, week = value / (fee / 4.35), 5h none', () => {
  const claude = QUOTA_LEADER_ROWS.find(r => r.id === 'claude-pro-month-agentic')!;
  assert.equal(Math.round(feeMultiple(claude)!.mid), 70);
  const codex = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-week')!;
  assert.equal(Math.round(feeMultiple(codex)!.mid), Math.round(codex.usd.mid / (200 / WEEKS_PER_MONTH)));
  for (const r of QUOTA_LEADER_ROWS.filter(r => r.window === '5h')) assert.equal(feeMultiple(r), null);
});

test('legacy Cursor Ultra has no fee multiple and ranks only by absolute value', () => {
  const cursor = QUOTA_LEADER_ROWS.find(r => r.id === 'cursor-legacy-month')!;
  assert.equal(cursor.plan, 'Cursor Ultra (legacy)');
  assert.equal(cursor.mix, 'mixed');
  assert.equal(cursor.window, 'month');
  assert.equal(cursor.tierVerified, true);
  assert.equal(cursor.feeUsdMonthly, null);
  assert.equal(cursor.usd.mid, 3021.76);
  assert.equal(feeMultiple(cursor), null);
  const byMultiple = rankLeaderboard('month', 'multiple');
  assert.ok(byMultiple.ranked.every(row => row.id !== 'cursor-legacy-month'));
  assert.deepEqual(byMultiple.unverified.map(row => row.id), ['cursor-legacy-month']);
  assert.equal(rankLeaderboard('month', 'multiple', QUOTA_LEADER_ROWS, 'asc').unverified[0].id, 'cursor-legacy-month');
  const byUsd = rankLeaderboard('month', 'usd').ranked.map(row => row.id);
  assert.equal(byUsd[2], 'cursor-legacy-month');
  assert.equal(rankLeaderboard('month', 'usd', QUOTA_LEADER_ROWS, 'asc').ranked[3].id, 'cursor-legacy-month');
});

test('one window is a single ranked list across workload mixes', () => {
  const month = rankLeaderboard('month');
  assert.deepEqual(month.ranked.map(row => row.id), [
    'claude-pro-month-agentic',
    'claude-pro-month-output',
    'x-ultra-month',
    'codex-pro-month',
    'volcengine-pro-month',
  ]);
  assert.deepEqual([...new Set(month.ranked.map(row => row.mix))].sort(), ['agentic', 'input', 'mixed', 'output']);
  assert.equal(rankLeaderboard('week').ranked[0].id, 'claude-pro-week-agentic');
});

test('sorting by USD and fee multiple reverses the global list and leaves unverified unranked', () => {
  const base = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-month')!;
  const fixtures: LeaderRow[] = [
    { ...base, id: 'higher-value', feeUsdMonthly: 200, usd: { low: 900, mid: 1000, high: 1100 } },
    { ...base, id: 'higher-multiple', feeUsdMonthly: 20, usd: { low: 90, mid: 200, high: 300 } },
    { ...base, id: 'unverified', tierVerified: false, usd: { low: 1900, mid: 2000, high: 2100 } },
    { ...base, id: 'other-window', window: 'week' },
  ];
  const original = fixtures.map(r => r.id);
  assert.deepEqual(rankLeaderboard('month', 'multiple', fixtures).ranked.map(r => r.id), ['higher-multiple', 'higher-value']);
  assert.deepEqual(rankLeaderboard('month', 'usd', fixtures).ranked.map(r => r.id), ['higher-value', 'higher-multiple']);
  assert.deepEqual(rankLeaderboard('month', 'usd', fixtures).unverified.map(r => r.id), ['unverified']);
  assert.equal(feeMultiple(fixtures.find(row => row.id === 'unverified')!), null);
  assert.deepEqual(rankLeaderboard('month', 'multiple', fixtures).ranked.map(r => r.id).includes('other-window'), false);
  assert.deepEqual(fixtures.map(r => r.id), original, 'sort must not mutate its source');
});

test('published windows change order between fee multiple and absolute value', () => {
  assert.deepEqual(rankLeaderboard('month', 'usd').ranked.map(r => r.id), [
    'x-ultra-month',
    'codex-pro-month',
    'cursor-legacy-month',
    'claude-pro-month-agentic',
    'claude-pro-month-output',
    'volcengine-pro-month',
  ]);
  assert.deepEqual(rankLeaderboard('week', 'multiple').ranked.map(r => r.id), [
    'claude-pro-week-agentic',
    'volcengine-pro-week',
    'claude-pro-week-output',
    'x-ultra-week',
    'codex-pro-week',
  ]);
  assert.deepEqual(rankLeaderboard('week', 'usd').ranked.map(r => r.id), [
    'x-ultra-week',
    'codex-pro-week',
    'claude-pro-week-agentic',
    'volcengine-pro-week',
    'claude-pro-week-output',
  ]);
  assert.equal(leaderboardOrdersMatch('month'), false);
  assert.equal(leaderboardOrdersMatch('week'), false);
});

test('default direction is high to low and low to high reverses verified ranks', () => {
  const desc = rankLeaderboard('month', 'multiple').ranked.map(row => row.id);
  const asc = rankLeaderboard('month', 'multiple', QUOTA_LEADER_ROWS, 'asc').ranked.map(row => row.id);
  assert.equal(desc[0], 'claude-pro-month-agentic');
  assert.deepEqual(asc, [...desc].reverse());
  assert.equal(asc[0], 'volcengine-pro-month');
  const weekUsdDesc = rankLeaderboard('week', 'usd').ranked.map(row => row.id);
  assert.deepEqual(rankLeaderboard('week', 'usd', QUOTA_LEADER_ROWS, 'asc').ranked.map(row => row.id), [...weekUsdDesc].reverse());
  const fiveDesc = rankLeaderboard('5h').ranked.map(row => row.id);
  assert.deepEqual(rankLeaderboard('5h', 'usd', QUOTA_LEADER_ROWS, 'asc').ranked.map(row => row.id), [...fiveDesc].reverse());
  const base = QUOTA_LEADER_ROWS.find(row => row.id === 'codex-pro-month')!;
  const unverified: LeaderRow = { ...base, id: 'unverified', tierVerified: false, usd: { low: 1, mid: 2, high: 3 } };
  assert.equal(rankLeaderboard('month', 'usd', [unverified, base], 'asc').unverified[0].id, 'unverified');
  assert.deepEqual(rankLeaderboard('month', 'usd', [unverified, base], 'asc').ranked.map(row => row.id), ['codex-pro-month']);
});

test('identical metric orders stay ranked and are reported as the same order', () => {
  const base = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-month')!;
  const fixtures: LeaderRow[] = [
    { ...base, id: 'a', feeUsdMonthly: 10, usd: { low: 180, mid: 200, high: 220 } },
    { ...base, id: 'b', feeUsdMonthly: 20, usd: { low: 90, mid: 100, high: 110 } },
  ];
  assert.equal(leaderboardOrdersMatch('month', fixtures), true);
  assert.deepEqual(rankLeaderboard('month', 'multiple', fixtures).ranked.map(r => r.id), ['a', 'b']);
  assert.deepEqual(rankLeaderboard('month', 'usd', fixtures).ranked.map(r => r.id), ['a', 'b']);
  assert.equal(leaderboardOrdersMatch('5h', fixtures), false);
});

test('Volcengine values the actual ledger at sourced K3 list prices in each native window', () => {
  const sampleUsd = (evidence.tokens.input * 3 + evidence.tokens.output * 15) / 1_000_000;
  assert.equal(sampleUsd, 4.03083);
  assert.equal(valuation.model, 'kimi-k3');
  assert.equal(valuation.pricing.inputPerMillion, 3);
  assert.equal(valuation.pricing.outputPerMillion, 15);
  assert.equal(valuation.pricing.source, 'https://platform.kimi.ai/');
  assert.equal(valuation.planPrice.amount, 200);
  assert.equal(valuation.planPrice.catalogPlanSlug, 'seed-pro');
  for (const [window, source] of [['5h', '5h'], ['week', 'Week'], ['month', 'Month']] as const) {
    const row = QUOTA_LEADER_ROWS.find(r => r.id === `volcengine-pro-${window}`)!;
    const estimate = evidence.estimates[source];
    assert.equal(row.model, 'kimi-k3');
    assert.equal(row.mix, 'input');
    assert.equal(row.date, '2026-10-28');
    assert.equal(row.feeUsdMonthly, convertCurrency(200, 'CNY', 'USD'));
    assert.equal(row.tierVerified, true);
    assert.equal(row.confidence, 'low');
    assert.ok(Math.abs(row.usd.mid - sampleUsd * 100 / estimate.deltaPp) < 1e-10);
    assert.ok(Math.abs(row.usd.low - estimate.roundingLow * sampleUsd / evidence.totalTokens) < 1e-10);
    assert.ok(Math.abs(row.usd.high - estimate.roundingHigh * sampleUsd / evidence.totalTokens) < 1e-10);
    assert.equal(row.rough, window === 'month');
    assert.ok(!row.derivedFromWeek);
    assert.ok(rankLeaderboard(window, 'multiple').ranked.some(ranked => ranked.id === row.id));
  }
  const month = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-month')!;
  const week = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-week')!;
  assert.notEqual(month.usd.mid, week.usd.mid * WEEKS_PER_MONTH);
  assert.equal(Math.round(feeMultiple(month)!.mid), 22);
});

test('five-hour board always uses absolute value, including default sort', () => {
  const base = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-5h')!;
  const fixtures = [base, { ...base, id: 'larger-5h', usd: { low: 100, mid: 200, high: 300 } }];
  assert.deepEqual(rankLeaderboard('5h', 'multiple', fixtures).ranked.map(r => r.id), ['larger-5h', base.id]);
  assert.deepEqual(rankLeaderboard('5h').ranked.map(r => r.id), [
    'claude-pro-5h-agentic',
    'volcengine-pro-5h',
    'claude-pro-5h-output',
  ]);
  assert.equal(feeMultiple(base), null);
  assert.equal(leaderboardOrdersMatch('5h'), false);
});
