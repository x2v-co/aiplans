import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBEDDING_MODELS_1104 } from './catalog-2026-11-04';

test('gemini-embedding-2 notes that the preview slug still routes to GA', () => {
  const item = EMBEDDING_MODELS_1104.find(row => row.slug === 'gemini-embedding-2');
  assert.ok(item);
  assert.match(item.notes ?? '', /gemini-embedding-2-preview route to gemini-embedding-2/);
  assert.match(item.notes ?? '', /2026-11-06/);
  assert.match(item.notes ?? '', /embedding space/);
  assert.match(item.notes ?? '', /do not need re-indexing/);
  assert.doesNotMatch(item.notes ?? '', /2026-08-10/);
  assert.equal(item.inputPricePer1M, 0.2);
  const changelog = item.sourceUrls?.find(source => source.url === 'https://ai.google.dev/gemini-api/docs/changelog');
  assert.equal(changelog?.publisher, 'Google');
  assert.ok(item.sourceUrls?.some(source => source.url === 'https://ai.google.dev/gemini-api/docs/pricing'));
  assert.ok(item.sourceUrls?.some(source => source.url === 'https://ai.google.dev/gemini-api/docs/deprecations'));
});
