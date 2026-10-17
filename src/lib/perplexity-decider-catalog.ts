import type { AiCatalogItem } from './ai-vertical-catalog';

export const DECIDER_SOURCE = 'https://vercel.com/changelog/perplexity-decider-v1-2-models-now-available-on-ai-gateway';

/** Verified 2026-10-17. These rates apply only to Vercel AI Gateway. */
export const PERPLEXITY_DECIDER_CATALOG: AiCatalogItem[] = [
  { slug: 'perplexity-pplx-decider-v1-2', name: 'Perplexity Decider V1.2 27B', input: 0.02,
    endpoint: 'perplexity/pplx-decider-v1.2' },
  { slug: 'perplexity-pplx-decider-flash-v1-2', name: 'Perplexity Decider V1.2 Flash', input: 0.01,
    endpoint: 'perplexity/pplx-decider-flash-v1.2' },
].map(({ slug, name, input, endpoint }) => ({
  kind: 'decision-model', slug, name, provider: 'Perplexity', providerSlug: 'perplexity',
  modelCategory: 'decision', status: 'available',
  pricing: `Vercel AI Gateway: $${input}/M input; output free`,
  unit: '$/1M input tokens', pricingUnit: 'per_1m_tokens', billingUnit: 'per_token',
  inputPricePer1M: input, outputPricePer1M: 0, pricePer1MTasks: null,
  priceStatus: 'priced', pricePerUnit: null, currency: 'USD',
  contextWindow: 262_144, contextWindowLabel: '262144 tokens',
  license: 'Apache-2.0', access: ['api', 'open-weights'],
  inputModalities: ['text'], outputModalities: ['text'],
  capabilities: [], bestFor: 'Decision tasks.',
  pricingProviderSlug: 'vercel-ai-gateway', pricingChannel: 'Vercel AI Gateway',
  pricingConfidence: 'verified', lastVerified: '2026-10-17', verifiedAt: '2026-10-17',
  notes: `Vercel AI Gateway ID: ${endpoint}. Billed on input tokens only; output $0. Apache-2.0 open weights. Cache and per-task rates are unverified.`,
  url: DECIDER_SOURCE,
  sourceUrls: [{ label: 'Vercel AI Gateway announcement', url: DECIDER_SOURCE, publisher: 'Vercel' }],
  deferredDbSeed: true, deferredDbSeedScript: 'seed:glimpse-decider:apply',
}));
