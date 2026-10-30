import assert from 'node:assert/strict';
import test from 'node:test';
import data from '../../public/reports/codex-models-2026-10-30.json';

test('upgrade retest reconciles known usage without treating failed calls as known zero consumption', () => {
  assert.equal(data.planSlug, 'chatgpt-pro-200');
  assert.deepEqual(data.records.map(r => [r.attempts, r.calls]), [[96,96],[96,94]]);
  for (const r of data.records) {
    assert.equal(r.ledger.length, r.attempts);
    assert.equal(r.ledger.filter(c => c.complete).length, r.calls);
    assert.equal(r.ledger.reduce((n,c)=>n+c.input+c.output+c.cacheRead+c.cacheWrite,0),r.totalTokens);
    assert.ok(r.ledger.filter(c=>!c.complete).every(c=>!c.usageKnown));
    assert.deepEqual(r.unavailableWindows,['5h','monthly']);
  }
  const astra = data.records[0];
  const b = astra.batches.find(b=>b.batch===astra.selectedBatch)!;
  assert.ok(b.controlQuiet && b.sameWindow && b.settledReadingsAgree && b.allCallsValid);
  const e = astra.estimate!;
  const t = Object.values(b.tokens).reduce((a,b)=>a+b,0);
  assert.equal(e.mid,Math.round(t/.04));
  assert.equal(e.low,Math.round(t/.05));
  assert.equal(e.high,Math.round(t/.03));
  const sol = data.records[1];
  assert.equal(sol.estimate,null);
  assert.equal(sol.lowerBound!.high,null);
  assert.equal(sol.lowerBound!.mid,null);
  assert.equal(sol.lowerBound!.low,Math.floor(sol.lowerBound!.tokens/.02));
  assert.equal(sol.lowerBound!.successfulCalls,59);
});
