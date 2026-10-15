import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import type { Sql } from 'postgres';
import { main, observeSnapshot, sendTelegram } from './quota-text-monitor';

const source = { id: 'fixture', name: 'Fixture', url: 'https://example.invalid/quota' };
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw new Error('Network forbidden in tests'); }; });
after(() => { globalThis.fetch = originalFetch; });

test('dry-run performs only SELECTs and never Telegram requests', async () => {
  const queries: string[] = [];
  const sql = (async (parts: TemplateStringsArray) => {
    const query = parts.join('?');
    assert.match(query.trim(), /^SELECT/);
    queries.push(query);
    return [];
  }) as unknown as Sql;
  await observeSnapshot(sql, source, 'Usage: 20 messages', true, undefined);
  assert.equal(queries.length, 2);
  await observeSnapshot(undefined, source, 'Usage: 20 messages', true, undefined);
});

test('missing Telegram token exits apply before opening DB or fetching sources', async () => {
  const previousToken = process.env.AIPLANS_TG_BOT_TOKEN;
  const originalFetch = globalThis.fetch;
  try {
    process.env.AIPLANS_TG_BOT_TOKEN = '';
    globalThis.fetch = async () => { throw new Error('Network forbidden in tests'); };
    await main(['--apply']);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.AIPLANS_TG_BOT_TOKEN;
    else process.env.AIPLANS_TG_BOT_TOKEN = previousToken;
  }
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
  const observe = (text: string) => observeSnapshot(db.sql, source, text, false, 'fixture-token');
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
