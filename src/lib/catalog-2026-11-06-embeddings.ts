import type { AiCatalogItem } from './ai-vertical-catalog';

/**
 * Embedding rows checked 2026-11-06. Every stored number is copied from the
 * official page named on the row. A model with no official token price is
 * listed in EMBEDDING_OMITTED_1106 and is not part of the catalog.
 */
export const VERIFIED_1106 = '2026-11-06';
export const EMBEDDING_SOURCES_1106 = {
  voyage: 'https://docs.voyageai.com/docs/pricing',
  cohereBlog: 'https://cohere.com/blog/embed-5',
  cohereModels: 'https://docs.cohere.com/docs/cohere-embed',
  qwenPricing: 'https://help.aliyun.com/en/model-studio/model-pricing',
  qwenApi: 'https://www.alibabacloud.com/help/en/model-studio/text-embedding-synchronous-api',
} as const;

/** Checked the same day and left out because the official page did not publish a token price. */
export const EMBEDDING_OMITTED_1106 = [
  {
    id: 'embed-v4.0',
    reason: 'docs.cohere.com lists the model but no token price. cohere.com/pricing did not render an Embed 4 rate. AWS Marketplace / Vercel figures were not used.',
  },
  {
    id: 'qwen3-embedding-0.6b',
    reason: 'Open-weight id. Alibaba Model Studio prices text-embedding-v4 as the hosted Qwen3-Embedding series, not the 0.6B/4B/8B weight files.',
  },
  {
    id: 'qwen3-embedding-4b',
    reason: 'Open-weight id. No official hosted token price.',
  },
  {
    id: 'qwen3-embedding-8b',
    reason: 'Open-weight id. No official hosted token price.',
  },
] as const;

type Rate = NonNullable<AiCatalogItem['usageRates']>[number];
const text = (price: number): Rate => ({ priceKind: 'text input', price, unit: 'per_1m_tokens' });

function row(slug: string, name: string, provider: string, providerSlug: string, source: string, fields: Partial<AiCatalogItem>): AiCatalogItem {
  return {
    slug, name, provider, providerSlug, kind: 'embedding-model', modelCategory: 'embedding', status: 'available',
    pricing: '', unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens', priceStatus: 'priced', pricingConfidence: 'verified',
    currency: 'USD', access: ['api'], capabilities: ['text embedding'], bestFor: `${name} embedding API.`,
    inputModalities: ['text'], outputModalities: ['embedding'],
    lastVerified: VERIFIED_1106, verifiedAt: VERIFIED_1106, url: source,
    sourceUrls: [{ label: `${provider} official pricing`, url: source, publisher: provider }],
    deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-06-embeddings:apply', ...fields,
  };
}

const VOYAGE_NOTE = 'Text Embeddings table on the Voyage pricing page, checked 2026-11-06. First 200 million tokens are free per account. Batch API is 33% off the standard rate and does not draw that free balance; the discounted batch amount is not stored as a separate rate.';

export const VOYAGE_EMBEDDINGS_1106: AiCatalogItem[] = ([
  ['voyage-4-large', 0.12],
  ['voyage-4', 0.06],
  ['voyage-4-lite', 0.02],
  ['voyage-context-4', 0.12],
  ['voyage-code-4', 0.12],
] as const).map(([slug, price]) => row(slug, slug, 'Voyage AI', 'voyage', EMBEDDING_SOURCES_1106.voyage, {
  pricing: `$${price.toFixed(2)}/M input tokens`,
  inputPricePer1M: price,
  usageRates: [text(price)],
  notes: VOYAGE_NOTE,
}));

export const COHERE_EMBEDDINGS_1106: AiCatalogItem[] = ([
  ['embed-v5.0-pro', 'Embed 5 Pro', 0.12],
  ['embed-v5.0-fast', 'Embed 5 Fast', 0.08],
] as const).map(([slug, name, price]) => row(slug, name, 'Cohere', 'cohere', EMBEDDING_SOURCES_1106.cohereBlog, {
  pricing: `Text $${price.toFixed(2)}/M; image $0.40/M tokens`,
  inputPricePer1M: price,
  inputModalities: ['text', 'image'],
  contextWindow: 128000,
  contextWindowLabel: '128K',
  capabilities: ['text embedding', 'image embedding'],
  usageRates: [text(price), { priceKind: 'image input', price: 0.4, unit: 'per_1m_tokens' }],
  notes: 'Cohere blog Embed 5 snapshot: text rate above, image $0.40/M tokens. Model id, 128K context and text/image inputs are from the Cohere Embed docs. embed-v4.0 has no token price on those pages and is not listed.',
  sourceUrls: [
    { label: 'Cohere Embed 5 announcement', url: EMBEDDING_SOURCES_1106.cohereBlog, publisher: 'Cohere' },
    { label: 'Cohere Embed model docs', url: EMBEDDING_SOURCES_1106.cohereModels, publisher: 'Cohere' },
  ],
}));

export const QWEN_EMBEDDING_1106: AiCatalogItem = row(
  'text-embedding-v4', 'text-embedding-v4', 'Alibaba', 'qwen', EMBEDDING_SOURCES_1106.qwenPricing, {
    pricing: '¥0.50/M input tokens; batch ¥0.25/M (China Beijing)',
    currency: 'CNY',
    inputPricePer1M: 0.5,
    contextWindow: 8192,
    contextWindowLabel: '8,192 tokens/line',
    usageRates: [text(0.5), { priceKind: 'text input (batch)', price: 0.25, unit: 'per_1m_tokens' }],
    notes: 'China (Beijing) list price on the Model Studio pricing page: CNY 0.5 per 1M input tokens, 50% batch discount (CNY 0.25/1M). The synchronous API page labels this model "Part of the Qwen3-Embedding series" and prices it at CNY 0.0005 per 1K input tokens (batch CNY 0.00025/1K), which is the same rate. Singapore CNY 0.514/1M and Hong Kong CNY 0.51/1M are other regions and are not this row. Qwen3-Embedding-0.6B/4B/8B open weights have no official hosted price and are not listed. Free quota: 1 million tokens, 90 days.',
    sourceUrls: [
      { label: 'Alibaba Model Studio pricing', url: EMBEDDING_SOURCES_1106.qwenPricing, publisher: 'Alibaba Cloud' },
      { label: 'Alibaba text embedding API', url: EMBEDDING_SOURCES_1106.qwenApi, publisher: 'Alibaba Cloud' },
    ],
  },
);

export const EMBEDDING_MODELS_1106: AiCatalogItem[] = [...VOYAGE_EMBEDDINGS_1106, ...COHERE_EMBEDDINGS_1106, QWEN_EMBEDDING_1106];
