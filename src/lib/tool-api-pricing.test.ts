import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_API_PRICES, formatToolPrice } from './tool-api-pricing';

test('every tool price is official, sourced and verified', () => {
  for (const row of TOOL_API_PRICES) {
    assert.equal(new URL(row.sourceUrl).protocol, 'https:');
    assert.ok(/(claude\.com|openai\.com|ai\.google\.dev|x\.ai|deepseek\.com|baidu\.com|vercel\.com|brave\.com|octen\.ai)$/.test(new URL(row.sourceUrl).hostname), row.sourceUrl);
    assert.ok(row.pricePer1k >= 0 && Number.isFinite(row.pricePer1k));
    assert.match(row.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('Baidu search lists domestic list prices with dated bilingual campaign details', () => {
  const rows = TOOL_API_PRICES.filter(row => row.providerSlug === 'baidu');
  assert.deepEqual(rows.map(row => [row.tool, row.pricePer1k, row.currency]), [
    ['Baidu Search API (Enhanced / 增强版)', 40, 'CNY'],
    ['Baidu Search API (Flagship / 旗舰版)', 72, 'CNY'],
  ]);
  for (const row of rows) {
    assert.equal(row.provider, 'Baidu AI Cloud');
    assert.equal(row.kind, 'web_search');
    assert.equal(row.sourceUrl, 'https://cloud.baidu.com/doc/qianfan/s/1mh4sv6c4');
    assert.equal(row.verifiedAt, '2026-10-31');
    assert.deepEqual(row.unit, { en: '1,000 calls', zh: '每千次调用' });
    assert.deepEqual(row.tokens, { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' });
    for (const locale of ['en', 'zh'] as const) {
      assert.ok(row.note);
      assert.ok(row.note[locale].includes('2026-10-30'));
      assert.ok(row.note[locale].includes('12-31'));
      assert.ok(row.note[locale].includes('https://cloud.baidu.com/product/AI-SEARCH/campaign.html'));
      assert.ok(row.note[locale].includes(row.pricePer1k === 40 ? '4.9' : '9.9'));
      assert.ok(row.note[locale].includes('1,500'));
      assert.ok(row.note[locale].includes('0.072'));
    }
  }
  assert.match(rows[0].note!.en, /prepaid pack, up to 1M calls cumulative; overage billed at list price/);
  assert.match(rows[0].note!.zh, /累计限 100 万次，超额按刊例价/);
  assert.match(rows[1].note!.en, /invite code required/);
  assert.match(rows[1].note!.zh, /需邀请码/);
});

test('known official prices', () => {
  const get = (p: string, t: string) => TOOL_API_PRICES.find(r => r.providerSlug === p && r.tool.startsWith(t))!;
  assert.equal(get('anthropic', 'Web search').pricePer1k, 10);
  assert.equal(get('anthropic', 'Web fetch').pricePer1k, 0);
  assert.equal(get('openai', 'Web search').pricePer1k, 10);
  assert.equal(get('google', 'Grounding with Google Search (Gemini 3+)').pricePer1k, 14);
  assert.equal(get('xai', 'Web search').pricePer1k, 5);
  assert.equal(get('deepseek', 'Search').currency, 'CNY');
  assert.equal(get('deepseek', 'Search').pricePer1k, 5);
  assert.equal(formatToolPrice(get('deepseek', 'Fetch'), 'zh'), '¥5 / 每千次成功请求');
  assert.equal(formatToolPrice(get('anthropic', 'Web fetch'), 'en'), 'No per-call fee');
});

test('Vercel AI Gateway DeepSeek Search and Fetch use the published $0.75 billable rate', () => {
  const rows = TOOL_API_PRICES.filter(row => row.providerSlug === 'vercel-ai-gateway');
  assert.deepEqual(rows.map(row => [row.tool, row.kind, row.pricePer1k, row.currency]), [
    ['DeepSeek Search', 'web_search', 0.75, 'USD'],
    ['DeepSeek Fetch', 'web_fetch', 0.75, 'USD'],
  ]);
  for (const row of rows) {
    assert.equal(row.provider, 'Vercel AI Gateway');
    assert.equal(row.verifiedAt, '2026-11-07');
    assert.equal(row.sourceUrl, 'https://vercel.com/docs/ai-gateway/models-and-providers/web-search');
    assert.deepEqual(row.unit, { en: '1,000 billable requests', zh: '每千次可计费请求' });
    for (const locale of ['en', 'zh'] as const) {
      assert.ok(row.note);
      assert.ok(row.note[locale].includes('0.75'));
      assert.ok(row.note[locale].includes('https://vercel.com/changelog/ai-gateway-adds-deepseek-search-and-fetch-tools'));
    }
  }
  assert.match(rows[0].note!.en, /nonempty results array/);
  assert.match(rows[0].note!.zh, /非空结果数组/);
  assert.match(rows[1].note!.en, /nonempty page content/);
  assert.match(rows[1].note!.zh, /非空页面内容/);
  assert.equal(formatToolPrice(rows[0], 'en'), '$0.75 / 1,000 billable requests');
});

test('Brave x402 and Octen PAYG rates match the official pages verified 2026-11-13', () => {
  const brave = TOOL_API_PRICES.find(row => row.providerSlug === 'brave' && row.tool === 'Search API (x402)')!;
  assert.equal(brave.kind, 'web_search');
  assert.equal(brave.pricePer1k, 5);
  assert.equal(brave.currency, 'USD');
  assert.equal(brave.verifiedAt, '2026-11-13');
  assert.equal(brave.sourceUrl, 'https://brave.com/blog/search-api-agentic-payments/');
  assert.equal(formatToolPrice(brave, 'en'), '$5 / 1,000 requests');
  for (const locale of ['en', 'zh'] as const) {
    assert.ok(brave.note![locale].includes('x402'));
    assert.ok(brave.note![locale].includes('5'));
    assert.ok(brave.note![locale].includes('https://brave.com/search/api/'));
  }

  const web = TOOL_API_PRICES.find(row => row.providerSlug === 'octen' && row.tool === 'Web Search')!;
  const lite = TOOL_API_PRICES.find(row => row.providerSlug === 'octen' && row.tool === 'Pulse Search (lite)')!;
  const standard = TOOL_API_PRICES.find(row => row.providerSlug === 'octen' && row.tool === 'Pulse Search (standard)')!;
  assert.deepEqual([web.pricePer1k, lite.pricePer1k, standard.pricePer1k], [1, 0.1, 0.2]);
  for (const row of [web, lite, standard]) {
    assert.equal(row.provider, 'Octen');
    assert.equal(row.kind, 'web_search');
    assert.equal(row.currency, 'USD');
    assert.equal(row.verifiedAt, '2026-11-13');
    assert.equal(row.sourceUrl, 'https://docs.octen.ai/overview/pricing');
  }
  for (const locale of ['en', 'zh'] as const) {
    assert.ok(web.note![locale].includes('20'));
    assert.ok(web.note![locale].includes('100'));
    assert.ok(web.note![locale].includes('80'));
  }
  assert.match(web.note!.en, /\$50\/quarter/);
  assert.match(web.note!.zh, /50 美元\/季/);
  assert.match(standard.note!.en, /first result per search is free/);
  assert.equal(formatToolPrice(web, 'en'), '$1 / 1,000 calls');
  assert.equal(formatToolPrice(lite, 'zh'), '$0.1 / 每千次调用');
});


test('DeepSeek OCR, TTS and ASR list prices match the official pages verified 2026-11-14', () => {
  const ocr = TOOL_API_PRICES.find(row => row.providerSlug === 'deepseek' && row.kind === 'ocr')!;
  const tts = TOOL_API_PRICES.find(row => row.providerSlug === 'deepseek' && row.kind === 'tts')!;
  const asr = TOOL_API_PRICES.find(row => row.providerSlug === 'deepseek' && row.kind === 'asr')!;
  assert.equal(ocr.tool, 'File parsing / OCR API');
  assert.equal(ocr.pricePer1k, 1.5);
  assert.equal(ocr.currency, 'CNY');
  assert.equal(ocr.verifiedAt, '2026-11-14');
  assert.equal(ocr.sourceUrl, 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing');
  assert.equal(formatToolPrice(ocr, 'en'), '¥1.5 / 1,000 pages');
  assert.equal(formatToolPrice(ocr, 'zh'), '¥1.5 / 每 1,000 页');
  assert.match(ocr.note!.en, /US\$0\.225/);
  assert.match(ocr.note!.zh, /0\.225 美元/);

  assert.equal(tts.pricePer1k, 3);
  assert.equal(formatToolPrice(tts, 'en'), '¥3 / 10,000 billed characters');
  assert.match(tts.note!.en, /US\$0\.45/);
  assert.match(tts.note!.en, /US\$0\.225/);
  assert.match(tts.note!.en, /no end date/);
  assert.match(tts.note!.zh, /1\.5 元/);
  assert.match(tts.note!.en, /Chinese character counts as 2/);

  assert.equal(asr.pricePer1k, 0.78);
  assert.equal(formatToolPrice(asr, 'zh'), '¥0.78 / 每小时音频');
  assert.match(asr.note!.en, /US\$0\.116/);
  assert.match(asr.note!.en, /US\$0\.058/);
  assert.match(asr.note!.zh, /0\.39 元/);
  assert.match(asr.note!.en, /fraction of a second counts as 1 second/);
});
