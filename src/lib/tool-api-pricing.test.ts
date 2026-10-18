import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_API_PRICES, formatToolPrice } from './tool-api-pricing';

test('every tool price is official, sourced and verified', () => {
  for (const row of TOOL_API_PRICES) {
    assert.equal(new URL(row.sourceUrl).protocol, 'https:');
    assert.ok(/(claude\.com|openai\.com|ai\.google\.dev|x\.ai|deepseek\.com)$/.test(new URL(row.sourceUrl).hostname), row.sourceUrl);
    assert.ok(row.pricePer1k >= 0 && Number.isFinite(row.pricePer1k));
    assert.match(row.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
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
