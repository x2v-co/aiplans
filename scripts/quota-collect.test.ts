import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { alertAnomalies, parseOptions } from './quota-collect';
import type { Anomaly } from './quota-collect/anomaly';

test('CLI defaults to dry-run, validates flags and requires explicit apply for alerts', () => {
  assert.equal(parseOptions([]).apply, false);
  assert.equal(parseOptions(['--out=test.jsonl']).apply, false);
  assert.equal(parseOptions(['--apply', '--alert']).alert, true);
  assert.equal(parseOptions(['--codex-dir', '/synthetic']).codexDir, '/synthetic');
  for (const args of [['--alert'], ['--apply', '--dry-run'], ['--collector', 'unknown'], ['--out'], ['--apply=yes'], ['--account-label=a@b.com'], ['--unknown']]) {
    assert.throws(() => parseOptions(args));
  }
});

test('runner dry-run ignores DB/Telegram env, prints daily summary; --out writes only private local JSONL', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'quota-runner-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'sessions'));
  await writeFile(join(root, 'sessions', 'synthetic.jsonl'), await readFile(new URL('./quota-collect/fixtures/codex-synthetic.jsonl', import.meta.url)));
  const env = { ...process.env, CODEX_HOME: root, DATABASE_URL: 'postgres://unused.invalid/db', AIPLANS_TG_BOT_TOKEN: 'synthetic-unused-token' };
  const run = (args: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/quota-collect.ts', ...args], { env });
  const dry = await run([]);
  assert.match(dry.stdout, /Daily summary \(UTC/);
  assert.match(dry.stdout, /2026-01-01 \| chatgpt-pro \| codex-log \| local-paid \| 3 \| 280 \| 820/);
  assert.match(dry.stdout, /Dry-run: no database access or Telegram messages/);
  assert.match(dry.stdout, /\[cursor-dashboard\] skipped: credentials not configured: needs/);
  assert.doesNotMatch(dry.stdout, /synthetic-unused-token|unused.invalid|SYNTHETIC_PROMPT/);
  assert.deepEqual(await readdir(root), ['sessions']);
  const out = join(root, 'samples.jsonl');
  await run(['--collector', 'codex-log', '--out', out]);
  const rows = (await readFile(out, 'utf8')).trim().split('\n').map((s) => JSON.parse(s));
  assert.equal(rows.length, 10);
  assert.equal((await stat(out)).mode & 0o777, 0o600);
  await assert.rejects(run(['--collector', 'codex-log', '--out', out])); // Refuse to overwrite.
  assert.equal((await readFile(out, 'utf8')).trim().split('\n').length, 10);
});

test('Telegram requires both flags and reuses monitor credential precedence and transport', async () => {
  const anomaly = {
    day: '2026-01-02', planSlug: 'chatgpt-pro', window: '5h', collector: 'codex-log', accountLabel: 'paid-a',
    model: 'gpt-5-codex', limitId: 'codex', tokensPerPct: 50, trailingMedian: 100, baselineDays: 1, dropPct: 50,
  } satisfies Anomaly;
  const sent: string[][] = [];
  const send = async (token: string, chat: string, message: string) => { sent.push([token, chat, message]); };
  const env = { AIPLANS_TG_BOT_TOKEN: 'synthetic-a', BRAIN_TG_TOKEN: 'synthetic-b', AIPLANS_TG_CHAT_ID: 'synthetic-chat' };
  assert.equal(await alertAnomalies([anomaly], false, true, env, send), 0);
  assert.equal(await alertAnomalies([anomaly], true, false, env, send), 0);
  assert.equal(sent.length, 0);
  assert.equal(await alertAnomalies([anomaly], true, true, env, send), 1);
  assert.deepEqual(sent[0].slice(0, 2), ['synthetic-a', 'synthetic-chat']);
  assert.match(sent[0][2], /^\[aiplans\] Quota self-measure anomaly/);
  await assert.rejects(alertAnomalies([anomaly], true, true, {}, send), /requires Telegram credentials/);
  await assert.rejects(alertAnomalies([anomaly], true, true, env, async () => { throw new Error('synthetic delivery failed'); }), /delivery failed/);
});
