import assert from 'node:assert/strict';
import test from 'node:test';
import { quotaHistoryJsonLd, quotaHistoryMetadata } from './history-seo';
import { estimate } from './__fixtures__/estimates';
import { quotaChanges } from './estimates';

test('empty history is noindex; reviewed history has localized canonical and hreflang metadata', () => {
  for (const locale of ['en', 'zh'] as const) {
    const empty = quotaHistoryMetadata(locale, false);
    assert.deepEqual(empty.robots, { index: false, follow: true, googleBot: { index: false, follow: true } });
    const ready = quotaHistoryMetadata(locale, true);
    assert.equal(typeof ready.robots === 'object' && ready.robots?.index, true);
    assert.equal(ready.alternates?.canonical, `https://aiplans.dev/${locale}/quota-changes`);
    assert.equal(ready.alternates?.languages?.['zh-CN'], 'https://aiplans.dev/zh/quota-changes');
    assert.match(String(ready.description), locale === 'zh' ? /估算/ : /estimate/);
  }
});

test('JSON-LD describes citation anchors without estimates, confidence, prices or Offers', () => {
  const changes = quotaChanges([
    estimate({ is_current: false, superseded_by: 2 }),
    estimate({ id: 2, plan_name: 'Example </script><script>alert(1)</script>' }),
  ]);
  for (const locale of ['en', 'zh'] as const) {
    const serialized = quotaHistoryJsonLd(locale, changes);
    const data = JSON.parse(serialized);
    assert.equal(data['@type'], 'CollectionPage');
    assert.equal(data.mainEntity.numberOfItems, 1);
    assert.equal(data.mainEntity.itemListElement[0].url, `https://aiplans.dev/${locale}/quota-changes#change-1-2`);
    assert.doesNotMatch(serialized, /Offer|price|est_tokens|1234567|2345678|confidence|<\/script>/);
    assert.equal(JSON.parse(quotaHistoryJsonLd(locale, [])).mainEntity.numberOfItems, 0);
  }
});
