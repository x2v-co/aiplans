/** Literal reconstruction of the supplied SRE production text, 2026-11-26 21:12 SGT.
 * Intentionally independent of the proposed seed. No database read is performed. */
const SOURCE = 'https://docs.voyageai.com/docs/pricing';
const TEXT_NOTE = 'Text Embeddings current table, verified 2026-11-26. First 50 million tokens are free per account. Batch API has a 33% discount; free credits do not apply to Batch usage. No separate batch rate is stored.';
const MULTIMODAL_NOTE = 'Multimodal Embeddings current table, verified 2026-11-26. $0.12 per million text tokens and $0.60 per billion pixels. First 200M text tokens and 150B pixels are free per account. Each video frame is considered an image for billing. Images below 50,000 pixels are upscaled, processed and charged as 50,000 pixels; images over 2 million pixels are downsampled and charged as 2 million pixels. Minimum $0.00003 and maximum $0.0012 per image. Batch API has a 33% discount; free credits do not apply to Batch usage. No separate batch rate is stored.';
const rerankNote = (example: string) => `Rerankers current table, verified 2026-11-26. Voyage reranker endpoint; output is document rankings, not embeddings. Processed tokens are calculated as “(the number of query tokens × the number of documents) + sum of the number of tokens in all documents.” First 200 million tokens are free per account. The official estimated price per request (${example}) is an example only: 100 documents, with the query plus each document totaling 500 tokens. It is not a billed usage rate. Batch API has a 33% discount; free credits do not apply to Batch usage. No separate batch rate is stored.`;
const rows = [
  { slug: 'voyage-finance-2', bestFor: 'voyage-finance-2 text embedding API.', note: TEXT_NOTE, price: 0.12, priceKind: 'text input', published: '$0.12/M input tokens', pixel: false },
  { slug: 'voyage-law-2', bestFor: 'voyage-law-2 text embedding API.', note: TEXT_NOTE, price: 0.12, priceKind: 'text input', published: '$0.12/M input tokens', pixel: false },
  { slug: 'voyage-multimodal-3.5', bestFor: 'voyage-multimodal-3.5 multimodal embedding API.', note: MULTIMODAL_NOTE, price: 0.12, priceKind: 'text input', published: '$0.12/M text tokens + $0.60/billion pixels', pixel: true },
  { slug: 'voyage-multimodal-3', bestFor: 'voyage-multimodal-3 multimodal embedding API.', note: MULTIMODAL_NOTE, price: 0.12, priceKind: 'text input', published: '$0.12/M text tokens + $0.60/billion pixels', pixel: true },
  { slug: 'rerank-3', bestFor: 'rerank-3 Voyage reranker endpoint for ranking documents against a query.', note: rerankNote('$0.0025'), price: 0.05, priceKind: 'processed tokens', published: '$0.05/M processed tokens', pixel: false },
  { slug: 'rerank-3-lite', bestFor: 'rerank-3-lite Voyage reranker endpoint for ranking documents against a query.', note: rerankNote('$0.001'), price: 0.02, priceKind: 'processed tokens', published: '$0.02/M processed tokens', pixel: false },
];

export function voyageCopyProductionFixture() {
  return {
    providers: [{ id: 42, slug: 'voyage', name: 'Voyage AI', type: 'official' }],
    models: rows.map((row, i) => ({
      id: 100 + i, slug: row.slug, name: row.slug, provider_ids: [42],
      description: `${row.bestFor}\nStatus: available. Pricing confidence: verified. Unit: per_1m_tokens. Last verified: 2026-11-26.\n${row.note}\nSources: Voyage AI: ${SOURCE}`,
    })),
    usage_prices: rows.map((row, i) => ({
      id: 200 + i, model_id: 100 + i, provider_id: 42, plan_id: null,
      price_kind: row.priceKind, unit: 'per_1m_tokens', price: row.price, currency: 'USD',
      is_available: true, source_url: SOURCE, last_verified: new Date('2026-11-26T00:00:00Z'),
      constraints_json: {
        note: row.note, publishedPricingText: row.published,
        catalogOnlyRates: row.pixel ? [{ unit: 'per_1b_pixels', price: 0.6, priceKind: 'image/video pixels' }] : [],
      },
    })),
  };
}
