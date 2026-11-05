import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMultiple, leaderboard, QUOTA_LEADER_ROWS, WEEKS_PER_MONTH } from './quota-leaderboard';

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
