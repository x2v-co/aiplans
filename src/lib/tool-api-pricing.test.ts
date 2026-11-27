import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_API_PRICES, formatToolPrice } from './tool-api-pricing';

test('every tool price is official, sourced and verified', () => {
  for (const row of TOOL_API_PRICES) {
    assert.equal(new URL(row.sourceUrl).protocol, 'https:');
    assert.ok(/(claude\.com|openai\.com|ai\.google\.dev|x\.ai|deepseek\.com|baidu\.com|vercel\.com|brave\.com|octen\.ai|developers\.cloudflare\.com)$/.test(new URL(row.sourceUrl).hostname), row.sourceUrl);
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

test('Cloudflare AI Search overage prices retain the official billing units in both locales', () => {
  const rows = TOOL_API_PRICES.filter(row => row.providerSlug === 'cloudflare');
  assert.deepEqual(rows.map(row => [row.tool, row.pricePer1k, formatToolPrice(row, 'en'), formatToolPrice(row, 'zh')]), [
    ['AI Search — Base ingestion', 0.75, '$0.75 / million ingestion tokens', '$0.75 / 每百万摄取 token'],
    ['AI Search — Image processing / OCR surcharge', 0.5, '$0.5 / million image processing tokens (additional)', '$0.5 / 每百万图片处理 token（附加费）'],
    ['AI Search — Storage', 2, '$2 / GB-month', '$2 / 每 GB·月'],
    ['AI Search — Semantic, vector and hybrid queries', 0.75, '$0.75 / 1,000 queries', '$0.75 / 每千次查询'],
    ['AI Search — Full-text queries', 0.1, '$0.1 / 1,000 queries', '$0.1 / 每千次查询'],
  ]);
  for (const row of rows) {
    assert.equal(row.provider, 'Cloudflare');
    assert.equal(row.kind, 'ai_search');
    assert.equal(row.currency, 'USD');
    assert.equal(row.sourceUrl, 'https://developers.cloudflare.com/ai-search/platform/limits-pricing/');
    assert.equal(row.verifiedAt, '2026-11-26');
    assert.match(row.note!.en, /Overage list price; AI Search billing begins December 1, 2026 \(2026-12-01\)/);
    assert.match(row.note!.zh, /超额用量刊例价；AI Search 于 2026-12-01 起计费/);
  }
});

test('Cloudflare AI Search includes monthly allowances, a shared OCR allotment and binding Free crawl limits', () => {
  const get = (tool: string) => TOOL_API_PRICES.find(row => row.providerSlug === 'cloudflare' && row.tool === `AI Search — ${tool}`)!;
  const ingestion = get('Base ingestion');
  const image = get('Image processing / OCR surcharge');
  const storage = get('Storage');
  const semantic = get('Semantic, vector and hybrid queries');
  const fullText = get('Full-text queries');

  assert.match(ingestion.note!.en, /Every account includes 5 million ingestion tokens\/month, shared with image processing/);
  assert.match(ingestion.note!.zh, /每个账号每月含 500 万摄取 token，与图片处理共享额度/);
  assert.match(image.note!.en, /Additional to base ingestion/);
  assert.match(image.note!.en, /shares the 5 million ingestion tokens\/month per account/);
  assert.match(image.note!.en, /OCR is available on every account and billed as image processing ingestion tokens/);
  assert.match(image.note!.zh, /在基础摄取费之上加收/);
  assert.match(image.note!.zh, /共享每个账号每月 500 万 token 额度/);
  assert.match(image.note!.zh, /所有账号均可使用 OCR，按图片处理摄取 token 计费/);
  assert.match(storage.note!.en, /Every account includes 10 GB-month of storage each month/);
  assert.match(storage.note!.zh, /每个账号每月含 10 GB·月存储额度/);
  assert.match(semantic.note!.en, /Every account includes 1,000 semantic queries\/month/);
  assert.match(semantic.note!.zh, /每个账号每月含 1,000 次语义查询/);
  assert.match(fullText.note!.en, /Every account includes 1,000 full-text queries\/month/);
  assert.match(fullText.note!.zh, /每个账号每月含 1,000 次全文查询/);
  assert.match(semantic.note!.en, /Workers Free: maximum 500 pages crawled\/day \(binding limit\); Workers Paid: unlimited daily crawl/);
  assert.match(semantic.note!.zh, /Workers Free 每天最多抓取 500 页（实际约束上限）；Workers Paid 每日抓取页数不限/);
});
