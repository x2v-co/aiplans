import type { AiCatalogItem, AiCatalogModality } from './ai-vertical-catalog';

/**
 * Intel 2026-11-03 P1-2: decision models missing from the category. All bill input tokens
 * only (output $0, no per-task fee). Verified 2026-11-03 against the official pages below.
 * DB rows are written only by the manual seed (seed:catalog-2026-11-03-p1).
 */
export const CLEF_BLOG = 'https://blog.cloudflare.com/clef-faster-cheaper-multimodal/';
export const WORKERS_AI_DOCS = 'https://developers.cloudflare.com/workers-ai/models/';
export const VERCEL_MODELS = 'https://ai-gateway.vercel.sh/v1/models';
export const VERIFIED_1103 = '2026-11-03';

interface Spec {
  slug: string; name: string; provider: string; providerSlug: string; input: number; context: number;
  inputModalities: AiCatalogModality[]; openWeights: boolean; status: 'available' | 'preview';
  channel: 'workers-ai' | 'vercel'; endpoint: string; note: string; sources: { label: string; url: string; publisher: string }[];
}

const cfDocs = (id: string) => ({ label: `Workers AI ${id}`, url: `${WORKERS_AI_DOCS}${id}/`, publisher: 'Cloudflare' });
const vercel = { label: 'Vercel AI Gateway models', url: VERCEL_MODELS, publisher: 'Vercel' };
const clefBlog = { label: 'Cloudflare blog: Clef-omni, faster Clef, cheaper Clef-flash', url: CLEF_BLOG, publisher: 'Cloudflare' };

export const DECISION_1103_SPECS: Spec[] = [
  { slug: 'cloudflare-clef', name: 'Cloudflare Clef', provider: 'Cloudflare', providerSlug: 'cloudflare', input: 0.24, context: 65_536,
    inputModalities: ['text', 'image'], openWeights: true, status: 'available', channel: 'workers-ai', endpoint: '@cf/cloudflare/clef',
    note: '27B multimodal (text + image) decision model; open weights on Hugging Face. Price unchanged at $0.24/M input in the 2026-10-09 update.',
    sources: [cfDocs('clef'), clefBlog] },
  { slug: 'cloudflare-clef-omni', name: 'Cloudflare Clef-omni', provider: 'Cloudflare', providerSlug: 'cloudflare', input: 0.15, context: 64_000,
    inputModalities: ['text', 'image', 'audio', 'video'], openWeights: true, status: 'available', channel: 'workers-ai', endpoint: '@cf/cloudflare/clef-omni',
    note: 'Decision model on a 30B MoE (3B active) backbone with text, image, audio and video input; launched 2026-10-09; open weights. Media inputs are converted to input tokens.',
    sources: [cfDocs('clef-omni'), clefBlog] },
  { slug: 'cloudflare-clef-flash', name: 'Cloudflare Clef-flash', provider: 'Cloudflare', providerSlug: 'cloudflare', input: 0.038, context: 24_576,
    inputModalities: ['text', 'image'], openWeights: true, status: 'available', channel: 'workers-ai', endpoint: '@cf/cloudflare/clef-flash',
    note: '9B multimodal decision model. Cut from $0.09 to $0.038/M input on 2026-10-09; hosted context reduced to 24,576 tokens (weights support 256K when self-hosted).',
    sources: [cfDocs('clef-flash'), clefBlog] },
  { slug: 'cloudflare-clairic', name: 'Cloudflare Clairic', provider: 'Cloudflare', providerSlug: 'cloudflare', input: 0.10, context: 65_536,
    inputModalities: ['text', 'image'], openWeights: false, status: 'preview', channel: 'workers-ai', endpoint: '@cf/cloudflare/clairic',
    note: 'Typed extraction / estimation model (values with confidence scores and probabilities), vision input; in preview from the Workers AI team.',
    sources: [cfDocs('clairic')] },
  { slug: 'baseten-mammoth-1', name: 'Baseten Mammoth-1', provider: 'Baseten', providerSlug: 'baseten', input: 0.10, context: 16_384,
    inputModalities: ['text'], openWeights: true, status: 'available', channel: 'vercel', endpoint: 'baseten/mammoth-1',
    note: '27B decision model from Baseten Base Labs (fine-tuned from Qwen3.5-27B) for classification, routing and scoring; open weights. Vercel AI Gateway, US region.',
    sources: [vercel] },
  { slug: 'baseten-elephant-1', name: 'Baseten Elephant-1', provider: 'Baseten', providerSlug: 'baseten', input: 0.035, context: 16_384,
    inputModalities: ['text'], openWeights: true, status: 'available', channel: 'vercel', endpoint: 'baseten/elephant-1',
    note: '9B decision model from Baseten Base Labs for classification, routing and scoring; open weights. Vercel AI Gateway, US region.',
    sources: [vercel] },
  { slug: 'liquid-d1', name: 'Liquid d1', provider: 'Liquid AI', providerSlug: 'liquid', input: 0.02, context: 65_536,
    inputModalities: ['text', 'image'], openWeights: false, status: 'available', channel: 'vercel', endpoint: 'liquid/d1',
    note: 'Decision model (Choice / Score / yes-no questions with calibrated probabilities, TypeSafe-compatible System One API); vision input. Vercel AI Gateway.',
    sources: [vercel] },
  { slug: 'liquid-d1-ultra', name: 'Liquid d1 Ultra', provider: 'Liquid AI', providerSlug: 'liquid', input: 0.042, context: 32_768,
    inputModalities: ['text', 'image'], openWeights: false, status: 'available', channel: 'vercel', endpoint: 'liquid/d1-ultra',
    note: 'Multimodal (text + image) decision model with calibrated probabilities in a single forward pass. Vercel AI Gateway.',
    sources: [vercel] },
];

export const DECISION_MODELS_2026_11_03: AiCatalogItem[] = DECISION_1103_SPECS.map(spec => ({
  kind: 'decision-model', slug: spec.slug, name: spec.name, provider: spec.provider, providerSlug: spec.providerSlug,
  modelCategory: 'decision', status: spec.status,
  pricing: `${spec.channel === 'vercel' ? 'Vercel AI Gateway' : 'Workers AI'}: $${spec.input}/M input; output free`,
  unit: '$/1M input tokens', pricingUnit: 'per_1m_tokens', billingUnit: 'per_token',
  inputPricePer1M: spec.input, outputPricePer1M: 0, pricePer1MTasks: null,
  priceStatus: 'priced', pricePerUnit: null, currency: 'USD',
  contextWindow: spec.context, contextWindowLabel: `${spec.context} tokens`,
  access: spec.openWeights ? ['api', 'open-weights'] : ['api'],
  inputModalities: spec.inputModalities, outputModalities: ['text'],
  capabilities: [], bestFor: 'Decision tasks.',
  ...(spec.channel === 'vercel'
    ? { pricingProviderSlug: 'vercel-ai-gateway', pricingChannel: 'Vercel AI Gateway' }
    : { pricingChannel: 'Cloudflare Workers AI' }),
  pricingConfidence: 'verified', lastVerified: VERIFIED_1103, verifiedAt: VERIFIED_1103,
  notes: `${spec.channel === 'vercel' ? 'Vercel AI Gateway' : 'Workers AI'} ID: ${spec.endpoint}. ${spec.note} Billed on input tokens only; output $0; no per-task fee.`,
  url: spec.sources[0].url, sourceUrls: spec.sources,
  deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-03-p1:apply',
}));
