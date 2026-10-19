import type { AiCatalogItem, AiCatalogModality } from './ai-vertical-catalog';

/**
 * Mainstream image-generation models (kind image-model), verified 2026-10-15 against official pricing pages.
 * Rules: itemized usageRates only (no availability placeholder rows); unknown fields stay unset;
 * pricePerUnit is the headline (cheapest standard per-image or per-1M image-output price).
 * Vision-understanding multimodal LLMs (Gemini, GPT, Claude, Qwen-VL...) stay in the LLM tables and are not duplicated here.
 */
const verified = { deferredDbSeed: true, deferredDbSeedScript: 'seed:image-models-2026-10-15:apply', lastVerified: '2026-10-15', verifiedAt: '2026-10-15', currency: 'USD', priceStatus: 'priced' as const, pricingConfidence: 'verified' as const };

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
  gptImage('gpt-image-1-mini', 2, 2.5, 8, undefined, {
    status: 'deprecated', shutdownDate: '2026-12-01', deprecationSourceUrl: OPENAI_DEPRECATIONS,
    replacementModel: 'gpt-image-2.5-sunburst or gpt-image-2.5-flare',
  }),
  gptImage('gpt-image-1', 5, 10, 40, undefined, { status: 'deprecated', shutdownDate: '2026-10-23', deprecationSourceUrl: OPENAI_DEPRECATIONS, replacementModel: 'gpt-image-2.5-sunburst or gpt-image-2.5-flare' }),
];

const BFL = { label: 'Black Forest Labs API pricing', url: 'https://docs.bfl.ai/quick_start/pricing', publisher: 'Black Forest Labs' };
const BYTEPLUS = { label: 'BytePlus ModelArk model pricing', url: 'https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing', publisher: 'BytePlus' };
const QWEN = { label: 'Alibaba Cloud Model Studio pricing (International/Singapore)', url: 'https://www.alibabacloud.com/help/en/model-studio/model-pricing', publisher: 'Alibaba Cloud' };
const RECRAFT = { label: 'Recraft API pricing', url: 'https://www.recraft.ai/docs/api-reference/pricing', publisher: 'Recraft' };
const XAI = { label: 'xAI models and pricing', url: 'https://docs.x.ai/docs/models', publisher: 'xAI' };
const IDEOGRAM = { label: 'Ideogram API pricing', url: 'https://ideogram.ai/pricing/?pricing_tab=api', publisher: 'Ideogram' };
const mp = (kind: string, price: number): Rate => ({ priceKind: kind, unit: 'megapixel', price });

function perImage(provider: string, providerSlug: string, src: { label: string; url: string; publisher: string }, slug: string, name: string, rates: Rate[], extra: Partial<Spec> = {}): AiCatalogItem {
  const headline = Math.min(...rates.filter(r => r.unit === 'image').map(r => r.price));
  return image({
    slug, name, provider, providerSlug, pricingUnit: 'per_image', headline, rates, source: [src],
    pricing: rates.map(r => `${r.priceKind}: $${r.price}/${r.unit}`).join('; '), ...extra,
  });
}

const bfl = (slug: string, name: string, rates: Rate[], extra: Partial<Spec> = {}) =>
  perImage('Black Forest Labs', 'bfl', BFL, slug, name, rates, { notes: '1 credit = $0.01.', ...extra });
function flux2(slug: string, name: string, first: number, extraMp: number, inputMp: number): AiCatalogItem {
  return image({
    slug, name, provider: 'Black Forest Labs', providerSlug: 'bfl', pricingUnit: 'per_megapixel', headline: first, source: [BFL],
    pricing: `$${first} first output MP; $${extraMp} each additional output MP; $${inputMp} per input (reference) MP`,
    rates: [mp('output_first_megapixel', first), mp('output_additional_megapixel', extraMp), mp('input_megapixel', inputMp)],
    notes: '1 credit = $0.01. Billed by megapixel; a 1024x1024 image is ~1 MP.',
  });
}
const seedream = (slug: string, name: string, rates: Rate[], extra: Partial<Spec> = {}) =>
  perImage('ByteDance (BytePlus ModelArk)', 'volcengine', BYTEPLUS, slug, name, rates, extra);
const qwen = (slug: string, name: string, rates: Rate[]) =>
  perImage('Alibaba Cloud (Qwen)', 'qwen', QWEN, slug, name, rates, { notes: 'International (Singapore) deployment price; Mainland China prices differ.' });
const recraft = (slug: string, name: string, rates: Rate[]) => perImage('Recraft', 'recraft', RECRAFT, slug, name, rates);
const grok = (slug: string, name: string, price: number, extra: Partial<Spec> = {}) => perImage('xAI', 'xai', XAI, slug, name, [img('image', price)], extra);
const ideogram = (slug: string, name: string, rates: Rate[], extra: Partial<Spec> = {}) => perImage('Ideogram', 'ideogram', IDEOGRAM, slug, name, rates, extra);
const tiers = (prefix: string, prices: [string, number][]) => prices.map(([tier, price]) => img(`${prefix}_${tier}`, price));

export const IMAGE_MODEL_CATALOG_OTHERS: AiCatalogItem[] = [
  bfl('flux-3-image', 'FLUX 3 Image', [img('image_768', 0.041), img('image_1k', 0.048), img('image_1.5k', 0.07), img('image_2k', 0.1), img('image_4k', 0.607)]),
  flux2('flux-2-max', 'FLUX.2 [max]', 0.07, 0.03, 0.03),
  flux2('flux-2-pro', 'FLUX.2 [pro]', 0.03, 0.015, 0.015),
  flux2('flux-2-flex', 'FLUX.2 [flex]', 0.05, 0.05, 0.05),
  flux2('flux-2-klein-9b', 'FLUX.2 [klein] 9B', 0.015, 0.002, 0.002),
  flux2('flux-2-klein-4b', 'FLUX.2 [klein] 4B', 0.014, 0.001, 0.001),
  bfl('flux-kontext-max', 'FLUX.1 Kontext [max]', [img('image', 0.08)]),
  bfl('flux-kontext-pro', 'FLUX.1 Kontext [pro]', [img('image', 0.04)]),
  bfl('flux-1.1-pro-ultra', 'FLUX1.1 [pro] Ultra', [img('image', 0.06)]),
  bfl('flux-1.1-pro', 'FLUX1.1 [pro]', [img('image', 0.04)]),
  seedream('dola-seedream-5-0-pro', 'Seedream 5.0 Pro', [img('image_up_to_1.5k', 0.045), img('image_above_1.5k', 0.09), img('reference_image_after_first', 0.003)],
    { notes: 'First reference image is free; each additional reference image $0.003.' }),
  seedream('seedream-5-0-lite', 'Seedream 5.0 Lite', [img('image', 0.035)]),
  seedream('seedream-5-0-flash', 'Seedream 5.0 Flash', [img('image', 0.018)]),
  seedream('seedream-4-5', 'Seedream 4.5', [img('image', 0.04)]),
  seedream('seedream-4-0', 'Seedream 4.0', [img('image', 0.03)]),
  qwen('qwen-image-3.0-pro', 'Qwen-Image 3.0 Pro', [img('image_1k', 0.04), img('image_2k', 0.075), img('input_image', 0.003)]),
  qwen('qwen-image-3.0', 'Qwen-Image 3.0', [img('image', 0.03), img('input_image', 0.003)]),
  qwen('qwen-image-2.1-pro', 'Qwen-Image 2.1 Pro', [img('image', 0.04)]),
  qwen('qwen-image-2.1-turbo', 'Qwen-Image 2.1 Turbo', [img('image', 0.016)]),
  qwen('qwen-image-2.0-pro', 'Qwen-Image 2.0 Pro', [img('image', 0.075)]),
  qwen('qwen-image-2.0', 'Qwen-Image 2.0', [img('image', 0.035)]),
  recraft('recraft-v4.1-flash', 'Recraft V4.1 Flash', [img('raster_image', 0.007)]),
  recraft('recraft-v4.1', 'Recraft V4.1', [img('raster_image', 0.035), img('vector_image', 0.08), img('pro_raster_image', 0.21), img('pro_vector_image', 0.3)]),
  recraft('recraft-v4', 'Recraft V4', [img('raster_image', 0.04), img('vector_image', 0.08), img('pro_raster_image', 0.25), img('pro_vector_image', 0.3)]),
  grok('grok-imagine-image-2.0', 'Grok Imagine Image 2.0', 0.04),
  grok('grok-imagine-image-quality', 'Grok Imagine Image (quality)', 0.05, {
    status: 'deprecated', deprecatedAt: '2026-09-02', shutdownDate: '2026-11-02',
    replacementModel: 'grok-imagine-image-2.0 (quality: low)',
    deprecationSourceUrl: 'https://docs.x.ai/developers/migration/imagine-image-quality-nov-2',
    source: [
      { label: 'xAI pricing', url: 'https://docs.x.ai/developers/pricing', publisher: 'xAI' },
      { label: 'grok-imagine-image-quality retirement', url: 'https://docs.x.ai/developers/migration/imagine-image-quality-nov-2', publisher: 'xAI' },
    ],
    notes: 'Notice began 2026-09-02. On 2026-11-02 the slug is served by grok-imagine-image-2.0 with quality low and billed at that model\'s low rate. The migration page says low is $0.01/image cheaper and does not print the low dollar amount. The $0.05 headline is the pre-retirement quality price on the pricing page (checked 2026-10-19). grok-imagine-image 1.0 is not part of this retirement.',
  }),
  grok('grok-imagine-image', 'Grok Imagine Image', 0.02),
  ideogram('ideogram-4.5', 'Ideogram 4.5', [
    ...tiers('image', [['low', 0.03], ['medium', 0.06], ['high', 0.1]]), img('image_high_with_reference', 0.22),
    ...tiers('precise_edit', [['tier_1', 0.008], ['tier_2', 0.03], ['tier_3', 0.06], ['tier_4', 0.22]]),
  ], { headline: 0.03, notes: 'Generate low/medium/high; 1K and 2K are the same price. Precise Edit has four price tiers (listed in page order).' }),
  ideogram('ideogram-4.0', 'Ideogram 4.0', tiers('image', [['turbo', 0.03], ['default', 0.06], ['quality', 0.1]])),
  ideogram('ideogram-3.0', 'Ideogram 3.0', [
    ...tiers('image', [['turbo', 0.03], ['default', 0.06], ['quality', 0.09]]),
    ...tiers('character_reference', [['turbo', 0.1], ['default', 0.15], ['quality', 0.2]]),
  ]),
  ideogram('ideogram-3.0-flash', 'Ideogram 3.0 Flash', [img('image', 0.03)]),
];

export const IMAGE_MODEL_CATALOG: AiCatalogItem[] = [...IMAGE_MODEL_CATALOG_GOOGLE_OPENAI, ...IMAGE_MODEL_CATALOG_OTHERS];
