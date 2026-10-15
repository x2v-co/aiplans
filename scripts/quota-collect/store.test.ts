import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { loadHistory, persistSamples } from './store';
import type { Sample } from './types';

const sample: Sample = {
  planSlug: 'chatgpt-pro', collector: 'codex-log', accountLabel: 'paid-a',
  observedAt: '2026-01-10T10:00:00.000Z', window: '5h', windowMinutes: 300,
  resetsAt: '2026-01-10T15:00:00.000Z', usedPct: 10, model: 'gpt-5-codex',
  tokensInput: 100, tokensCached: 800, tokensCacheWrite: 0, tokensOutput: 20, tokensReasoning: 5,
  raw: { source: 'token_count', eventId: 'synthetic-event' }, confidence: 'high',
};

function fakeDatabase(execute: (text: string, values: unknown[]) => unknown) {
  const events: string[] = [];
  const client = Object.assign((query: unknown, ...values: unknown[]) => {
    if (!Array.isArray(query) || !('raw' in query)) return query; // postgres insert helper.
    return Promise.resolve(execute(query.join('?'), values));
  }, {
    json(value: unknown) { return { jsonParameter: value }; },
    async begin(fn: (sql: Sql) => Promise<void>) {
      events.push('begin');
      try { await fn(client as unknown as Sql); events.push('commit'); }
      catch (error) { events.push('rollback'); throw error; }
    },
  });
  return { sql: client as unknown as Sql, events };
}

test('apply binds sanitized values and JSON, batches under one transaction and guards plan remapping', async () => {
  const batches: number[] = [];
  const db = fakeDatabase((text, values) => {
    assert.match(text, /INSERT INTO quota_usage_samples/);
    assert.match(text, /ON CONFLICT \(collector, account_label, observed_at, "window"\)/);
    assert.match(text, /WHERE quota_usage_samples.plan_slug = EXCLUDED.plan_slug/);
    assert.doesNotMatch(text, /chatgpt-pro|paid-a|quota_evidence|quota_estimates/);
    const rows = values[0] as Array<Record<string, unknown>>;
    assert.equal(rows[0].tokens_input, 100);
    assert.deepEqual(rows[0].raw, { jsonParameter: sample.raw });
    batches.push(rows.length);
    return rows.map((_, id) => ({ id }));
  });
  const samples = Array.from({ length: 251 }, (_, i) => ({ ...sample, observedAt: new Date(Date.parse(sample.observedAt) + i).toISOString() }));
  await persistSamples(db.sql, samples);
  assert.deepEqual(batches, [250, 1]);
  assert.deepEqual(db.events, ['begin', 'commit']);
  const conflicting = fakeDatabase(() => []);
  await assert.rejects(persistSamples(conflicting.sql, [sample]), /plan differs/);
  assert.deepEqual(conflicting.events, ['begin', 'rollback']);
});

test('history reads only current collector/account pairs with seven-day baseline and validates precision', async () => {
  const queries: unknown[][] = [];
  const stored = {
    plan_slug: sample.planSlug, collector: sample.collector, account_label: sample.accountLabel,
    observed_at: sample.observedAt, window: sample.window, window_minutes: 300,
    resets_at: sample.resetsAt, used_pct: 10, model: sample.model,
    tokens_input: 100, tokens_cached: 800, tokens_cache_write: 0, tokens_output: 20, tokens_reasoning: 5,
    raw: sample.raw, confidence: 'high',
  };
  const db = fakeDatabase((text, values) => {
    assert.match(text, /WHERE collector = \? AND account_label = \?/);
    assert.doesNotMatch(text, /INSERT|UPDATE/);
    queries.push(values);
    return [stored];
  });
  assert.deepEqual(await loadHistory(db.sql, [sample, sample]), [sample]);
  assert.deepEqual(queries, [['codex-log', 'paid-a', '2026-01-03', '2026-01-11']]);
  stored.tokens_input = Number.MAX_SAFE_INTEGER + 1;
  await assert.rejects(loadHistory(db.sql, [sample]), /safe integer/);
});
