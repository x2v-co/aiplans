import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 2026-11-12 P1-7. Official Gemini Decision 1; input-only Decisions API. */
export const GEMINI_DECISION_SLUG = 'gemini-decision-1';
export const GEMINI_DECISION_ALIASES = [GEMINI_DECISION_SLUG, 'google-gemini-decision-1'] as const;
export const GEMINI_DECISION_SPEC = {
  slug: GEMINI_DECISION_SLUG,
  name: 'Gemini Decision 1',
  provider: 'Google',
  providerSlug: 'google',
  endpoint: 'gemini-decision-1',
  vercelId: 'google/gemini-decision-1',
  inputOnly: true,
  openWeights: false,
  input: 0.10,
  output: 0,
  context: 262_144,
  releasedAt: '2026-11-11',
  officialPage: 'https://ai.google.dev/gemini-api/docs/models/gemini-decision-1',
  pricingPage: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-decision',
  deprecationsPage: 'https://ai.google.dev/gemini-api/docs/deprecations',
  vercelModels: 'https://ai-gateway.vercel.sh/v1/models/google/gemini-decision-1',
} as const;

export const GEMINI_DECISION_NOTES = [
  'Google Decisions API model gemini-decision-1, released 2026-11-11.',
  'Multimodal evaluations (binary, categorical, rubric) over shared input; up to 1,000 questions per request; shared input tokens billed once.',
  'Official paid tier: $0.10 / 1M input tokens, same price for text, image, video, audio, and PDF.',
  'Output is not applicable (0 output tokens; calibrated probabilities). Context caching is not available. Batch API is not supported.',
  'Free tier is available; free-tier content may be used to improve Google products, paid tier is not.',
  'Input token limit 262,144; output token limit 0. Deprecations table: no shutdown date announced.',
  'The catalog modality enum has no pdf member; PDF support is recorded here, not as a structured modality.',
  `Vercel AI Gateway ${GEMINI_DECISION_SPEC.vercelId}: GET /v1/models on 2026-11-12 lists context_window 262144, max_tokens 0, type evaluation, pricing.input 0.0000001 ($0.10 / 1M), pricing.output "0". Gateway modalities list text, image, and pdf; official docs also include video and audio.`,
].join(' ');

export const GEMINI_DECISION_1: AiCatalogItem = {
  kind: 'decision-model',
  slug: GEMINI_DECISION_SPEC.slug,
  name: GEMINI_DECISION_SPEC.name,
  provider: GEMINI_DECISION_SPEC.provider,
  providerSlug: GEMINI_DECISION_SPEC.providerSlug,
  modelCategory: 'decision',
  status: 'available',
  releasedAt: GEMINI_DECISION_SPEC.releasedAt,
  pricing: 'Official: $0.10/M input (text, image, video, audio, PDF); output free (0 tokens); no cache; no Batch. Vercel AI Gateway: $0.10/M input, $0 output',
  unit: '$/1M input tokens',
  pricingUnit: 'per_1m_tokens',
  billingUnit: 'per_token',
  inputPricePer1M: GEMINI_DECISION_SPEC.input,
  outputPricePer1M: 0,
  pricePer1MTasks: null,
  priceStatus: 'priced',
  pricePerUnit: null,
  currency: 'USD',
  contextWindow: GEMINI_DECISION_SPEC.context,
  contextWindowLabel: '262144 tokens',
  access: ['api'],
  inputModalities: ['text', 'image', 'video', 'audio'],
  outputModalities: ['text'],
  capabilities: [],
  bestFor: 'Typed decision questions (yes/no, choice, rubric) over shared multimodal input; no text generation.',
  pricingProviderSlug: 'google',
  pricingChannel: 'Official',
  pricingConfidence: 'verified',
  lastVerified: '2026-11-12',
  verifiedAt: '2026-11-12',
  notes: GEMINI_DECISION_NOTES,
  url: GEMINI_DECISION_SPEC.officialPage,
  sourceUrls: [
    { label: 'Gemini Decision 1 model page', url: GEMINI_DECISION_SPEC.officialPage, publisher: 'Google' },
    { label: 'Gemini Decision pricing', url: GEMINI_DECISION_SPEC.pricingPage, publisher: 'Google' },
    { label: 'Gemini deprecations', url: GEMINI_DECISION_SPEC.deprecationsPage, publisher: 'Google' },
    { label: 'Vercel AI Gateway model record', url: GEMINI_DECISION_SPEC.vercelModels, publisher: 'Vercel' },
  ],
  deferredDbSeed: true,
  deferredDbSeedScript: 'seed:catalog-2026-11-12-audit-fixes:apply',
};

export const DECISION_MODELS_2026_11_12: AiCatalogItem[] = [GEMINI_DECISION_1];
