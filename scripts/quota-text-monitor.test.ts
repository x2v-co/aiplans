import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Sql } from 'postgres';
import { fetchSourceText, main, observeSnapshot, runExitCode, sendAlert, sendFeishu, sendTelegram, alertChannels, updateFailureState, type FailureState } from './quota-text-monitor';
import { QUOTA_TEXT_SOURCES } from './config/quota-text-sources';

const source = { id: 'fixture', name: 'Fixture', url: 'https://example.invalid/quota' };
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw new Error('Network forbidden in tests'); }; });
after(() => { globalThis.fetch = originalFetch; });

test('dry-run performs only SELECTs and never alert requests', async () => {
  const queries: string[] = [];
  const sql = (async (parts: TemplateStringsArray) => {
    const query = parts.join('?');
    assert.match(query.trim(), /^SELECT/);
    queries.push(query);
    return [];
  }) as unknown as Sql;
  await observeSnapshot(sql, source, 'Usage: 20 messages', true, {});
  assert.equal(queries.length, 2);
  await observeSnapshot(undefined, source, 'Usage: 20 messages', true, {});
});

test('apply without channels still fetches and writes snapshots', async (t) => {
  const db = memoryDatabase();
  const warnings: string[] = [];
  t.mock.method(console, 'warn', (message: string) => { warnings.push(message); });
  await main(['--apply', '--source=' + QUOTA_TEXT_SOURCES[0].id], () => {}, {
    env: {}, sql: db.sql,
    fetcher: async () => new Response('Usage 10', { headers: { 'content-type': 'text/plain' } }),
  });
  assert.equal(db.rows.length, 1);
  assert.ok(warnings.some((message) => message.includes('no alert channel configured')));
});

function memoryDatabase() {
  type Row = { id: number; content_hash: string; extracted_text: string; changed: boolean; alerted_at: Date | null; observed: number };
  const rows: Row[] = [];
  const evidence: unknown[][] = [];
  const queries: string[] = [];
  let tick = 0;
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.join('?').replace(/\s+/g, ' ').trim();
    queries.push(statement);
    if (statement.includes('pg_advisory_xact_lock')) return [];
    if (statement.startsWith('SELECT')) {
      if (statement.includes('ORDER BY')) return [...rows].sort((a, b) => b.observed - a.observed).slice(0, 1).map((row) => ({ ...row }));
      return rows.filter((row) => row.content_hash === values[1]).map((row) => ({ ...row }));
    }
    if (statement.startsWith('INSERT INTO quota_text_snapshots')) {
      const row: Row = { id: rows.length + 1, content_hash: values[2] as string, extracted_text: values[3] as string, changed: values[4] as boolean, alerted_at: null, observed: ++tick };
      rows.push(row);
      return [{ id: row.id }];
    }
    if (statement.startsWith('INSERT INTO quota_evidence')) {
      assert.match(statement, /'official_text'.*'pending review'/);
      evidence.push(values);
      return [];
    }
    if (statement.startsWith('UPDATE quota_text_snapshots')) {
      const row = rows.find((row) => row.id === values[0]);
      assert.ok(row);
      if (statement.includes('alerted_at')) row.alerted_at = new Date();
      else row.observed = ++tick;
      return [];
    }
    throw new Error(`Unexpected SQL: ${statement}`);
  };
  const sql = Object.assign(query, {
    end: async () => {},
    begin: async (callback: (transaction: Sql) => Promise<void>) => {
      const start = queries.length;
      await callback(sql as unknown as Sql);
      assert.match(queries[start], /pg_advisory_xact_lock/);
    },
  }) as unknown as Sql;
  return { sql, rows, evidence };
}

test('apply stores a silent baseline, one evidence per new change, and dedupes reversions and delivery retries', async (t) => {
  const db = memoryDatabase();
  const messages: string[] = [];
  let fail = false;
  t.mock.method(globalThis, 'fetch', async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    messages.push((JSON.parse(options!.body as string) as { text: string }).text);
    return Response.json({ ok: !fail });
  });
  const observe = (text: string) => observeSnapshot(db.sql, source, text, false, { telegramToken: 'fixture-token', telegramChatId: '123' });
  await observe('Usage 10');
  await observe('Usage 10');
  assert.equal(messages.length, 0);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].changed, false);
  assert.equal(db.evidence.length, 0);

  await observe('Usage 20');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^\[aiplans\].*Fixture.*fixture/);
  assert.ok(messages[0].includes(source.url));
  assert.ok(messages[0].includes('- Usage 10\n+ Usage 20'));
  assert.equal(db.evidence.length, 1);
  assert.ok(db.rows[1].alerted_at);
  await observe('Usage 10');
  await observe('Usage 20');
  assert.equal(messages.length, 1);
  assert.equal(db.rows.length, 2);
  assert.equal(db.evidence.length, 1);

  fail = true;
  await observe('Usage 30');
  assert.equal(db.rows.length, 3);
  assert.equal(db.evidence.length, 2);
  assert.equal(db.rows[2].alerted_at, null);
  fail = false;
  await observe('Usage 30');
  assert.ok(db.rows[2].alerted_at);
  assert.equal(db.rows.length, 3);
  assert.equal(db.evidence.length, 2);
  assert.equal(messages.length, 3);
  await observe('Usage 30');
  assert.equal(messages.length, 3);
});

test('Telegram uses plain JSON with bounded message text, and validates API success', async () => {
  let called = false;
  await sendTelegram('fixture-token', '123', '[aiplans] ' + 'x'.repeat(5000), async (_url, options) => {
    called = true;
    const body = JSON.parse(options!.body as string) as { chat_id: string; text: string; parse_mode?: string };
    assert.equal(body.chat_id, '123');
    assert.equal(body.text.length, 3900);
    assert.ok(body.text.startsWith('[aiplans]'));
    assert.equal(body.parse_mode, undefined);
    return Response.json({ ok: true });
  });
  assert.equal(called, true);
  await assert.rejects(sendTelegram('fixture-token', '123', 'test', async () => Response.json({ ok: false })), /send failed/);
  await assert.rejects(sendTelegram('fixture-token', '123', 'test', async () => new Response('', { status: 429 })), /http=429/);
  await assert.rejects(sendTelegram('fixture-token', '123', 'test', async () => { throw new Error('token-bearing-url'); }), (error: Error) => {
    assert.equal(error.message, 'Telegram request failed');
    return true;
  });
});


test('channels use Feishu and optional explicit Telegram credentials, retaining legacy overrides', () => {
  assert.deepEqual(alertChannels({}), { feishuWebhookUrl: undefined, telegramToken: undefined, telegramChatId: undefined });
  const channels = alertChannels({ FEISHU_ALERT_WEBHOOK_URL: 'http://127.0.0.1/alert', BRAIN_TG_TOKEN: 'fixture-token', BRAIN_TG_CHAT_ID: '123' });
  assert.ok(channels.feishuWebhookUrl);
  assert.equal(channels.telegramChatId, '123');
  assert.equal(alertChannels({ AIPLANS_TG_BOT_TOKEN: 'legacy', BRAIN_TG_TOKEN: 'fixture-token' }).telegramToken, 'legacy');
});

test('per-source failures are warnings; only all-failed is non-zero', () => {
  assert.equal(runExitCode([{ id: 'a', status: 'ok' }, { id: 'b', status: 'failed', detail: 'HTTP 403' }]), 0);
  assert.equal(runExitCode([{ id: 'a', status: 'failed' }, { id: 'b', status: 'failed' }, { id: 'c', status: 'disabled' }]), 1);
  assert.equal(runExitCode([{ id: 'c', status: 'disabled' }]), 0);
});

test('consecutive failure alert fires once at threshold and resets on success', () => {
  const state: FailureState = {};
  const fail = [{ id: 'x', status: 'failed' as const, detail: 'HTTP 403' }];
  assert.deepEqual(updateFailureState(state, fail, 3), []);
  assert.deepEqual(updateFailureState(state, fail, 3), []);
  assert.deepEqual(updateFailureState(state, fail, 3), ['x']);
  assert.deepEqual(updateFailureState(state, fail, 3), []);
  updateFailureState(state, [{ id: 'x', status: 'ok' }], 3);
  assert.equal(state.x, undefined);
});

test('fetchSourceText retries once on 403 with alternate headers, then warns', async () => {
  const agents: string[] = [];
  const fetcher = (async (_url: string, init: RequestInit) => {
    agents.push((init.headers as Record<string, string>)['user-agent']);
    return agents.length === 1 ? new Response('no', { status: 403 }) : new Response('<p>Usage limits: 50 messages</p>', { headers: { 'content-type': 'text/html' } });
  }) as unknown as typeof fetch;
  assert.equal(await fetchSourceText(source, fetcher), 'Usage limits: 50 messages');
  assert.equal(agents.length, 2);
  assert.notEqual(agents[0], agents[1]);
  const always403 = (async () => new Response('no', { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(fetchSourceText(source, always403), /HTTP 403/);
  const empty = (async () => new Response('<div id="app"></div>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
  await assert.rejects(fetchSourceText(source, empty), /No quota text/);
});

test('disabled sources carry a reason', () => {
  for (const s of QUOTA_TEXT_SOURCES) if (s.enabled === false) assert.ok(s.disabledReason);
});


test('Feishu posts text JSON over a direct connection without global fetch', async (t) => {
  const bodies: unknown[] = [];
  const requestStub = ((_url: URL, options: http.RequestOptions, callback: (response: unknown) => void) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.agent, false);
    assert.ok(options.signal);
    assert.deepEqual(options.headers, { 'content-type': 'application/json' });
    const request = Object.assign(new EventEmitter(), {
      end(body: string) {
        bodies.push(JSON.parse(body));
        const response = Object.assign(new PassThrough(), { statusCode: 200 });
        callback(response);
        response.end(JSON.stringify({ code: 0 }));
      },
    });
    return request;
  }) as unknown as typeof http.request;
  t.mock.method(http, 'request', requestStub);
  t.mock.method(https, 'request', requestStub);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Global proxy fetch must not be used'); });
  const message = '【x2v 告警·测试】quotes " and \n中文';
  await sendFeishu('http://127.0.0.1/alert', message);
  await sendFeishu('https://127.0.0.1/alert', message);
  assert.deepEqual(bodies, [
    { msg_type: 'text', content: { text: message } },
    { msg_type: 'text', content: { text: message } },
  ]);
});

test('Feishu requires HTTP success and numeric code zero, with sanitized errors', async () => {
  const rejected = [
    () => Response.json({ code: 1 }), () => Response.json({}), () => Response.json({ code: '0' }),
    () => Response.json({ code: false }), () => Response.json(null),
    () => new Response('not JSON'), () => Response.json({ code: 0 }, { status: 500 }),
    () => { throw new Error('unsafe-transport-diagnostic'); },
  ];
  for (const response of rejected) {
    await assert.rejects(sendFeishu('http://127.0.0.1/alert', 'test', async () => response()), {
      message: 'Feishu send failed (request, HTTP or API error)',
    });
  }
});

test('Feishu is primary; Telegram is fallback and also works alone', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const channels = { feishuWebhookUrl: 'http://127.0.0.1/alert', telegramToken: 'fixture-token', telegramChatId: '123' };
  const calls: string[] = [];
  let feishuOk = true;
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    const channel = body.msg_type ? 'feishu' : 'telegram';
    calls.push(channel);
    return Response.json(channel === 'feishu' ? { code: feishuOk ? 0 : 1 } : { ok: true });
  };
  await sendAlert(channels, 'test', fetcher);
  assert.deepEqual(calls.splice(0), ['feishu']);
  feishuOk = false;
  await sendAlert(channels, 'test', fetcher);
  assert.deepEqual(calls.splice(0), ['feishu', 'telegram']);
  await sendAlert({ telegramToken: 'fixture-token', telegramChatId: '123' }, 'test', fetcher);
  assert.deepEqual(calls, ['telegram']);
  await assert.rejects(sendAlert({}, 'test', fetcher), /No alert channel/);
  await assert.rejects(sendAlert({ telegramToken: 'fixture-token' }, 'test', fetcher), /No alert channel/);
  await assert.rejects(sendAlert(channels, 'test', async () => { throw new Error('unsafe-transport-diagnostic'); }), { message: 'Telegram request failed' });
});

test('missing channels and failed Feishu preserve snapshots/evidence for an unchanged retry', async (t) => {
  const db = memoryDatabase();
  const warnings: string[] = [];
  t.mock.method(console, 'warn', (message: string) => { warnings.push(message); });
  await observeSnapshot(db.sql, source, 'Usage 10', false, {});
  await observeSnapshot(db.sql, source, 'Usage 20', false, {});
  assert.equal(db.rows.length, 2);
  assert.equal(db.evidence.length, 1);
  assert.equal(db.rows[1].alerted_at, null);
  const channels = { feishuWebhookUrl: 'http://127.0.0.1/alert' };
  await observeSnapshot(db.sql, source, 'Usage 30', false, channels, async () => { throw new Error('unsafe-transport-diagnostic'); });
  assert.equal(db.rows.length, 3);
  assert.equal(db.evidence.length, 2);
  assert.equal(db.rows[2].alerted_at, null);
  await observeSnapshot(db.sql, source, 'Usage 30', false, channels, async () => Response.json({ code: 0 }));
  assert.ok(db.rows[2].alerted_at);
  assert.equal(db.rows.length, 3);
  assert.equal(db.evidence.length, 2);
  assert.ok(warnings.some((message) => message.includes('alert remains pending')));
  assert.ok(warnings.every((message) => !message.includes('unsafe-transport-diagnostic')));
});

test('--test-alert sends one prefixed message without snapshots or source fetching, and rejects failure', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const messages: string[] = [];
  await main(['--test-alert'], () => {}, {
    env: { FEISHU_ALERT_WEBHOOK_URL: 'http://127.0.0.1/alert' },
    fetcher: async (_url, init) => {
      messages.push(JSON.parse(init!.body as string).content.text);
      return Response.json({ code: 0 });
    },
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^【x2v 告警·测试】/);
  await assert.rejects(main(['--test-alert'], () => {}, { env: {} }), /No alert channel/);
  await assert.rejects(main(['--test-alert'], () => {}, {
    env: { FEISHU_ALERT_WEBHOOK_URL: 'http://127.0.0.1/alert' },
    fetcher: async () => Response.json({ code: 1 }),
  }), /delivery failed/);
});

test('--test-alert CLI exits non-zero when no delivery channel is configured', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'quota-test-alert-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputFile = join(directory, 'stdout');
  const errorFile = join(directory, 'stderr');
  const output = openSync(outputFile, 'w');
  const errors = openSync(errorFile, 'w');
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync(process.execPath, [
      '--import', new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url).href,
      fileURLToPath(new URL('./quota-text-monitor.ts', import.meta.url)), '--test-alert',
    ], { cwd: directory, env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', output, errors], timeout: 10_000 });
  } finally { closeSync(output); closeSync(errors); }
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(await readFile(outputFile, 'utf8'), '');
  assert.match(await readFile(errorFile, 'utf8'), /No alert channel configured/);
});

test('source-failure state stays retryable without channels, then delivers via Feishu', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'quota-alert-state-'));
  const stateFile = join(directory, 'state.json');
  const previousExitCode = process.exitCode;
  t.after(async () => { process.exitCode = previousExitCode; await rm(directory, { recursive: true, force: true }); });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'log', () => {});
  const db = memoryDatabase();
  const env = { QUOTA_MONITOR_STATE_FILE: stateFile, QUOTA_MONITOR_FAIL_ALERT_DAYS: '1' };
  const messages: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      messages.push(JSON.parse(init.body as string).content.text);
      return Response.json({ code: 0 });
    }
    return new Response('', { status: 500 });
  };
  await main(['--apply'], () => {}, { env, sql: db.sql, fetcher });
  const pending = JSON.parse(await readFile(stateFile, 'utf8')) as FailureState;
  assert.ok(Object.values(pending).every((entry) => entry.consecutive === 1 && !entry.alertedAt));
  await main(['--apply'], () => {}, { env: { ...env, FEISHU_ALERT_WEBHOOK_URL: 'http://127.0.0.1/alert' }, sql: db.sql, fetcher });
  assert.equal(messages.length, 1);
  const delivered = JSON.parse(await readFile(stateFile, 'utf8')) as FailureState;
  assert.ok(Object.values(delivered).every((entry) => entry.consecutive === 2 && entry.alertedAt));
});
