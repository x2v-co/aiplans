import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { coalesceCodexSamples, codexLog } from './codex-log';
import { ccusage } from './ccusage';
import { collectors } from './index';
import { CollectorSkipped, opaqueLabel, uniqueSamples, type Sample } from './types';
import { dailySummary, windowSummary } from './summary';
import { dailyMeasurements, detectAnomalies } from './anomaly';

const fixture = new URL('./fixtures/codex-synthetic.jsonl', import.meta.url);

async function fixtureHome(t: TestContext, content?: string) {
  const root = await mkdtemp(join(tmpdir(), 'quota-codex-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'sessions', '2026'), { recursive: true });
  await writeFile(join(root, 'sessions', '2026', 'synthetic.jsonl'), content ?? await readFile(fixture, 'utf8'));
  return root;
}

test('Codex reads sessions only, normalizes inclusive input, dedupes repeated totals, sanitizes raw', async (t) => {
  const codexDir = await fixtureHome(t);
  // A broken JSON auth sentinel must never be parsed (the test contains no credentials).
  await writeFile(join(codexDir, 'auth.json'), 'THIS_FILE_MUST_NOT_BE_READ');
  await symlink(join(codexDir, 'auth.json'), join(codexDir, 'sessions', 'auth-symlink.jsonl'));
  const samples = await codexLog.collect({ accountLabel: 'paid-a', codexDir });
  assert.equal(samples.length, 10);
  const short = samples.filter((s) => s.window === '5h');
  assert.equal(short[1].tokensInput, 200);
  assert.equal(short[1].tokensCached, 800);
  assert.equal(short[1].tokensOutput, 200);
  assert.equal(short[1].tokensReasoning, 50);
  assert.equal(short[2].tokensInput, 0);
  assert.equal(short[2].raw.usageStatus, 'duplicate-total');
  assert.equal(short[0].resetsAt, '2026-01-01T15:00:00.000Z');
  assert.equal(short[0].model, 'gpt-5-codex');
  assert.equal(short[0].planSlug, 'chatgpt-pro');
  assert.doesNotMatch(JSON.stringify(samples), /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PROMPT|synthetic-session-only|auth|quota-codex-test/);
});

test('daily totals count usage once across short/weekly meters; measurements exclude baseline usage', async (t) => {
  const samples = await codexLog.collect({ accountLabel: 'paid-a', codexDir: await fixtureHome(t) });
  const days = dailySummary(samples);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0].tokens, { tokensInput: 280, tokensCached: 820, tokensCacheWrite: 0, tokensOutput: 220, tokensReasoning: 55 });
  const windows = windowSummary(samples);
  assert.equal(windows.length, 4);
  const first = windows.find((s) => s.day === '2026-01-01' && s.window === '5h')!;
  assert.equal(first.usedPctMin, 10);
  assert.equal(first.usedPctMax, 20);
  assert.equal(first.tokensPerPct, 120);
  assert.equal(first.intervalTokens.tokensInput, 200);
  assert.ok(first.impliedWindowValueUsd);
  // (200 fresh*1.25 + 800 cached*.125 + 200 output*10)/1M = .00235.
  assert.equal(first.impliedWindowValueUsd.low, .00235 / 11 * 100);
  assert.equal(first.impliedWindowValueUsd.high, .00235 / 9 * 100);
  assert.equal(first.placeholderPrices, false);
  assert.doesNotMatch(first.notes.join(' '), /CONFIG TO FILL/);
  const anomalies = detectAnomalies(dailyMeasurements(windows));
  assert.equal(anomalies.length, 2); // Independent short and weekly meter comparisons.
  assert.ok(anomalies.every((a) => a.day === '2026-01-02' && a.dropPct === 50));
});

test('reset changes, midnight and limit pools stay separate; meter regressions are rejected', async (t) => {
  const samples = (await codexLog.collect({ accountLabel: 'paid-a', codexDir: await fixtureHome(t) })).filter((s) => s.window === '5h');
  assert.equal(windowSummary(samples).length, 2);
  const [a, b] = samples;
  assert.equal(windowSummary([a, { ...b, resetsAt: '2026-01-01T20:00:00.000Z' }]).length, 2);
  assert.equal(windowSummary([a, { ...b, raw: { ...b.raw, limitId: 'other-pool' } }]).length, 2);
  const decreasing = windowSummary([a, { ...b, usedPct: 5 }])[0];
  assert.equal(decreasing.tokensPerPct, null);
  assert.match(decreasing.notes.join(' '), /decreased/);
});

test('incomplete data, model switches, missing prices and meter rounding do not produce misleading USD', async (t) => {
  const [a, b] = (await codexLog.collect({ accountLabel: 'paid-a', codexDir: await fixtureHome(t) })).filter((s) => s.window === '5h');
  for (const changed of [{ ...b, usedPct: 11 }, { ...b, tokensInput: null }, { ...b, model: 'another-model' }]) {
    const summary = windowSummary([a, changed])[0];
    assert.equal(summary.tokensPerPct, null);
    assert.equal(summary.impliedWindowValueUsd, null);
  }
  const unknownPrice = windowSummary([a, b].map((s) => ({ ...s, model: 'unconfigured-model' })))[0];
  assert.equal(unknownPrice.tokensPerPct, 120);
  assert.equal(unknownPrice.impliedWindowValueUsd, null);
});

test('malformed tail and unsupported windows warn without leaking raw lines', async (t) => {
  const content = await readFile(fixture, 'utf8');
  const warnings: string[] = [];
  const codexDir = await fixtureHome(t, content.replaceAll('"window_minutes":300', '"window_minutes":123') + '{"SYNTHETIC_PARTIAL_SECRET');
  const samples = await codexLog.collect({ accountLabel: 'paid-a', codexDir, warn: (s) => warnings.push(s) });
  assert.equal(samples.length, 5); // Weekly readings retained.
  assert.equal(warnings.length, 2);
  assert.doesNotMatch(warnings.join(' '), /PARTIAL_SECRET/);
});

test('missing meters retain daily token usage, unknown plans are explicit, absent totals still use last usage', async (t) => {
  const line = {
    timestamp: '2026-01-01T10:00:00Z', payload: {
      type: 'token_count', info: { last_token_usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 10 } },
    },
  };
  const [sample] = await codexLog.collect({ accountLabel: 'paid-a', codexDir: await fixtureHome(t, JSON.stringify(line) + '\n') });
  assert.equal(sample.window, 'daily');
  assert.equal(sample.usedPct, null);
  assert.equal(sample.tokensInput, 80);
  assert.equal(sample.tokensCacheWrite, null);
  assert.equal(sample.planSlug, 'codex-unknown');
  assert.equal(sample.confidence, 'low');
});

test('replayed session files do not count token events twice', async (t) => {
  const codexDir = await fixtureHome(t);
  const original = await codexLog.collect({ accountLabel: 'paid-a', codexDir });
  await writeFile(join(codexDir, 'sessions', 'copy.jsonl'), await readFile(fixture, 'utf8'));
  assert.deepEqual(await codexLog.collect({ accountLabel: 'paid-a', codexDir }), original);
});

test('simultaneous parallel sessions merge agreeing meters and dedupe partially overlapping window events', async (t) => {
  const [a] = (await codexLog.collect({ accountLabel: 'paid-a', codexDir: await fixtureHome(t) })).filter((s) => s.window === '5h');
  const b = { ...a, raw: { ...a.raw, eventId: 'synthetic-second-session' } };
  const weekly = { ...a, window: 'weekly' as const, windowMinutes: 10080 };
  const samples = coalesceCodexSamples([a, b, weekly]);
  assert.equal(samples.length, 2);
  assert.equal(samples.find((s) => s.window === '5h')!.tokensInput, a.tokensInput! * 2);
  const [day] = dailySummary(samples);
  assert.equal(day.events, 2);
  assert.equal(day.tokens.tokensInput, a.tokensInput! * 2);
  assert.throws(() => coalesceCodexSamples([a, { ...b, usedPct: 99 }]), /Conflicting simultaneous/);
});

test('bad token counts fail rather than persist negative/unsafe measurements', async (t) => {
  const content = await readFile(fixture, 'utf8');
  for (const invalid of ['-1', '9007199254740992', '1.5']) {
    const codexDir = await fixtureHome(t, content.replace('"input_tokens":100', `"input_tokens":${invalid}`));
    await assert.rejects(codexLog.collect({ accountLabel: 'paid-a', codexDir }), /Token count/);
  }
  const codexDir = await fixtureHome(t, content.replace('"cached_input_tokens":20', '"cached_input_tokens":999'));
  await assert.rejects(codexLog.collect({ accountLabel: 'paid-a', codexDir }), /Cached input exceeds/);
});

test('ccusage supports both standard JSON envelopes without inventing percentages or plans', async (t) => {
  const codexDir = await fixtureHome(t);
  const ccusageJson = join(codexDir, 'daily.json');
  const content = await readFile(new URL('./fixtures/ccusage-synthetic.json', import.meta.url), 'utf8');
  await writeFile(ccusageJson, content);
  const opts = { accountLabel: 'claude-a', ccusageJson, ccusagePlan: 'claude-max-5x' };
  const [sample] = await ccusage.collect(opts);
  assert.equal(sample.tokensInput, 100); // Already fresh input in ccusage.
  assert.equal(sample.tokensCached, 800);
  assert.equal(sample.tokensCacheWrite, 20);
  assert.equal(sample.usedPct, null);
  assert.equal(sample.planSlug, 'claude-max-5x');
  assert.doesNotMatch(JSON.stringify(sample), /SYNTHETIC_IGNORE/);
  await writeFile(ccusageJson, JSON.stringify({ type: 'daily', data: JSON.parse(content).daily }));
  assert.deepEqual(await ccusage.collect(opts), [sample]);
  await assert.rejects(ccusage.collect({ ...opts, ccusagePlan: undefined }), /--ccusage-plan/);
  await writeFile(ccusageJson, JSON.stringify({ projects: {} }));
  await assert.rejects(ccusage.collect(opts), /Expected standard ccusage/);
});

test('missing inputs and credential stubs are explicit skips', async () => {
  await assert.rejects(ccusage.collect({ accountLabel: 'paid-a' }), CollectorSkipped);
  await assert.rejects(codexLog.collect({ accountLabel: 'paid-a', codexDir: '/nonexistent-synthetic-codex-home' }), CollectorSkipped);
  for (const collector of collectors.slice(2)) {
    await assert.rejects(collector.collect({ accountLabel: 'paid-a' }), (error: unknown) => error instanceof CollectorSkipped && /credentials not configured: needs/.test(error.message));
  }
});

test('opaque labels reject emails; conflicting database identities fail, exact replay is idempotent', () => {
  for (const label of ['a@example.com', '', '../account', 'a b', 'a'.repeat(65)]) assert.throws(() => opaqueLabel(label));
  assert.equal(opaqueLabel('paid-1_a'), 'paid-1_a');
  const sample = { collector: 'codex-log', accountLabel: 'paid-a', observedAt: '2026-01-01T00:00:00Z', window: '5h' } as Sample;
  assert.equal(uniqueSamples([sample, sample]).length, 1);
  assert.throws(() => uniqueSamples([sample, { ...sample, usedPct: 20 }]), /Conflicting sample identity/);
});
