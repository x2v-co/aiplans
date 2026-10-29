import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNextFlight } from '../utils/artificial-analysis';
import {
  DEFAULT_FETCH_TIMEOUT_MS, MoonshotScraper, extractKimiTablesFromMdx, fetchKimiPricingHtml,
  parseKimiPricingHtml, parseKimiPricingTables, resolveFetchTimeoutMs, scrapeMoonshotDynamic, type KimiPricingTable,
} from './moonshot-dynamic';

// Rendered official table, 2026-10-28. Cache-write columns must not be
// mistaken for cache hits, and the K2 context must not leak from K3.
const tables: KimiPricingTable[] = [{
  contextText: 'K3 系列模型均支持 1,048,576 tokens 上下文窗口。',
  headers: ['名称', '输入', '输出', '缓存命中', '缓存写入（5min）', '缓存写入（1h）'],
  rows: [
    ['kimi-k3.1-pro', '¥13.00 / MTok', '¥68.00 / MTok', '¥1.30 / MTok', '¥13.00 / MTok', '¥26.00 / MTok'],
    ['kimi-k3.1-pro-highspeed', '¥26.00 / MTok', '¥136.00 / MTok', '¥1.30 / MTok', '¥26.00 / MTok', '¥52.00 / MTok'],
    ['kimi-k3', '¥20.00 / MTok', '¥100.00 / MTok', '¥2.00 / MTok', '¥20.00 / MTok', '¥40.00 / MTok'],
  ],
}, {
  contextText: 'K2 系列模型均支持 262,144 tokens 上下文窗口。',
  headers: ['名称', '输入', '输出', '缓存命中'],
  rows: [
    ['kimi-k2.7-code', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.30 / MTok'],
    ['kimi-k2.7-code-highspeed', '¥13.00 / MTok', '¥54.00 / MTok', '¥2.60 / MTok'],
    ['kimi-k2.6', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.10 / MTok'],
  ],
}];

test('current Kimi tables retain all six SKUs, cache hits and family contexts', () => {
  const prices = parseKimiPricingTables(tables);
  assert.equal(prices.length, 6);
  assert.deepEqual(prices[0], {modelName: 'kimi-k3.1-pro', inputPricePer1M: 13,
    outputPricePer1M: 68, cachedInputPricePer1M: 1.3, contextWindow: 1048576,
    isAvailable: true, currency: 'CNY'});
  assert.equal(prices[1].inputPricePer1M, 26);
  assert.equal(prices[1].outputPricePer1M, 136);
  assert.equal(prices[1].cachedInputPricePer1M, 1.3);
  assert.equal(prices[5].contextWindow, 262144);
});

test('column order is determined by leaf headings, not price position', () => {
  const changed = structuredClone(tables);
  [changed[0].headers[1], changed[0].headers[2]] = [changed[0].headers[2], changed[0].headers[1]];
  for (const row of changed[0].rows) [row[1], row[2]] = [row[2], row[1]];
  assert.deepEqual(parseKimiPricingTables(changed), parseKimiPricingTables(tables));
});

test('empty, partial, changed-unit and changed-currency catalogs fail closed', () => {
  assert.throws(() => parseKimiPricingTables([]), /No Moonshot/);
  for (const corrupt of [
    (t: KimiPricingTable[]) => { t[1].rows = []; },
    (t: KimiPricingTable[]) => { t[1].contextText = ''; },
    (t: KimiPricingTable[]) => { t[1].headers[3] = '缓存写入'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][1] = '$6.50 / MTok'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][1] = '¥6.50 / KTok'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][3] = '—'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][0] = 'Promo'; },
    (t: KimiPricingTable[]) => { t[1].rows.push(t[1].rows[0]); },
  ]) {
    const changed = structuredClone(tables); corrupt(changed);
    assert.throws(() => parseKimiPricingTables(changed));
  }
});

// Server-rendered page, trimmed, 2026-10-29: the <table> elements are empty
// until hydration; the compiled MDX in the flight payload carries the rows,
// followed by a props-stripped copy (DocTable=()=>null) that must be ignored.
const html = readFileSync(join(__dirname, 'fixtures', 'kimi-pricing-chat-2026-10-29.html'), 'utf8');

test('kimi-k3 uses the explicit context window even when max_completion_tokens appears first', () => {
  const k3 = structuredClone(tables[0]);
  k3.contextText = 'max_completion_tokens 默认 131072。' + k3.contextText;
  k3.rows = k3.rows.filter(row => row[0] === 'kimi-k3');
  assert.equal(parseKimiPricingTables([k3])[0].contextWindow, 1_048_576);
  assert.equal(parseKimiPricingHtml(html).find(price => price.modelName === 'kimi-k3')?.contextWindow, 1_048_576);
});

test('static HTML yields the same six SKUs as the rendered tables, no browser needed', () => {
  assert.deepEqual(parseKimiPricingHtml(html), parseKimiPricingTables(tables));
});

test('static HTML keeps each family context and the cache-hit column', () => {
  const [k3, k2] = extractKimiTablesFromMdx(parseNextFlight(html));
  assert.match(k3.contextText, /1,048,576 tokens 上下文窗口/);
  assert.doesNotMatch(k3.contextText, /262,144/);
  assert.match(k2.contextText, /262,144 tokens 上下文窗口/);
  assert.deepEqual(k3.headers.slice(0, 4), ['模型', '输入', '输出', '缓存命中']);
  assert.deepEqual(k2.rows[2], ['kimi-k2.6', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.10 / MTok']);
});

test('static HTML fails loud on a props-stripped page, conflicting copies or interpolated cells', () => {
  assert.throws(() => extractKimiTablesFromMdx('const DocTable=()=>null;_jsx(DocTable,{className:`x`})'), /No complete Kimi DocTable set/);
  const table = (price: string) => `const DocTable=1;_jsx(Heading,{level:\`3\`,children:\`K3 系列模型均支持 1,048,576 tokens 上下文窗口。\`}),_jsx(DocTable,{columns:[{title:\`模型\`},{title:\`输入\`},{title:\`输出\`},{title:\`缓存命中\`}],rows:[[\`kimi-k3\`,\`${price}\`,\`¥100.00 / MTok\`,\`¥2.00 / MTok\`]]})`;
  assert.equal(extractKimiTablesFromMdx(table('¥20.00 / MTok')).length, 1);
  assert.throws(() => extractKimiTablesFromMdx(table('¥20.00 / MTok') + table('¥21.00 / MTok')), /conflicting DocTable copies/);
  assert.throws(() => extractKimiTablesFromMdx(table('¥${p} / MTok')), /Unsupported template interpolation/);
  assert.throws(() => parseKimiPricingHtml('<html><body><table></table></body></html>'), /No Next.js flight payload/);
});

test('fetch timeout defaults to 90s and MOONSHOT_FETCH_TIMEOUT_MS overrides it', () => {
  assert.equal(DEFAULT_FETCH_TIMEOUT_MS, 90_000);
  assert.equal(resolveFetchTimeoutMs({}), 90_000);
  assert.equal(resolveFetchTimeoutMs({ MOONSHOT_FETCH_TIMEOUT_MS: '120000' }), 120_000);
  for (const bad of ['', ' ', 'abc', '0', '-5', '0.1', '2147483648', 'Infinity']) {
    assert.equal(resolveFetchTimeoutMs({ MOONSHOT_FETCH_TIMEOUT_MS: bad }), 90_000);
  }
});

test('rendered fallback uses the same (larger) timeout budget', () => {
  const scraper = new MoonshotScraper(123_000) as unknown as { options: { timeout: number } };
  assert.equal(scraper.options.timeout, 123_000);
});

type FetchStep = Error | Response;
function scriptedFetch(steps: FetchStep[]) {
  const calls: { url: string; signal?: AbortSignal | null }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), signal: init?.signal });
    const step = steps.shift();
    if (!step) throw new Error('unexpected fetch');
    if (step instanceof Error) throw step;
    return step;
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const recordSleep = () => {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => { delays.push(ms); } };
};

test('static fetch retries network errors with exponential backoff, then parses', async () => {
  const { impl, calls } = scriptedFetch([
    new TypeError('fetch failed'),
    Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }),
    new Response(html, { status: 200 }),
  ]);
  const { delays, sleep } = recordSleep();
  const prices = await fetchKimiPricingHtml({ fetchImpl: impl, sleep, timeoutMs: 5_000, baseDelayMs: 1_000 });
  assert.deepEqual(prices, parseKimiPricingTables(tables));
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [1_000, 2_000]);
  assert.ok(calls.every(call => call.signal instanceof AbortSignal));
  assert.equal(new Set(calls.map(call => call.signal)).size, 3, 'each attempt has its own timeout signal');
});

test('static fetch retries 5xx/429 and gives up after 3 attempts with every error', async () => {
  const { impl, calls } = scriptedFetch([
    new Response('', { status: 503 }), new Response('', { status: 429 }), new TypeError('fetch failed'),
  ]);
  const { delays, sleep } = recordSleep();
  await assert.rejects(
    fetchKimiPricingHtml({ fetchImpl: impl, sleep, timeoutMs: 5_000, baseDelayMs: 1_000 }),
    (error: Error) => /after 3 attempts \(timeout 5000ms each\)/.test(error.message)
      && /HTTP 503/.test(error.message) && /HTTP 429/.test(error.message) && /fetch failed/.test(error.message),
  );
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [1_000, 2_000]);
});

test('static fetch retries timeout and network interruptions after a partial body download', async () => {
  for (const error of [
    Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
    new TypeError('terminated'),
  ]) {
    let reads = 0;
    const interrupted = new Response(new ReadableStream({
      pull(controller) {
        if (reads++ === 0) controller.enqueue(new TextEncoder().encode('<html>'));
        else controller.error(error);
      },
    }), { status: 200 });
    const { impl, calls } = scriptedFetch([interrupted, new Response(html, { status: 200 })]);
    const { delays, sleep } = recordSleep();
    assert.equal((await fetchKimiPricingHtml({ fetchImpl: impl, sleep, baseDelayMs: 1 })).length, 6);
    assert.equal(reads, 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(delays, [1]);
  }
});

test('static fetch does not retry HTTP 4xx or a parse failure', async () => {
  for (const response of [
    ...[400, 401, 403, 404, 408, 422].map(status => new Response('', { status })),
    new Response('<html></html>', { status: 200 }),
  ]) {
    const { impl, calls } = scriptedFetch([response]);
    const { delays, sleep } = recordSleep();
    await assert.rejects(fetchKimiPricingHtml({ fetchImpl: impl, sleep }), /HTTP 4\d\d|No Next.js flight payload/);
    assert.equal(calls.length, 1);
    assert.deepEqual(delays, []);
  }
});

test('static fetch caps attempts at three and normalizes invalid attempt counts', async () => {
  for (const [attempts, expected] of [[5, 3], [Infinity, 3], [NaN, 3], [1.5, 1]]) {
    const { impl, calls } = scriptedFetch(Array.from({ length: 4 }, () => new TypeError('fetch failed')));
    const { delays, sleep } = recordSleep();
    await assert.rejects(fetchKimiPricingHtml({ fetchImpl: impl, sleep, attempts }), new RegExp(`after ${expected} attempts`));
    assert.equal(calls.length, expected);
    assert.equal(delays.length, expected - 1);
  }
});

test('HTTP error bodies are cancelled before retrying, including cancellation failures', async () => {
  for (const status of [404, 429, 503]) {
    let cancelled = false;
    const response = new Response(new ReadableStream({
      cancel() { cancelled = true; throw new Error('body already interrupted'); },
    }), { status });
    const { impl, calls } = scriptedFetch([response, new Response(html)]);
    const sleep = async () => { assert.equal(cancelled, true); };
    if (status === 404) {
      await assert.rejects(fetchKimiPricingHtml({ fetchImpl: impl, sleep }), /HTTP 404/);
      assert.equal(calls.length, 1);
    } else {
      assert.equal((await fetchKimiPricingHtml({ fetchImpl: impl, sleep })).length, 6);
      assert.equal(calls.length, 2);
    }
    assert.equal(cancelled, true);
  }
});

test('static fetch and rendered fallback receive the default and environment timeout', async (t) => {
  const timeout = AbortSignal.timeout;
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (ms: number) => { timeouts.push(ms); return timeout(ms); });
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  const renderedTimeouts: number[] = [];
  t.mock.method(MoonshotScraper.prototype, 'run', async function (this: MoonshotScraper) {
    renderedTimeouts.push((this as unknown as { options: { timeout: number } }).options.timeout);
    return { source: 'Moonshot', success: true, prices: parseKimiPricingTables(tables) };
  });
  const saved = process.env.MOONSHOT_FETCH_TIMEOUT_MS;
  try {
    delete process.env.MOONSHOT_FETCH_TIMEOUT_MS;
    assert.equal((await scrapeMoonshotDynamic()).success, true);
    process.env.MOONSHOT_FETCH_TIMEOUT_MS = '123000';
    assert.equal((await scrapeMoonshotDynamic()).success, true);
    assert.deepEqual(timeouts, [90_000, 123_000]);
    assert.deepEqual(renderedTimeouts, timeouts);
  } finally {
    if (saved === undefined) delete process.env.MOONSHOT_FETCH_TIMEOUT_MS;
    else process.env.MOONSHOT_FETCH_TIMEOUT_MS = saved;
  }
});
