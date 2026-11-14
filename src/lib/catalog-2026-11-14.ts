import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 2026-11-14 morning + noon briefs, re-checked against official pages the same day. */
export const VERIFIED = '2026-11-14';
export const SEED_SCRIPT = 'seed:catalog-2026-11-14-intel:apply';

export const TOKEN_PASS_CHANGELOG =
  'https://vercel.com/changelog/vercel-token-pass-now-includes-one-hundred-fifty-dollars-of-monthly-tokens';
export const TOKEN_PASS_DOCS = 'https://vercel.com/docs/ai-gateway/token-pass';
export const TOKEN_PASS_MODELS_DOCS = 'https://vercel.com/docs/ai-gateway/token-pass/models-and-routing';
export const TOKEN_PASS_SLUG = 'vercel-token-pass';
export const TOKEN_PASS_CREDIT_USD = 150;
export const TOKEN_PASS_FEE_USD = 30;

export const DEEPSEEK_PRICING_EN = 'https://api-docs.deepseek.com/quick_start/pricing';
export const DEEPSEEK_PRICING_ZH = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';
export const DEEPSEEK_TTS = 'https://api-docs.deepseek.com/guides/tts';
export const DEEPSEEK_ASR = 'https://api-docs.deepseek.com/guides/asr';
export const DEEPSEEK_OCR = 'https://api-docs.deepseek.com/guides/ocr';
export const DEEPSEEK_PARSE = 'https://api-docs.deepseek.com/guides/document_parsing';

export const COPILOT_DEC_SOURCE =
  'https://github.blog/changelog/2026-11-13-upcoming-deprecation-of-selected-github-copilot-models-in-december';
export const COPILOT_NOV_SOURCE =
  'https://github.blog/changelog/2026-10-15-upcoming-deprecation-of-selected-github-copilot-models-in-mid-november';

export const PARALLEL_PRICING = 'https://docs.parallel.ai/getting-started/pricing';
export const PARALLEL_QUICKSTART = 'https://docs.parallel.ai/decisions/decisions-quickstart';
export const PARALLEL_VERCEL_CHANGELOG =
  'https://vercel.com/changelog/parallel-decisions-now-available-on-ai-gateway-for-free';
export const PARALLEL_VERCEL_MODEL = 'https://vercel.com/ai-gateway/models/parallel-decisions-fast';
export const PARALLEL_SLUG = 'parallel-decisions-fast';
export const PARALLEL_API_ID = 'parallel/parallel-decisions-fast';
export const PARALLEL_OFFICIAL_PER_1K = 1;
export const PARALLEL_MAX_QUESTIONS = 100;
export const PARALLEL_VERCEL_FREE_THROUGH = '2026-11-23';

export const CF_EMBEDDING_MODEL = 'https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/';
export const CF_EMBEDDING_CHANGELOG =
  'https://developers.cloudflare.com/changelog/post/2026-11-12-embeddinggemma-2-workers-ai/';
export const CF_EMBEDDING_PRICING = 'https://developers.cloudflare.com/workers-ai/platform/pricing/#embeddings-model-pricing';
export const CF_EMBEDDING_ENDPOINT = '@cf/google/embeddinggemma-2';
export const CF_EMBEDDING_SLUG = 'cloudflare-embeddinggemma-2';
export const CF_EMBEDDING_PRICE = 0.0017;
export const CF_EMBEDDING_CONTEXT = 8192;
export const CF_EMBEDDING_DIM = 768;
export const CF_EMBEDDING_DIMS = [128, 256, 512, 768] as const;
export const CF_EMBEDDING_300M_SLUG = 'cloudflare-embeddinggemma-300m';
export const CF_EMBEDDING_300M_REPLACEMENT = '@cf/google/embeddinggemma-2';

export const ZONOS_PAGE = 'https://www.zyphra.com/models/zonos3-mini';
export const ZONOS_SLUG = 'zyphra-zonos3-mini';
export const ZONOS_API_ID = 'zyphra/zonos3-mini';
export const ZONOS_PRICE = 10;
export const ZONOS_CONTEXT_LABEL = '32K';
export const ZONOS_CONTEXT = 32_768;

export const FOUNDRY_RETIREMENT =
  'https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule';

const SCRIPT = { deferredDbSeed: true as const, deferredDbSeedScript: SEED_SCRIPT };

function decisionItem(): AiCatalogItem {
  return {
    kind: 'decision-model',
    slug: PARALLEL_SLUG,
    name: 'Parallel Decisions Fast',
    provider: 'Parallel',
    providerSlug: 'parallel',
    modelCategory: 'decision',
    status: 'available',
    pricing: `Official Decisions API: $${PARALLEL_OFFICIAL_PER_1K}/1,000 requests, up to ${PARALLEL_MAX_QUESTIONS} questions per request. Vercel AI Gateway: free through ${PARALLEL_VERCEL_FREE_THROUGH}.`,
    unit: '$/1,000 requests',
    pricingUnit: 'unknown',
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    inputPricePer1M: null,
    outputPricePer1M: null,
    pricePer1MTasks: null,
    access: ['api'],
    capabilities: ['web-grounded decisions'],
    bestFor: 'Typed, web-grounded answers (boolean, choice, score) with cited evidence.',
    inputModalities: ['text'],
    outputModalities: ['text'],
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    pricingProviderSlug: 'parallel',
    pricingChannel: 'Official',
    usageRates: [
      { priceKind: 'Decisions API request', unit: 'per_1k_requests', price: PARALLEL_OFFICIAL_PER_1K },
    ],
    notes: [
      `Official Parallel Decisions API list price is $${PARALLEL_OFFICIAL_PER_1K} per 1,000 requests, with up to ${PARALLEL_MAX_QUESTIONS} questions included in each call.`,
      'Official docs name the product “Decisions”; “Decisions Fast” and the model id parallel/parallel-decisions-fast are from the Vercel AI Gateway changelog (published 2026-11-13).',
      `Vercel AI Gateway offers it free through ${PARALLEL_VERCEL_FREE_THROUGH}; no separate Parallel account is required on that channel.`,
      'Question types on Vercel: Boolean (probability of yes), Choice, and Score. Related questions share context and retrieved evidence in one request.',
      'Official latency band: 200 ms–1 s, synchronous. No token rate or context window is published on the official pricing page.',
      `Sources verified ${VERIFIED}.`,
    ].join(' '),
    url: PARALLEL_PRICING,
    sourceUrls: [
      { label: 'Parallel official pricing', url: PARALLEL_PRICING, publisher: 'Parallel' },
      { label: 'Decisions API quickstart', url: PARALLEL_QUICKSTART, publisher: 'Parallel' },
      { label: 'Vercel AI Gateway changelog', url: PARALLEL_VERCEL_CHANGELOG, publisher: 'Vercel' },
    ],
    ...SCRIPT,
  };
}

function embeddingItem(): AiCatalogItem {
  return {
    kind: 'embedding-model',
    slug: CF_EMBEDDING_SLUG,
    name: 'EmbeddingGemma 2',
    provider: 'Cloudflare',
    providerSlug: 'cloudflare',
    modelCategory: 'embedding',
    status: 'available',
    pricing: `Workers AI: $${CF_EMBEDDING_PRICE}/M input tokens`,
    unit: 'per_1m_tokens',
    pricingUnit: 'per_1m_tokens',
    inputPricePer1M: CF_EMBEDDING_PRICE,
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api'],
    capabilities: ['text embedding', 'image embedding', 'audio embedding', 'video embedding'],
    bestFor: 'Multimodal embeddings of text, images, video and audio in one 768-dimensional space on Workers AI.',
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['embedding'],
    contextWindow: CF_EMBEDDING_CONTEXT,
    contextWindowLabel: '8,192 tokens',
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    usageRates: [
      { priceKind: 'text input', unit: 'per_1m_tokens', price: CF_EMBEDDING_PRICE },
    ],
    notes: [
      `Workers AI id ${CF_EMBEDDING_ENDPOINT}. Open multimodal embedding model from Google DeepMind.`,
      `Default vector size ${CF_EMBEDDING_DIM} dimensions; optional shorter sizes 128, 256 or 512 via the dimensions parameter.`,
      `Context window ${CF_EMBEDDING_CONTEXT.toLocaleString('en-US')} tokens, shared across all content in an input.`,
      `Unit price $${CF_EMBEDDING_PRICE} per million input tokens on the official model page and changelog (2026-11-12). No official Google API list price is stored.`,
      'This is a Cloudflare-hosted channel, not a Google first-party listing.',
      `Sources verified ${VERIFIED}.`,
    ].join(' '),
    url: CF_EMBEDDING_MODEL,
    sourceUrls: [
      { label: 'Workers AI model page', url: CF_EMBEDDING_MODEL, publisher: 'Cloudflare' },
      { label: 'Workers AI changelog', url: CF_EMBEDDING_CHANGELOG, publisher: 'Cloudflare' },
    ],
    ...SCRIPT,
  };
}

function zonosItem(): AiCatalogItem {
  return {
    kind: 'voice-model',
    slug: ZONOS_SLUG,
    name: 'ZONOS3-Mini',
    provider: 'Zyphra',
    providerSlug: 'zyphra',
    modelCategory: 'speech',
    status: 'available',
    pricing: `$${ZONOS_PRICE.toFixed(2)} / 1M UTF-8 bytes`,
    unit: 'per_1m_utf8_bytes',
    pricingUnit: 'unknown',
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api', 'open-weights'],
    license: 'Apache-2.0',
    capabilities: ['text-to-speech', 'voice cloning'],
    bestFor: 'Compact open-source TTS with voice cloning, via Zyphra Inference or local runtimes.',
    inputModalities: ['text', 'audio'],
    outputModalities: ['audio'],
    contextWindow: ZONOS_CONTEXT,
    contextWindowLabel: ZONOS_CONTEXT_LABEL,
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    usageRates: [
      { priceKind: 'Zyphra Inference', unit: 'per_1m_utf8_bytes', price: ZONOS_PRICE },
    ],
    notes: [
      `Official list price $${ZONOS_PRICE.toFixed(2)} per 1M UTF-8 bytes on the ZONOS3-Mini model page.`,
      `Model id ${ZONOS_API_ID}. 100M active / 886M total parameters, BF16, Apache 2.0 weights.`,
      `Official “Context length” is listed as ${ZONOS_CONTEXT_LABEL} with no unit; the catalog stores ${ZONOS_CONTEXT} (32 × 1,024) and keeps the official label.`,
      'Input modalities text and audio; output audio. Official page also lists Concurrent Requests 1, which is a published API limit, not a price.',
      `Sources verified ${VERIFIED}.`,
    ].join(' '),
    url: ZONOS_PAGE,
    sourceUrls: [
      { label: 'ZONOS3-Mini official model page', url: ZONOS_PAGE, publisher: 'Zyphra' },
    ],
    ...SCRIPT,
  };
}

function deepseekTts(): AiCatalogItem {
  return {
    kind: 'voice-model',
    slug: 'deepseek-tts',
    name: 'DeepSeek TTS',
    provider: 'DeepSeek',
    providerSlug: 'deepseek',
    modelCategory: 'speech',
    status: 'available',
    pricing: 'List $0.45 / 10,000 billed characters (limited-time 50% off: $0.225). Chinese page: ¥3 / ¥1.5.',
    unit: 'per_10k_characters',
    pricingUnit: 'unknown',
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api'],
    capabilities: ['text-to-speech'],
    bestFor: 'DeepSeek standalone text-to-speech API (POST /v1/tools/tts).',
    inputModalities: ['text'],
    outputModalities: ['audio'],
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    usageRates: [
      { priceKind: 'official list', unit: 'per_10k_characters', price: 0.45 },
    ],
    notes: [
      'Standalone DeepSeek Speech API, not a chat-model token rate.',
      'English official page list price $0.45 per 10,000 billed characters; limited-time 50% off $0.225. No promo end date is published.',
      'Chinese official page: 刊例价 3 元、限时 1.5 元 / 每 10,000 字符.',
      'A Chinese character counts as 2 billed characters; any other character (letter, digit or space) counts as 1. At most 10,000 billed characters per full-text request.',
      'Voices: stella (female, default) and tide (male). Languages are detected from the text; no language parameter.',
      `Sources verified ${VERIFIED}: ${DEEPSEEK_PRICING_EN} ; ${DEEPSEEK_PRICING_ZH} ; ${DEEPSEEK_TTS}.`,
    ].join(' '),
    url: DEEPSEEK_PRICING_EN,
    sourceUrls: [
      { label: 'DeepSeek pricing (EN)', url: DEEPSEEK_PRICING_EN, publisher: 'DeepSeek' },
      { label: 'DeepSeek pricing (ZH)', url: DEEPSEEK_PRICING_ZH, publisher: 'DeepSeek' },
      { label: 'TTS guide', url: DEEPSEEK_TTS, publisher: 'DeepSeek' },
    ],
    ...SCRIPT,
  };
}

function deepseekAsr(): AiCatalogItem {
  return {
    kind: 'voice-model',
    slug: 'deepseek-asr',
    name: 'DeepSeek ASR',
    provider: 'DeepSeek',
    providerSlug: 'deepseek',
    modelCategory: 'speech',
    status: 'available',
    pricing: 'List $0.116 / hour of audio (limited-time 50% off: $0.058). Chinese page: ¥0.78 / ¥0.39.',
    unit: 'per_hour',
    pricingUnit: 'per_hour',
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api'],
    capabilities: ['speech-to-text'],
    bestFor: 'DeepSeek standalone speech-to-text API.',
    inputModalities: ['audio'],
    outputModalities: ['text'],
    lastVerified: VERIFIED,
    verifiedAt: VERIFIED,
    usageRates: [
      { priceKind: 'official list', unit: 'per_hour', price: 0.116 },
    ],
    notes: [
      'Standalone DeepSeek Speech API, not a chat-model token rate.',
      'English official page list price $0.116 per hour of audio; limited-time 50% off $0.058. No promo end date is published.',
      'Chinese official page: 刊例价 0.78 元、限时 0.39 元 / 每小时音频.',
      'Billed by audio duration to the second; a fraction of a second counts as 1 second.',
      `Sources verified ${VERIFIED}: ${DEEPSEEK_PRICING_EN} ; ${DEEPSEEK_PRICING_ZH} ; ${DEEPSEEK_ASR}.`,
    ].join(' '),
    url: DEEPSEEK_PRICING_EN,
    sourceUrls: [
      { label: 'DeepSeek pricing (EN)', url: DEEPSEEK_PRICING_EN, publisher: 'DeepSeek' },
      { label: 'DeepSeek pricing (ZH)', url: DEEPSEEK_PRICING_ZH, publisher: 'DeepSeek' },
      { label: 'ASR guide', url: DEEPSEEK_ASR, publisher: 'DeepSeek' },
    ],
    ...SCRIPT,
  };
}

export const PARALLEL_DECISIONS_1114: AiCatalogItem[] = [decisionItem()];
export const EMBEDDING_GEMMA2_1114: AiCatalogItem[] = [embeddingItem()];
export const VOICE_MODELS_1114: AiCatalogItem[] = [deepseekTts(), deepseekAsr(), zonosItem()];
export const CATALOG_1114: AiCatalogItem[] = [
  ...PARALLEL_DECISIONS_1114,
  ...EMBEDDING_GEMMA2_1114,
  ...VOICE_MODELS_1114,
];
export const CATALOG_1114_SLUGS = new Set(CATALOG_1114.map(item => item.slug!));
