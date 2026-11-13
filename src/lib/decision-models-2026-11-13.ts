import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 2026-11-13 18:00 brief item 1. Official Perplexity Decisions API v1.3. */
export const VERIFIED = '2026-11-13';
export const PPLX_PRICING = 'https://docs.perplexity.ai/docs/getting-started/pricing';
export const PPLX_CHANGELOG = 'https://docs.perplexity.ai/docs/resources/changelog';
export const PPLX_QUICKSTART = 'https://docs.perplexity.ai/docs/decisions/quickstart';
export const CONTEXT = 262_144;

export interface DeciderV13Spec {
  slug: string;
  name: string;
  apiId: string;
  parameters: '27B' | '4B';
  input: number;
  latestAlias: string;
  vercelPage: string;
  openrouterFree: string;
  hf: string;
  aliases: readonly string[];
}

export const DECIDER_V13: DeciderV13Spec = {
  slug: 'perplexity-pplx-decider-v1-3',
  name: 'Perplexity Decider V1.3 27B',
  apiId: 'pplx-decider-v1.3',
  parameters: '27B',
  input: 0.02,
  latestAlias: 'pplx-decider-latest',
  vercelPage: 'https://vercel.com/ai-gateway/models/pplx-decider-v1.3',
  openrouterFree: 'https://openrouter.ai/perplexity/pplx-decider-v1.3:free',
  hf: 'https://huggingface.co/perplexity-ai/pplx-decider-v1.3',
  aliases: ['perplexity-pplx-decider-v1-3', 'pplx-decider-v1.3'],
};

export const DECIDER_FLASH_V13: DeciderV13Spec = {
  slug: 'perplexity-pplx-decider-flash-v1-3',
  name: 'Perplexity Decider V1.3 Flash',
  apiId: 'pplx-decider-flash-v1.3',
  parameters: '4B',
  input: 0.01,
  latestAlias: 'pplx-decider-flash-latest',
  vercelPage: 'https://vercel.com/ai-gateway/models/pplx-decider-flash-v1.3',
  openrouterFree: 'https://openrouter.ai/perplexity/pplx-decider-flash-v1.3:free',
  hf: 'https://huggingface.co/perplexity-ai/pplx-decider-flash-v1.3',
  aliases: ['perplexity-pplx-decider-flash-v1-3', 'pplx-decider-flash-v1.3'],
};

export const DECIDER_V13_MODELS: readonly DeciderV13Spec[] = [DECIDER_V13, DECIDER_FLASH_V13];

export function deciderV13Notes(spec: DeciderV13Spec): string {
  return [
    `Perplexity Decisions API model ${spec.apiId} (${spec.parameters}).`,
    `Official rate: $${spec.input} / 1M input tokens; output tokens free; no per-request fee.`,
    'Accepts text and images; the new locate question type is text-only and does not work with web grounding.',
    `Alias ${spec.latestAlias} (and perplexity/${spec.latestAlias}) selects this model and bills at its rate. v1.2 remains available under the pinned id.`,
    'Official docs label the context window as 256K tokens; Vercel AI Gateway and OpenRouter publish 262,144 (256 × 1024). The catalog stores 262,144, same as v1.2.',
    'Web grounding adds Fast Search at $0.001 per search ($1 / 1,000) and $0.001 per successful URL fetch, on top of input tokens. Not a standalone search-API row.',
    `Apache-2.0 open weights on Hugging Face ${spec.hf} (cardData license apache-2.0).`,
    `Vercel AI Gateway perplexity/${spec.apiId}: $` + `${spec.input}/1M input, max output tokens 0, context 262,144.`,
    `OpenRouter ${spec.apiId}:free is a published free channel (Input Free / Output Free, context 262K, released 2026-11-12). The public /api/v1/models list does not include it; paid OpenRouter pages for the non-free ids 404.`,
  ].join(' ');
}

function item(spec: DeciderV13Spec): AiCatalogItem {
  return {
    kind: 'decision-model',
    slug: spec.slug,
    name: spec.name,
    provider: 'Perplexity',
    providerSlug: 'perplexity',
    modelCategory: 'decision',
    status: 'available',
    releasedAt: '2026-11-12',
    pricing: `Official: $${spec.input}/M input; output free. Vercel AI Gateway: same rate. OpenRouter :free: $0/$0`,
    unit: '$/1M input tokens',
    pricingUnit: 'per_1m_tokens',
    billingUnit: 'per_token',
    inputPricePer1M: spec.input,
    outputPricePer1M: 0,
    pricePer1MTasks: null,
    priceStatus: 'priced',
    pricePerUnit: null,
    currency: 'USD',
    contextWindow: CONTEXT,
    contextWindowLabel: '262144 tokens',
    license: 'Apache-2.0',
    access: ['api', 'open-weights'],
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    capabilities: [],
    bestFor: 'Decision tasks, including locate (text spans with offsets and scores) on v1.3.',
    pricingProviderSlug: 'perplexity',
    pricingChannel: 'Official',
    pricingConfidence: 'verified',
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    notes: deciderV13Notes(spec),
    url: PPLX_PRICING,
    sourceUrls: [
      { label: 'Perplexity Decisions API pricing', url: PPLX_PRICING, publisher: 'Perplexity' },
      { label: 'Perplexity API changelog', url: PPLX_CHANGELOG, publisher: 'Perplexity' },
      { label: 'Decisions API quickstart', url: PPLX_QUICKSTART, publisher: 'Perplexity' },
      { label: 'Vercel AI Gateway model page', url: spec.vercelPage, publisher: 'Vercel' },
      { label: 'OpenRouter :free', url: spec.openrouterFree, publisher: 'OpenRouter' },
      { label: 'Hugging Face weights', url: spec.hf, publisher: 'Hugging Face' },
    ],
    deferredDbSeed: true,
    deferredDbSeedScript: 'seed:catalog-2026-11-13-decider-search-apis:apply',
  };
}

export const PERPLEXITY_DECIDER_V13_CATALOG: AiCatalogItem[] = DECIDER_V13_MODELS.map(item);
export const DECISION_MODELS_2026_11_13 = PERPLEXITY_DECIDER_V13_CATALOG;
