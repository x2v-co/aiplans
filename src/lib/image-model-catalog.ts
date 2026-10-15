import type { AiCatalogItem, AiCatalogModality } from './ai-vertical-catalog';

/**
 * Mainstream image-generation models (kind image-model), verified 2026-10-15 against official pricing pages.
 * Rules: itemized usageRates only (no availability placeholder rows); unknown fields stay unset;
 * pricePerUnit is the headline (cheapest standard per-image or per-1M image-output price).
 * Vision-understanding multimodal LLMs (Gemini, GPT, Claude, Qwen-VL...) stay in the LLM tables and are not duplicated here.
 */
const verified = { deferredDbSeed: true, lastVerified: '2026-10-15', verifiedAt: '2026-10-15', currency: 'USD', priceStatus: 'priced' as const, pricingConfidence: 'verified' as const };

type Rate = { priceKind: string; unit: string; price: number; approximate?: boolean };
interface Spec {
  slug: string; name: string; provider: string; providerSlug: string; pricingProviderSlug?: string; pricingChannel?: string;
  status?: AiCatalogItem['status']; pricing: string; pricingUnit: 'per_image' | 'per_1m_tokens' | 'per_megapixel';
  headline: number; rates: Rate[]; source: { label: string; url: string; publisher: string }[];
  input?: AiCatalogModality[]; capabilities?: string[]; access?: AiCatalogItem['access']; notes?: string; needsVerification?: string[];
  shutdownDate?: string; deprecatedAt?: string; replacementModel?: string; deprecationSourceUrl?: string; resolutionTier?: string;
}

function image(spec: Spec): AiCatalogItem {
  const { source, rates, headline, input, ...rest } = spec;
  return {
    ...verified, ...rest, kind: 'image-model', modelCategory: 'image', status: spec.status ?? 'available',
    unit: spec.pricingUnit === 'per_image' ? 'image' : spec.pricingUnit === 'per_megapixel' ? 'megapixel' : '1M tokens',
    billingUnit: spec.pricingUnit === 'per_1m_tokens' ? 'per_token' : undefined,
    pricePerUnit: headline, usageRates: rates,
    inputModalities: input ?? ['text', 'image'], outputModalities: ['image'], access: spec.access ?? ['api'],
    capabilities: spec.capabilities ?? ['image generation', 'image editing'], bestFor: `${spec.name} image generation API.`,
    url: source[0].url, sourceUrls: source,
  };
}

const GEMINI = { label: 'Gemini API pricing', url: 'https://ai.google.dev/gemini-api/docs/pricing', publisher: 'Google' };
const VERTEX = { label: 'Vertex AI generative AI pricing', url: 'https://cloud.google.com/vertex-ai/generative-ai/pricing', publisher: 'Google Cloud' };
const OPENAI = { label: 'OpenAI API pricing', url: 'https://developers.openai.com/api/docs/pricing', publisher: 'OpenAI' };
const OPENAI_DEPRECATIONS = 'https://platform.openai.com/docs/deprecations';

const tok = (kind: string, price: number): Rate => ({ priceKind: kind, unit: 'per_1m_tokens', price });
const img = (kind: string, price: number, approximate = false): Rate => ({ priceKind: kind, unit: 'image', price, ...(approximate ? { approximate } : {}) });

function gemini(slug: string, name: string, input: number, textOut: number, imageOut: number, perImage: Rate[], extra: Partial<Spec> = {}): AiCatalogItem {
  return image({
    slug, name, provider: 'Google', providerSlug: 'google', pricingUnit: 'per_1m_tokens', headline: imageOut,
    pricing: `$${input}/1M input; $${textOut}/1M text output; $${imageOut}/1M image output (${perImage.map(r => `${r.priceKind.replace('image_', '')} ≈ $${r.price}`).join(', ')})`,
    rates: [tok('input_tokens', input), tok('text_output_tokens', textOut), tok('image_output_tokens', imageOut), ...perImage],
    source: [GEMINI, VERTEX], ...extra,
  });
}

function gptImage(slug: string, textIn: number, imageIn: number, imageOut: number, textOut?: number, extra: Partial<Spec> = {}): AiCatalogItem {
  return image({
    slug, name: slug, provider: 'OpenAI', providerSlug: 'openai', pricingUnit: 'per_1m_tokens', headline: imageOut,
    pricing: `Text in $${textIn}/1M; image in $${imageIn}/1M; image out $${imageOut}/1M${textOut ? `; text out $${textOut}/1M` : ''}`,
    rates: [tok('text_input_tokens', textIn), tok('image_input_tokens', imageIn), tok('image_output_tokens', imageOut), ...(textOut ? [tok('text_output_tokens', textOut)] : [])],
    source: [OPENAI], notes: 'Standard tier; Batch is 50% off. Per-image cost depends on size/quality (see OpenAI image generation calculator).', ...extra,
  });
}

export const IMAGE_MODEL_CATALOG_GOOGLE_OPENAI: AiCatalogItem[] = [
  gemini('gemini-nano-banana-2.1', 'Nano Banana 2.1 (gemini-nano-banana-2.1)', 1.5, 7.5, 30,
    [img('image_1k', 0.0336, true), img('image_2k', 0.0504, true), img('image_4k', 0.113, true)],
    { notes: 'Update to Nano Banana 2 (Gemini 3.1 Flash Image). Batch 50% off. Reuses the existing LLM-table row if present.' }),
  gemini('gemini-3.1-flash-image', 'Nano Banana 2 (Gemini 3.1 Flash Image)', 0.5, 3, 60,
    [img('image_0.5k', 0.045, true), img('image_1k', 0.067, true), img('image_2k', 0.101, true), img('image_4k', 0.151, true)]),
  gemini('gemini-3.1-flash-lite-image', 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', 0.25, 1.5, 30,
    [img('image_1k', 0.0336, true)], { notes: 'API model id is not printed on the Gemini pricing page; slug follows the product name.' }),
  gemini('gemini-3-pro-image', 'Nano Banana Pro (Gemini 3 Pro Image)', 2, 12, 120,
    [img('image_1k_2k', 0.134, true), img('image_4k', 0.24, true)]),
  image({
    slug: 'gemini-2.5-flash-image', name: 'Nano Banana (Gemini 2.5 Flash Image)', provider: 'Google', providerSlug: 'google',
    status: 'discontinued', deprecatedAt: '2026-10-02', shutdownDate: '2026-10-02', replacementModel: 'gemini-3.1-flash-image or gemini-3.1-flash-lite-image',
    deprecationSourceUrl: GEMINI.url, pricingUnit: 'per_1m_tokens', headline: 30,
    pricing: '$0.30/1M input; $30/1M image output (≈ $0.039 per ≤1024px image). Shut down 2026-10-02.',
    rates: [tok('input_tokens', 0.3), tok('image_output_tokens', 30), img('image_1k', 0.039, true)], source: [GEMINI, VERTEX],
  }),
  ...([['imagen-4-ultra', 'Imagen 4 Ultra', 0.06], ['imagen-4', 'Imagen 4', 0.04], ['imagen-4-fast', 'Imagen 4 Fast', 0.02]] as const).map(([slug, name, price]) => image({
    slug, name, provider: 'Google', providerSlug: 'google', pricingProviderSlug: 'vertex-ai', pricingChannel: 'Vertex AI',
    pricingUnit: 'per_image', headline: price, pricing: `$${price}/image`, rates: [img('image', price)], input: ['text'],
    capabilities: ['text-to-image'], source: [VERTEX],
    notes: 'Priced on Vertex AI (Agent Platform). Imagen is no longer listed on the Gemini Developer API pricing page (checked 2026-10-15).',
  })),
  gptImage('gpt-image-2.5-sunburst', 5, 8, 30),
  gptImage('gpt-image-2.5-flare', 5, 8, 30),
  gptImage('gpt-image-2', 5, 8, 30),
  gptImage('gpt-image-1.5', 5, 8, 32, 10, { status: 'deprecated', shutdownDate: '2026-12-01', deprecationSourceUrl: OPENAI_DEPRECATIONS }),
  gptImage('gpt-image-1-mini', 2, 2.5, 8),
  gptImage('gpt-image-1', 5, 10, 40, undefined, { status: 'deprecated', shutdownDate: '2026-10-23', deprecationSourceUrl: OPENAI_DEPRECATIONS, replacementModel: 'gpt-image-2.5-sunburst or gpt-image-2.5-flare' }),
];

export const IMAGE_MODEL_CATALOG: AiCatalogItem[] = [...IMAGE_MODEL_CATALOG_GOOGLE_OPENAI];
