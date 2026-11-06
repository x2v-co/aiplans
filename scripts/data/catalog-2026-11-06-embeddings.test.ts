import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmbeddingModelCatalog } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { EMBEDDING_MODELS_1106, EMBEDDING_OMITTED_1106, QWEN_EMBEDDING_1106, VOYAGE_EMBEDDINGS_1106 } from '../../src/lib/catalog-2026-11-06-embeddings';
import { embeddingSeedOptions, seedEmbeddings1106 } from './catalog-2026-11-06-embeddings';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

function fixture(): Partial<Record<string, FakeRow[]>> {
  return {
    providers: [
      { id: 1, slug: 'cohere', type: 'official' },
      { id: 2, slug: 'qwen', type: 'producer' },
    ],
    models: [],
    usage_prices: [],
  };
}
const price = (slug: string, kind = 'text input') => EMBEDDING_MODELS_1106.find(item => item.slug === slug)!.usageRates!.find(rate => rate.priceKind === kind)!;

test('1106 embedding CLI defaults to dry-run and rejects unknown slugs', () => {
  assert.equal(embeddingSeedOptions([]).apply, false);
  assert.equal(embeddingSeedOptions([]).slugs, null);
  assert.equal(embeddingSeedOptions(['--dry-run']).apply, false);
  assert.equal(embeddingSeedOptions(['--apply']).apply, true);
  assert.deepEqual([...embeddingSeedOptions(['--slug', 'voyage-4,voyage-4-lite']).slugs!], ['voyage-4', 'voyage-4-lite']);
  assert.throws(() => embeddingSeedOptions(['--apply', '--dry-run']), /Usage/);
  assert.throws(() => embeddingSeedOptions(['--slug', 'embed-v4.0']), /Unknown or non-seedable --slug: embed-v4.0/);
  assert.throws(() => embeddingSeedOptions(['--slug', 'qwen3-embedding-8b']), /Unknown or non-seedable --slug: qwen3-embedding-8b/);
});

test('1106 stores only official token prices and leaves unpriced ids out of the catalog', () => {
  assert.deepEqual(VOYAGE_EMBEDDINGS_1106.map(item => [item.slug, item.inputPricePer1M]), [
    ['voyage-4-large', 0.12], ['voyage-4', 0.06], ['voyage-4-lite', 0.02], ['voyage-context-4', 0.12], ['voyage-code-4', 0.12],
  ]);
  assert.equal(price('embed-v5.0-pro').price, 0.12);
  assert.equal(price('embed-v5.0-fast').price, 0.08);
  assert.equal(price('embed-v5.0-pro', 'image input').price, 0.4);
  assert.equal(price('embed-v5.0-fast', 'image input').price, 0.4);
  assert.deepEqual([price('text-embedding-v4').price, price('text-embedding-v4', 'text input (batch)').price, QWEN_EMBEDDING_1106.currency], [0.5, 0.25, 'CNY']);
  for (const item of EMBEDDING_MODELS_1106) {
    assert.equal(item.outputPricePer1M, undefined, item.slug);
    assert.equal(item.kind, 'embedding-model', item.slug);
    assert.equal(item.lastVerified, '2026-11-06', item.slug);
    assert.match(item.sourceUrls![0].url, /^https:\/\/(docs\.voyageai\.com|cohere\.com|help\.aliyun\.com)\//, item.slug);
  }
  const listed = new Set(catalogForKind('embedding-model').map(item => item.slug));
  for (const item of EMBEDDING_MODELS_1106) assert.ok(listed.has(item.slug), item.slug);
  for (const omitted of EMBEDDING_OMITTED_1106) assert.equal(listed.has(omitted.id), false, omitted.id);
  const html = renderToStaticMarkup(createElement(EmbeddingModelCatalog, { items: EMBEDDING_MODELS_1106, locale: 'en' }));
  assert.match(html, /\$0\.12\/M input tokens/);
  assert.match(html, /¥0\.50\/M input tokens/);
  assert.doesNotMatch(html, /embedding-models\/(?:embed-v4\.0|qwen3-embedding-8b|qwen3-embedding-0\.6b)/);
});

test('1106 dry-run writes nothing; --slug limits inserts; a second apply is a no-op', async () => {
  const preview = fakeSeedTx(fixture());
  const previewSteps = await seedEmbeddings1106(preview.tx, false, null);
  assert.equal(preview.writes(), 0);
  assert.equal(previewSteps.filter(step => step.table === 'models').length, EMBEDDING_MODELS_1106.length);

  const narrowed = fakeSeedTx(fixture());
  const only = await seedEmbeddings1106(narrowed.tx, true, new Set(['voyage-4']));
  assert.deepEqual(only.filter(step => step.table === 'models').map(step => step.target), ['voyage-4']);
  assert.equal(narrowed.data.models.length, 1);
  assert.equal(narrowed.data.usage_prices[0].price, 0.06);
  assert.equal(narrowed.data.usage_prices[0].currency, 'USD');
  assert.equal(narrowed.data.providers.some(row => row.slug === 'voyage'), true);
  assert.equal(narrowed.data.models.some(row => row.slug === 'embed-v5.0-pro'), false);

  const full = fakeSeedTx(fixture());
  await seedEmbeddings1106(full.tx, true, null);
  const qwen = full.data.models.find(row => row.slug === 'text-embedding-v4')!;
  const qwenPrices = full.data.usage_prices.filter(row => row.model_id === qwen.id);
  assert.deepEqual(qwenPrices.map(row => [row.price_kind, row.price, row.currency]), [
    ['text input', 0.5, 'CNY'],
    ['text input (batch)', 0.25, 'CNY'],
  ]);
  const pro = full.data.usage_prices.find(row => row.model_id === full.data.models.find(model => model.slug === 'embed-v5.0-pro')!.id && row.price_kind === 'image input')!;
  assert.equal(pro.price, 0.4);
  assert.equal(pro.source_url, 'https://cohere.com/blog/embed-5');
  const again = fakeSeedTx(full.data);
  assert.equal((await seedEmbeddings1106(again.tx, false, null)).length, 0);
  assert.equal(again.writes(), 0);
});

test('1106 refuses a missing required provider before any write', async () => {
  const missing = fixture();
  missing.providers = missing.providers!.filter(row => row.slug !== 'qwen');
  const f = fakeSeedTx(missing);
  await assert.rejects(seedEmbeddings1106(f.tx, true, new Set(['text-embedding-v4'])), /missing providers\/qwen/);
  assert.equal(f.writes(), 0);
  const wrong = fixture();
  wrong.providers![0].type = 'reseller';
  const bad = fakeSeedTx(wrong);
  await assert.rejects(seedEmbeddings1106(bad.tx, true, new Set(['embed-v5.0-pro'])), /Unexpected providers\/cohere type/);
  assert.equal(bad.writes(), 0);
});
