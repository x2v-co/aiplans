import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 2026-11-05 18:00; input-only decision endpoint, like the 11-03 models. */
export const MORPH_REFLEX_SPEC = {
  slug: 'morph-reflex', name: 'Morph Reflex', provider: 'Morph', providerSlug: 'morph',
  endpoint: 'morph/reflex', channel: 'openrouter', inputOnly: true, openWeights: false,
  input: 0.042, cache: 0.008, output: 0, context: 65_536,
  source: 'https://openrouter.ai/morph/reflex', releasedAt: '2026-11-03',
} as const;

export const MORPH_REFLEX: AiCatalogItem = {
  kind: 'decision-model', slug: MORPH_REFLEX_SPEC.slug, name: MORPH_REFLEX_SPEC.name,
  provider: MORPH_REFLEX_SPEC.provider, providerSlug: MORPH_REFLEX_SPEC.providerSlug,
  modelCategory: 'decision', status: 'available', releasedAt: MORPH_REFLEX_SPEC.releasedAt,
  pricing: 'OpenRouter: $0.042/M input; $0.008/M cache read; output free',
  unit: '$/1M input tokens', pricingUnit: 'per_1m_tokens', billingUnit: 'per_token',
  inputPricePer1M: MORPH_REFLEX_SPEC.input, outputPricePer1M: 0, pricePer1MTasks: null,
  priceStatus: 'priced', pricePerUnit: null, currency: 'USD',
  contextWindow: MORPH_REFLEX_SPEC.context, contextWindowLabel: '65536 tokens',
  access: ['api'], inputModalities: ['text', 'image'], outputModalities: ['text'],
  capabilities: [], bestFor: 'Decision tasks (choice / score); no text generation.',
  pricingProviderSlug: 'openrouter', pricingChannel: 'OpenRouter',
  pricingConfidence: 'verified', lastVerified: '2026-11-05', verifiedAt: '2026-11-05',
  notes: 'OpenRouter ID: morph/reflex. Released 2026-11-03. 27B decision model; text and image input; outputs structured decisions (choice / score), no text generation. Text output modality denotes serialized decisions, following the decision catalog convention. Billed on input tokens only: $0.042/M input, $0.008/M cache read, output $0; no per-task fee. Weights not published (no public weights found).',
  url: MORPH_REFLEX_SPEC.source,
  sourceUrls: [{ label: 'OpenRouter Morph Reflex', url: MORPH_REFLEX_SPEC.source, publisher: 'OpenRouter' }],
  deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-05-1800:apply',
};

export const DECISION_MODELS_2026_11_05: AiCatalogItem[] = [MORPH_REFLEX];
