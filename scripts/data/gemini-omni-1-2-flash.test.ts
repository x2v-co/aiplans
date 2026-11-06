import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditedPricingFacts, auditedPrice } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { parentSlugFor } from '../../src/lib/vertical-model-aliases';

test('gemini-omni-1.2-flash is its own paid-tier row at the 2026-11-06 official rates', () => {
  const row = catalogForKind('video-model').find(item => item.slug === 'gemini-omni-1-2-flash')!;
  assert.equal(row.status, 'available');
  assert.equal(row.pricePerUnit, 12);
  assert.equal(row.billingUnit, 'per_1m_tokens');
  assert.equal(row.pricingUnit, 'per_1m_tokens');
  assert.equal(row.currency, 'USD');
  assert.equal(row.priceStatus, 'priced');
  assert.equal(row.videoTokensPerSecond, 5792);
  assert.equal(row.resolutionTier, '720p');
  assert.equal(row.lastVerified, '2026-11-06');
  assert.equal(row.verifiedAt, '2026-11-06');
  assert.deepEqual(row.inputModalities, ['text', 'image', 'video']);
  assert.deepEqual(row.outputModalities, ['video', 'text']);
  assert.deepEqual(row.usageRates, [
    { priceKind: 'input_tokens', unit: 'per_1m_tokens', price: 1.5 },
    { priceKind: 'text_output_tokens', unit: 'per_1m_tokens', price: 9 },
    { priceKind: 'video_output_tokens', unit: 'per_1m_tokens', price: 12 },
  ]);
  assert.match(row.pricing, /\$1\.50\/1M input.*\$12\.00\/1M video output.*\$9\.00\/1M text output/);
  assert.equal(row.pricePerUnit! * row.videoTokensPerSecond! / 1_000_000, 0.069504);
  assert.equal(row.sourceUrls?.[0].url, 'https://ai.google.dev/gemini-api/docs/pricing#gemini-omni-1.2-flash');
  assert.equal(parentSlugFor('video-model', 'gemini-omni-1-2-flash'), undefined);
  assert.match(row.notes ?? '', /free tier not available/);
  assert.match(row.notes ?? '', /15 seconds/);
  assert.match(row.notes ?? '', /≈ \$0\.07\/second/);
  assert.match(row.notes ?? '', /360p ≈ \$0\.023\/second/);
  assert.match(row.notes ?? '', /1080p upsample ≈ \$0\.104\/second/);
  assert.match(row.notes ?? '', /4K upsample ≈ \$0\.209\/second/);
  assert.match(row.descriptionZh ?? '', /\$12\.00\/1M/);
  assert.match(row.descriptionZh ?? '', /\$1\.50\/1M/);
  assert.match(row.descriptionZh ?? '', /\$9\.00\/1M/);
  assert.match(auditedPrice(row, 'en'), /\$12\.00 \/ 1M video output tokens; ≈\$0\.07 \/ second \(estimated, 720p, 5,792 tokens\/s\)/);
  assert.match(auditedPrice(row, 'zh'), /\$12\.00 \/ 百万视频输出 tokens; ≈\$0\.07 \/ 秒 \(推算, 720p, 5,792 tokens\/s\)/);
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(AuditedPricingFacts, { item: row, locale }));
    const unit = locale === 'zh' ? '百万 token' : '1M tokens';
    assert.match(html, locale === 'zh' ? /\$12\.00 \/ 百万视频输出 tokens/ : /\$12\.00 \/ 1M video output tokens/);
    assert.match(html, new RegExp(`\\$1\\.5 / ${unit}`));
    assert.match(html, new RegExp(`\\$9 / ${unit}`));
    assert.match(html, new RegExp(`\\$12 / ${unit}`));
    assert.doesNotMatch(html, /\$17\.50/);
    if (locale === 'zh') assert.match(html, /原生视频最长 15 秒/);
    else assert.match(html, /Max native video length is 15 seconds/);
  }
});
