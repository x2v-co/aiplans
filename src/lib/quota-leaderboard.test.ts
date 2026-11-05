import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMultiple, leaderboard, QUOTA_LEADER_ROWS, WEEKS_PER_MONTH, type LeaderRow } from './quota-leaderboard';
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

test('unverified tier gets no multiple and sorts last', () => {
  const cursor = QUOTA_LEADER_ROWS.find(r => r.id === 'cursor-legacy-month')!;
  assert.equal(cursor.tierVerified, false);
  assert.equal(feeMultiple(cursor), null);
  const mixed = leaderboard('month', 'mixed');
  assert.equal(mixed.at(-1)!.id, 'cursor-legacy-month');
});

test('boards never mix workload mixes and sort by multiple by default', () => {
  const rows = leaderboard('month', 'output');
  assert.ok(rows.every(r => r.mix === 'output'));
  const week = leaderboard('week', 'mixed');
  assert.equal(week[0].id, 'x-ultra-week');
});

test('sorting by USD and fee multiple reverses rows when value and fee warrant it', () => {
  const base = QUOTA_LEADER_ROWS.find(r => r.id === 'codex-pro-month')!;
  const fixtures: LeaderRow[] = [
    { ...base, id: 'higher-value', feeUsdMonthly: 200, usd: { low: 900, mid: 1000, high: 1100 } },
    { ...base, id: 'higher-multiple', feeUsdMonthly: 20, usd: { low: 90, mid: 200, high: 300 } },
    { ...base, id: 'unverified', tierVerified: false, usd: { low: 1900, mid: 2000, high: 2100 } },
    { ...base, id: 'other-mix', mix: 'mixed' },
  ];
  const original = fixtures.map(r => r.id);
  assert.deepEqual(leaderboard('month', 'input', 'multiple', fixtures).map(r => r.id), ['higher-multiple', 'higher-value', 'unverified']);
  assert.deepEqual(leaderboard('month', 'input', 'usd', fixtures).map(r => r.id), ['unverified', 'higher-value', 'higher-multiple']);
  assert.deepEqual(fixtures.map(r => r.id), original, 'sort must not mutate its source');
});

test('published weekly input board changes order between fee multiple and USD', () => {
  assert.deepEqual(leaderboard('week', 'input', 'multiple').map(r => r.id), ['volcengine-pro-week', 'codex-pro-week']);
  assert.deepEqual(leaderboard('week', 'input', 'usd').map(r => r.id), ['codex-pro-week', 'volcengine-pro-week']);
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
    assert.ok(leaderboard(window, 'input').includes(row));
  }
  const month = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-month')!;
  const week = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-week')!;
  assert.notEqual(month.usd.mid, week.usd.mid * WEEKS_PER_MONTH);
  assert.equal(Math.round(feeMultiple(month)!.mid), 22);
});

test('five-hour board always uses absolute value, including default sort', () => {
  const base = QUOTA_LEADER_ROWS.find(r => r.id === 'volcengine-pro-5h')!;
  const fixtures = [base, { ...base, id: 'larger-5h', usd: { low: 100, mid: 200, high: 300 } }];
  assert.deepEqual(leaderboard('5h', 'input', 'multiple', fixtures).map(r => r.id), ['larger-5h', base.id]);
  assert.equal(feeMultiple(base), null);
});
