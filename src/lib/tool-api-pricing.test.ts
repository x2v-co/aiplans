import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_API_PRICES, formatToolPrice } from './tool-api-pricing';

test('every tool price is official, sourced and verified', () => {
  for (const row of TOOL_API_PRICES) {
    assert.equal(new URL(row.sourceUrl).protocol, 'https:');
    assert.ok(/(claude\.com|openai\.com|ai\.google\.dev|x\.ai|deepseek\.com|baidu\.com)$/.test(new URL(row.sourceUrl).hostname), row.sourceUrl);
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
  assert.equal(formatToolPrice(get('deepseek', 'Fetch'), 'zh'), '¥5 / 每千次成功请求');
  assert.equal(formatToolPrice(get('anthropic', 'Web fetch'), 'en'), 'No per-call fee');
});
