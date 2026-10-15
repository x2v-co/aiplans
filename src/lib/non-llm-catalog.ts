import type { AiCatalogItem } from './ai-vertical-catalog';

// Source: /workspace/aiplans-gaps-facts.md, verified 2026-10-15.
const verified = { deferredDbSeed: true, lastVerified: '2026-10-15', verifiedAt: '2026-10-15', currency: 'USD' };
const voiceSource = 'https://docs.x.ai/docs/models';
const releaseSource = 'https://docs.x.ai/docs/release-notes';
const voiceRates = [
  { priceKind: 'speech_to_speech', unit: 'minute', price: 0.08 },
  { priceKind: 'text_to_speech', unit: 'per_1m_characters', price: 15 },
];
const transcriptionRates = [
  { priceKind: 'transcription_batch', unit: 'hour', price: 0.10 },
  { priceKind: 'transcription_streaming', unit: 'hour', price: 0.20 },
];

function voice(version: '3.0' | '2.0'): AiCatalogItem {
  return {
    ...verified, kind: 'voice-model', slug: `grok-voice-${version}`, name: `grok-voice-${version}`,
    provider: 'xAI', providerSlug: 'xai', modelCategory: 'speech',
    status: version === '2.0' ? 'deprecated' : 'available',
    pricing: 'STS $0.08/min; TTS $15/1M characters', unit: 'minute / 1M characters', pricingUnit: 'per_minute',
    priceStatus: 'priced', pricingConfidence: 'verified', usageRates: voiceRates,
    inputModalities: ['audio', 'text'], outputModalities: ['audio'], access: ['api'],
    capabilities: ['speech-to-speech', 'text-to-speech'], bestFor: 'Speech-to-speech and text-to-speech.',
    notes: version === '3.0' ? 'grok-voice-latest → grok-voice-3.0. Available October 2026.'
      : 'Deprecated; same price as 3.0. Deprecation date uses the 2026-10-15 audit date; exact announcement date was not supplied.',
    ...(version === '2.0' ? { deprecatedAt: '2026-10-15', replacementModel: 'grok-voice-3.0', deprecationSourceUrl: releaseSource } : {}),
    url: voiceSource, sourceUrls: [
      { label: 'xAI models and pricing', url: voiceSource, publisher: 'xAI' },
      { label: 'xAI release notes', url: releaseSource, publisher: 'xAI' },
    ],
  };
}

function transcription(version: '1.0' | '2.0'): AiCatalogItem {
  return {
    ...verified, kind: 'voice-model', slug: `grok-voice-transcribe-${version}`, name: `grok-voice-transcribe-${version}`,
    provider: 'xAI', providerSlug: 'xai', modelCategory: 'speech', status: version === '1.0' ? 'discontinued' : 'available',
    pricing: 'STT batch $0.10/hour; streaming $0.20/hour', unit: 'hour', pricingUnit: 'per_hour',
    priceStatus: 'priced', pricingConfidence: 'verified', usageRates: transcriptionRates,
    inputModalities: ['audio'], outputModalities: ['text'], access: ['api'], capabilities: ['ASR', 'batch', 'streaming'],
    bestFor: 'Speech transcription.',
    ...(version === '1.0' ? { shutdownDate: '2026-10-02', replacementModel: 'grok-voice-transcribe-2.0', deprecationSourceUrl: releaseSource,
      notes: 'EOL 2026-10-02; routed to grok-voice-transcribe-2.0 at the same price.' } : {}),
    url: voiceSource, sourceUrls: [
      { label: 'xAI models and pricing', url: voiceSource, publisher: 'xAI' },
      { label: 'xAI release notes', url: releaseSource, publisher: 'xAI' },
    ],
  };
}

function jev(version: '1.14.0' | '1.13.0'): AiCatalogItem {
  return {
    ...verified, kind: 'decision-model', slug: `jev-${version}`, name: `TypeSafe Jev ${version}`, provider: 'TypeSafe', providerSlug: 'typesafe',
    modelCategory: 'decision', status: 'available', pricing: '$0.042/1M input tokens ($42/1B); output free; long context same rate',
    unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens', priceStatus: 'priced', pricingConfidence: 'verified',
    inputPricePer1M: 0.042, outputPricePer1M: 0, pricePer1MTasks: null, contextWindow: 64000,
    // Itemized: TypeSafe bills input tokens only; output is free; no per-task fee.
    usageRates: [
      { priceKind: 'input_tokens', unit: 'per_1m_tokens', price: 0.042 },
      { priceKind: 'output_tokens', unit: 'per_1m_tokens', price: 0 },
    ],
    contextWindowLabel: '64k/request; 32k/question; 262k with long-context header',
    inputModalities: ['text'], outputModalities: ['text'], access: ['api'], capabilities: ['decision'], bestFor: 'Decision API.',
    notes: 'jev-latest → jev-1.13.0; jev-preview → jev-1.14.0.',
    needsVerification: ['Intel-expected jev-latest switch around 2026-10-21 is unverified; no scheduled switch is confirmed.'],
    ...(version === '1.14.0' ? { releasedAt: '2026-10-14' } : {}),
    url: 'https://docs.typesafe.ai/models', sourceUrls: [{ label: 'TypeSafe models', url: 'https://docs.typesafe.ai/models', publisher: 'TypeSafe' }],
  };
}

function image(flash: boolean): AiCatalogItem {
  const modelId = `mai-image-2.6${flash ? '-flash' : ''}`;
  const url = 'https://vercel.com/ai-gateway/models/mai-image-2.6';
  const input = flash ? 1.75 : 5;
  const output = flash ? 19 : 38;
  return {
    ...verified, kind: 'image-model', slug: `microsoft-${modelId}`, name: `microsoft/${modelId}`,
    provider: 'Microsoft', providerSlug: 'microsoft', pricingProviderSlug: 'vercel-ai-gateway', pricingChannel: 'Vercel AI Gateway',
    modelCategory: 'image', status: 'available', releasedAt: '2026-10-13',
    pricing: `$${input}/1M input tokens; $${output}/1M output tokens${flash ? '' : '; approximately $0.01/image starting'}`,
    unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens', priceStatus: 'priced', pricingConfidence: 'verified',
    inputPricePer1M: input, outputPricePer1M: output,
    usageRates: [
      { priceKind: 'input_tokens', unit: 'per_1m_tokens', price: input },
      { priceKind: 'output_tokens', unit: 'per_1m_tokens', price: output },
      ...(flash ? [] : [{ priceKind: 'image_starting', unit: 'image', price: 0.01, approximate: true }]),
    ],
    inputModalities: ['text', 'image'], outputModalities: ['image'], access: ['cloud-api'],
    capabilities: ['image generation', 'up to 5 reference images'], resolutionTier: '1536×1536',
    bestFor: 'Image generation through Vercel AI Gateway.', notes: 'Vercel AI Gateway channel pricing; no first-party price was fetched.',
    url, sourceUrls: [{ label: 'Vercel AI Gateway model pricing', url, publisher: 'Vercel' }],
  };
}

export const MOONDREAM_SHUTDOWN = {
  deprecatedAt: '2026-11-13', shutdownDate: '2026-11-13',
  deprecationSourceUrl: 'https://moondream.ai/blog/moondream-is-joining-prime-intellect',
  notes: 'Moondream Cloud inference and Lens shut down 2026-11-13. Unspent purchased credits will be refunded; models stay open. Acquired by Prime Intellect on 2026-10-14.',
};

export const NON_LLM_CATALOG: AiCatalogItem[] = [
  voice('3.0'), voice('2.0'), transcription('2.0'), transcription('1.0'), jev('1.14.0'), jev('1.13.0'), image(false), image(true),
  {
    ...verified, ...MOONDREAM_SHUTDOWN, kind: 'image-model', slug: 'moondream-cloud', name: 'Moondream Cloud (vision lifecycle note)',
    provider: 'Moondream', providerSlug: 'moondream', modelCategory: 'image', status: 'deprecated',
    // https://moondream.ai/pricing (checked 2026-10-15); Cloud ends 2026-11-13.
    pricing: 'Moondream 3.1 9B A2B real-time $0.30/$1.00, batch $0.15/$0.50; 3 Preview real-time $0.30/$2.50, batch $0.15/$1.25 per 1M input/output tokens; Lens training $0.60/1M',
    unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens', priceStatus: 'priced', pricingConfidence: 'verified',
    usageRates: [
      { priceKind: 'moondream-3.1_realtime_input', unit: 'per_1m_tokens', price: 0.30 },
      { priceKind: 'moondream-3.1_realtime_output', unit: 'per_1m_tokens', price: 1.00 },
      { priceKind: 'moondream-3.1_batch_input', unit: 'per_1m_tokens', price: 0.15 },
      { priceKind: 'moondream-3.1_batch_output', unit: 'per_1m_tokens', price: 0.50 },
      { priceKind: 'moondream-3-preview_realtime_input', unit: 'per_1m_tokens', price: 0.30 },
      { priceKind: 'moondream-3-preview_realtime_output', unit: 'per_1m_tokens', price: 2.50 },
      { priceKind: 'moondream-3-preview_batch_input', unit: 'per_1m_tokens', price: 0.15 },
      { priceKind: 'moondream-3-preview_batch_output', unit: 'per_1m_tokens', price: 1.25 },
      { priceKind: 'lens_training', unit: 'per_1m_tokens', price: 0.60 },
    ],
    inputModalities: ['image'], outputModalities: ['text'], access: ['api', 'open-weights'], capabilities: ['vision'],
    bestFor: 'Cloud and Lens lifecycle tracking; open models remain available.',
    url: MOONDREAM_SHUTDOWN.deprecationSourceUrl,
    sourceUrls: [
      { label: 'Moondream pricing', url: 'https://moondream.ai/pricing', publisher: 'Moondream' },
      { label: 'Moondream shutdown announcement', url: MOONDREAM_SHUTDOWN.deprecationSourceUrl, publisher: 'Moondream' },
    ],
  },
];
