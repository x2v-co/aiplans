import type { Sql } from 'postgres';
import { count, type Sample } from './types';

function dbRow(s: Sample) {
  return {
    plan_slug: s.planSlug, collector: s.collector, account_label: s.accountLabel,
    observed_at: s.observedAt, window: s.window, window_minutes: s.windowMinutes,
    resets_at: s.resetsAt, used_pct: s.usedPct,
    tokens_input: s.tokensInput, tokens_cached: s.tokensCached, tokens_cache_write: s.tokensCacheWrite,
    tokens_output: s.tokensOutput, tokens_reasoning: s.tokensReasoning,
    model: s.model, raw: s.raw, confidence: s.confidence,
  };
}
type Stored = ReturnType<typeof dbRow>;

/** Upserts make re-runs idempotent and allow ccusage's current daily total to grow.
 * Account-label remapping to another plan requires operator review, never silent overwrite.
 * A transaction covers the whole invocation. No evidence/estimate tables are modified.
 */
export async function persistSamples(sql: Sql, samples: Sample[]): Promise<void> {
  if (!samples.length) return;
  await sql.begin(async (transaction) => {
    const tx = transaction as unknown as Sql;
    for (let offset = 0; offset < samples.length; offset += 250) {
      const rows = samples.slice(offset, offset + 250).map((s) => ({ ...dbRow(s), raw: tx.json(s.raw) }));
      const updated = await tx<{ id: number }[]>`
        INSERT INTO quota_usage_samples ${tx(rows)}
        ON CONFLICT (collector, account_label, observed_at, "window") DO UPDATE SET
          window_minutes = EXCLUDED.window_minutes, resets_at = EXCLUDED.resets_at,
          used_pct = EXCLUDED.used_pct, tokens_input = EXCLUDED.tokens_input,
          tokens_cached = EXCLUDED.tokens_cached, tokens_cache_write = EXCLUDED.tokens_cache_write,
          tokens_output = EXCLUDED.tokens_output, tokens_reasoning = EXCLUDED.tokens_reasoning,
          model = EXCLUDED.model, raw = EXCLUDED.raw, confidence = EXCLUDED.confidence
        WHERE quota_usage_samples.plan_slug = EXCLUDED.plan_slug
        RETURNING id
      `;
      if (updated.length !== rows.length) throw new Error('Stored sample plan differs; review account-label/plan mapping before retrying');
    }
  });
}

/** Called only on --apply. Keep prior readings when local logs have been rotated. */
export async function loadHistory(sql: Sql, samples: Sample[]): Promise<Sample[]> {
  if (!samples.length) return [];
  const observed = samples.map((s) => Date.parse(s.observedAt));
  const since = new Date(observed.reduce((a, b) => Math.min(a, b)) - 7 * 86_400_000).toISOString().slice(0, 10);
  const until = new Date(observed.reduce((a, b) => Math.max(a, b)) + 86_400_000).toISOString().slice(0, 10);
  const pairs = [...new Map(samples.map((s) => [JSON.stringify([s.collector, s.accountLabel]), s])).values()];
  const rows: Stored[] = [];
  for (const pair of pairs) {
    rows.push(...await sql<Stored[]>`
      SELECT plan_slug, collector, account_label, observed_at::text, "window", window_minutes,
        resets_at::text, used_pct::float8,
        tokens_input::float8, tokens_cached::float8, tokens_cache_write::float8,
        tokens_output::float8, tokens_reasoning::float8, model, raw, confidence
      FROM quota_usage_samples
      WHERE collector = ${pair.collector} AND account_label = ${pair.accountLabel}
        AND observed_at >= ${since}::timestamptz AND observed_at < ${until}::timestamptz
      ORDER BY observed_at
    `);
  }
  return rows.map((s) => ({
    planSlug: s.plan_slug, collector: s.collector, accountLabel: s.account_label,
    observedAt: new Date(s.observed_at).toISOString(), window: s.window, windowMinutes: s.window_minutes,
    resetsAt: s.resets_at ? new Date(s.resets_at).toISOString() : null, usedPct: s.used_pct,
    tokensInput: count(s.tokens_input), tokensCached: count(s.tokens_cached), tokensCacheWrite: count(s.tokens_cache_write),
    tokensOutput: count(s.tokens_output), tokensReasoning: count(s.tokens_reasoning), model: s.model,
    raw: s.raw, confidence: s.confidence,
  }));
}
