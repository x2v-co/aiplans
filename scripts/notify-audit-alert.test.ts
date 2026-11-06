import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../deploy/production/notify-audit-alert.sh', import.meta.url));
type Call = { channel: string; body: { msg_type?: string; content?: { text: string }; text?: string; chat_id?: string }; direct: boolean; json: boolean };

function notify(overrides: NodeJS.ProcessEnv, message = 'limits "quoted" \\ backslash\n中文', viaArgument = false) {
  const directory = mkdtempSync(join(tmpdir(), 'notify-audit-alert-'));
  try {
    const configFile = join(directory, 'config');
    const log = join(directory, 'requests.jsonl');
    const inputFile = join(directory, 'stdin');
    const outputFile = join(directory, 'stdout');
    const errorFile = join(directory, 'stderr');
    writeFileSync(configFile, '');
    writeFileSync(inputFile, viaArgument ? '' : message);
    // Every request is intercepted; never invoke the real curl or record credential URLs.
    writeFileSync(join(directory, 'curl'), `#!${process.execPath}
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
const endpoint = new URL(args.at(-1));
const channel = endpoint.hostname === '127.0.0.1' ? 'feishu' : 'telegram';
const value = flag => args[args.indexOf(flag) + 1];
appendFileSync(process.env.STUB_LOG, JSON.stringify({
  channel, body: JSON.parse(value('--data-binary')),
  direct: value('--noproxy') === '*', json: value('--header') === 'Content-Type: application/json',
}) + '\\n');
const prefix = channel === 'feishu' ? 'STUB_FEISHU_' : 'STUB_TELEGRAM_';
if (process.env[prefix + 'EXIT']) {
  process.stderr.write('unsafe-transport-diagnostic');
  process.exit(Number(process.env[prefix + 'EXIT']));
}
process.stdout.write(process.env[prefix + 'RESPONSE'] ?? (channel === 'feishu' ? '{"code":0}' : '{"ok":true}'));
`, { mode: 0o755 });
    const descriptors = [openSync(inputFile, 'r'), openSync(outputFile, 'w'), openSync(errorFile, 'w')];
    let result: ReturnType<typeof spawnSync>;
    try {
      result = spawnSync('/bin/bash', [script, ...(viaArgument ? [message] : [])], {
        stdio: descriptors, timeout: 10_000,
        // A clean environment prevents loading developer credentials or contacting real channels.
        env: { PATH: `${directory}:/usr/bin:/bin`, AIPLANS_TG_ENV: configFile, STUB_LOG: log, ...overrides },
      });
    } finally { descriptors.forEach(closeSync); }
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    const stdout = readFileSync(outputFile, 'utf8');
    const stderr = readFileSync(errorFile, 'utf8');
    let calls: Call[] = [];
    try { calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Call); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    assert.ok(calls.every((call) => call.direct && call.json));
    assert.ok(!stderr.includes('unsafe-transport-diagnostic'));
    return { status: result.status, stderr, stdout, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const feishu = { FEISHU_ALERT_WEBHOOK_URL: 'http://127.0.0.1/alert' };
const telegram = { BRAIN_TG_TOKEN: 'fixture-token', BRAIN_TG_CHAT_ID: '123' };

test('audit notifier prefers Feishu, encodes multiline Unicode JSON and bypasses proxies', () => {
  const result = notify({ ...feishu, ...telegram });
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls.map((call) => call.channel), ['feishu']);
  assert.equal(result.calls[0].body.msg_type, 'text');
  assert.ok(result.calls[0].body.content?.text.includes('limits "quoted" \\ backslash\n中文'));
  assert.equal(result.stdout, '');
});

test('audit notifier falls back to Telegram on Feishu transport, HTTP, JSON or API failure', () => {
  const failures = [
    { STUB_FEISHU_EXIT: '7' }, { STUB_FEISHU_EXIT: '22' },
    { STUB_FEISHU_RESPONSE: 'not JSON' }, { STUB_FEISHU_RESPONSE: '{"code":1}' },
    { STUB_FEISHU_RESPONSE: '{}' }, { STUB_FEISHU_RESPONSE: '{"code":"0"}' },
    { STUB_FEISHU_RESPONSE: '{"code":false}' }, { STUB_FEISHU_RESPONSE: 'null' },
  ];
  for (const failure of failures) {
    const result = notify({ ...feishu, ...telegram, ...failure });
    assert.equal(result.status, 0);
    assert.deepEqual(result.calls.map((call) => call.channel), ['feishu', 'telegram']);
    assert.match(result.stderr, /Feishu send failed/);
    assert.equal(result.calls[1].body.chat_id, '123');
  }
});

test('audit notifier accepts Telegram alone and bounds its message', () => {
  const result = notify(telegram, 'x'.repeat(5000), true);
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls.map((call) => call.channel), ['telegram']);
  assert.equal(Array.from(result.calls[0].body.text!).length, 3900);
});

test('audit notifier fails loudly when no channel or all deliveries fail', () => {
  for (const channels of [
    {}, { BRAIN_TG_TOKEN: 'fixture-token' },
    { ...feishu, STUB_FEISHU_RESPONSE: '{"code":1}' },
    { ...feishu, ...telegram, STUB_FEISHU_EXIT: '7', STUB_TELEGRAM_EXIT: '7' },
    { ...telegram, STUB_TELEGRAM_RESPONSE: '{"ok":false}' },
    { ...telegram, STUB_TELEGRAM_RESPONSE: 'not JSON' },
    { ...telegram, STUB_TELEGRAM_RESPONSE: '{"ok":"true"}' },
  ]) {
    const result = notify(channels);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /alert not delivered/);
    assert.equal(result.stdout, '');
  }
});

test('audit notifier allows directly configured channels without a credential file', () => {
  const result = notify({ ...feishu, AIPLANS_TG_ENV: '/nonexistent/audit-alert-config' });
  assert.equal(result.status, 0);
  assert.equal(result.calls.length, 1);
});

test('audit notifier sends nothing for empty input', () => {
  const result = notify(feishu, '');
  assert.equal(result.status, 0);
  assert.equal(result.calls.length, 0);
});
