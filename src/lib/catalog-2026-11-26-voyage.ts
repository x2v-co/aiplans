import type { AiCatalogItem } from './ai-vertical-catalog';

export const VERIFIED_1126 = '2026-11-26';
export const VOYAGE_PRICING_1126 = 'https://docs.voyageai.com/docs/pricing';
export const VOYAGE_SEED_1126 = 'seed:catalog-2026-11-26-voyage:apply';

const BATCH_NOTE = 'Batch API has a 33% discount; free credits do not apply to Batch usage. No separate batch rate is stored.';
export const RERANK_PROCESSED_TOKEN_FORMULA = '(the number of query tokens × the number of documents) + sum of the number of tokens in all documents';

function row(slug: string, fields: Partial<AiCatalogItem>): AiCatalogItem {
  return {
    slug, name: slug, provider: 'Voyage AI', providerSlug: 'voyage',
    kind: 'embedding-model', modelCategory: 'embedding', status: 'available',
    pricing: '$0.12/M input tokens', unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens',
    priceStatus: 'priced', pricingConfidence: 'verified', currency: 'USD', access: ['api'],
    capabilities: ['text embedding'], bestFor: `${slug} text embedding API.`,
    inputModalities: ['text'], outputModalities: ['embedding'], inputPricePer1M: 0.12,
    usageRates: [{ priceKind: 'text input', price: 0.12, unit: 'per_1m_tokens' }],
    lastVerified: VERIFIED_1126, verifiedAt: VERIFIED_1126, url: VOYAGE_PRICING_1126,
    sourceUrls: [{ label: 'Voyage AI official pricing', url: VOYAGE_PRICING_1126, publisher: 'Voyage AI' }],
    deferredDbSeed: true, deferredDbSeedScript: VOYAGE_SEED_1126,
    ...fields,
  };
}

export const VOYAGE_DOMAIN_EMBEDDINGS_1126 = ['voyage-finance-2', 'voyage-law-2'].map(slug => row(slug, {
  notes: `Text Embeddings current table, verified ${VERIFIED_1126}. First 50 million tokens are free per account. ${BATCH_NOTE}`,
}));

export const VOYAGE_MULTIMODAL_EMBEDDINGS_1126 = ['voyage-multimodal-3.5', 'voyage-multimodal-3'].map(slug => row(slug, {
  pricing: '$0.12/M text tokens + $0.60/billion pixels',
  bestFor: `${slug} multimodal embedding API.`,
  capabilities: ['multimodal embedding'], inputModalities: ['text', 'image', 'video'],
  usageRates: [
    { priceKind: 'text input', price: 0.12, unit: 'per_1m_tokens' },
    // Static official unit only. The DB seed preserves this in constraints_json,
    // because production does not allow per_1b_pixels in usage_prices.unit.
    { priceKind: 'image/video pixels', price: 0.6, unit: 'per_1b_pixels' },
  ],
  notes: `Multimodal Embeddings current table, verified ${VERIFIED_1126}. $0.12 per million text tokens and $0.60 per billion pixels. First 200M text tokens and 150B pixels are free per account. Each video frame is considered an image for billing. Images below 50,000 pixels are upscaled, processed and charged as 50,000 pixels; images over 2 million pixels are downsampled and charged as 2 million pixels. Minimum $0.00003 and maximum $0.0012 per image. ${BATCH_NOTE}`,
}));

export const VOYAGE_RERANKERS_1126 = ([['rerank-3', 0.05], ['rerank-3-lite', 0.02]] as const).map(([slug, price]) => row(slug, {
  kind: 'rerank-model', modelCategory: 'text',
  pricing: `$${price.toFixed(2)}/M processed tokens`,
  capabilities: ['rerank'], bestFor: `${slug} Voyage reranker endpoint for ranking documents against a query.`,
  inputModalities: ['text'], outputModalities: ['ranking'],
  inputPricePer1M: undefined,
  usageRates: [{ priceKind: 'processed tokens', price, unit: 'per_1m_tokens' }],
  notes: `Rerankers current table, verified ${VERIFIED_1126}. Voyage reranker endpoint; output is document rankings, not embeddings. Processed tokens are calculated as “${RERANK_PROCESSED_TOKEN_FORMULA}.” First 200 million tokens are free per account. The official estimated price per request (${slug === 'rerank-3' ? '$0.0025' : '$0.001'}) is an example only: 100 documents, with the query plus each document totaling 500 tokens. It is not a billed usage rate. ${BATCH_NOTE}`,
}));

export const VOYAGE_CATALOG_1126: AiCatalogItem[] = [
  ...VOYAGE_DOMAIN_EMBEDDINGS_1126, ...VOYAGE_MULTIMODAL_EMBEDDINGS_1126, ...VOYAGE_RERANKERS_1126,
];
