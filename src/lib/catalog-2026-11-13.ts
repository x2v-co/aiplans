import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 2026-11-13 P0/P1 facts re-read on official pages (SGT). */
export const VERIFIED_1113 = '2026-11-13';
export const ELEVENLABS_API = 'https://elevenlabs.io/pricing/api';
export const XAI_PRICING = 'https://docs.x.ai/developers/pricing';

type Rate = NonNullable<AiCatalogItem['usageRates']>[number];
const rate = (priceKind: string, price: number, unit: string): Rate => ({ priceKind, price, unit });

function item(slug: string, name: string, provider: string, providerSlug: string, source: string, fields: Partial<AiCatalogItem>): AiCatalogItem {
  return {
    slug, name, provider, providerSlug, kind: 'voice-model', modelCategory: 'speech', status: 'available',
    pricing: '', unit: 'hour', pricingUnit: 'per_hour', priceStatus: 'priced', pricingConfidence: 'verified',
    currency: 'USD', access: ['api'], capabilities: ['ASR'], bestFor: `${name} speech-to-text API.`,
    inputModalities: ['audio'], outputModalities: ['text'],
    lastVerified: VERIFIED_1113, verifiedAt: VERIFIED_1113, url: source,
    sourceUrls: [{ label: `${provider} official API pricing`, url: source, publisher: provider }],
    deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-13-audit-fixes:apply', ...fields,
  };
}

const perHour = (price: number, kind: string, notes: string): Partial<AiCatalogItem> => ({
  pricing: `$${price.toFixed(2)}/hour`, unit: 'hour', pricingUnit: 'per_hour', pricePerUnit: price,
  usageRates: [rate(kind, price, 'hour')], notes,
});

const PLAN_NOTE = 'USD list rates are identical on the official API page across payg, starter, creator, pro, scale and scale_2024_08_10. API usage is billed in US dollars, not credits. No regional price table was published on the page.';

export const ELEVENLABS_1113: AiCatalogItem[] = [
  item('elevenlabs-scribe-v2', 'Scribe v2', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    ...perHour(0.2, 'transcription_batch', `${PLAN_NOTE} Official card and comparison table: Scribe v2 / Scribe v3 / Scribe v2 Medical $0.20/hour. Optional add-ons: keyterm prompting $0.05/hour, transcript editing $0.07/hour. The 2026-11-05 catalog $0.22/hour batch rate is superseded.`),
  }),
  item('elevenlabs-scribe-v2-realtime', 'Scribe v2 Realtime', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    ...perHour(0.22, 'transcription_streaming', `${PLAN_NOTE} Official card and comparison table: Scribe v2 Realtime / Scribe v3 Live $0.22/hour. Optional transcript editing $0.12/hour in that live group. Keyterm library $0.08/hour is labeled Scribe v3 Live only. The 2026-11-05 catalog $0.39/hour streaming rate is superseded.`),
    capabilities: ['ASR', 'streaming'],
  }),
  item('elevenlabs-scribe-v3', 'Scribe v3', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    ...perHour(0.2, 'transcription_batch', `${PLAN_NOTE} Official New card: Scribe v3 $0.20/hour (same list rate as Scribe v2 / Scribe v2 Medical). Optional add-ons: keyterm prompting $0.05/hour, transcript editing $0.07/hour.`),
  }),
  item('elevenlabs-scribe-v3-live', 'Scribe v3 Live', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    ...perHour(0.22, 'transcription_streaming', `${PLAN_NOTE} Official New card: Scribe v3 Live $0.22/hour (same list rate as Scribe v2 Realtime). Optional: keyterm library $0.08/hour (Scribe v3 Live only), transcript editing $0.12/hour.`),
    capabilities: ['ASR', 'streaming'],
  }),
  item('elevenlabs-scribe-v2-medical', 'Scribe v2 Medical', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    ...perHour(0.2, 'transcription_batch', `${PLAN_NOTE} Official card: Scribe v2 Medical $0.20/hour, grouped with Scribe v2 / Scribe v3. Optional add-ons: keyterm prompting $0.05/hour, transcript editing $0.07/hour.`),
    bestFor: 'Scribe v2 Medical speech-to-text API for clinical audio.',
  }),
  item('elevenlabs-realtime-v1-mini', 'Realtime v1 Mini', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    pricing: '$0.08/minute connected audio + LLM usage ($0.20/M input, $6.00/M output)',
    unit: 'minute', pricingUnit: 'per_minute', billingUnit: 'per_minute', pricePerUnit: 0.08,
    usageRates: [
      rate('connected_audio', 0.08, 'minute'),
      rate('input_tokens', 0.2, 'per_1m_tokens'),
      rate('output_tokens', 6, 'per_1m_tokens'),
    ],
    capabilities: ['speech-to-speech', 'realtime voice'],
    inputModalities: ['audio', 'text'], outputModalities: ['audio', 'text'],
    bestFor: 'ElevenLabs Realtime v1 Mini speech-to-speech API.',
    notes: `${PLAN_NOTE} Official New card: $0.08/minute + LLM usage. Comparison table: connected audio $0.08/minute, input $0.20/1M, output $6.00/1M, all tiers.`,
  }),
  item('elevenlabs-realtime-v1-max', 'Realtime v1 Max', 'ElevenLabs', 'elevenlabs', ELEVENLABS_API, {
    pricing: '$0.08/minute connected audio + LLM usage ($1.80/M input, $9.00/M output)',
    unit: 'minute', pricingUnit: 'per_minute', billingUnit: 'per_minute', pricePerUnit: 0.08,
    usageRates: [
      rate('connected_audio', 0.08, 'minute'),
      rate('input_tokens', 1.8, 'per_1m_tokens'),
      rate('output_tokens', 9, 'per_1m_tokens'),
    ],
    capabilities: ['speech-to-speech', 'realtime voice'],
    inputModalities: ['audio', 'text'], outputModalities: ['audio', 'text'],
    bestFor: 'ElevenLabs Realtime v1 Max speech-to-speech API.',
    notes: `${PLAN_NOTE} Official New card: $0.08/minute + LLM usage. Comparison table: connected audio $0.08/minute, input $1.80/1M, output $9.00/1M, all tiers.`,
  }),
];

export const XAI_VIDEO_1113: AiCatalogItem[] = [
  {
    slug: 'grok-imagine-video-720p',
    name: 'grok-imagine-video-720p',
    provider: 'xAI',
    providerSlug: 'xai',
    kind: 'video-model',
    modelCategory: 'video',
    status: 'available',
    pricing: '$0.050/second (grok-imagine-video)',
    unit: 'second',
    pricingUnit: 'per_second',
    billingUnit: 'per_second',
    pricePerUnit: 0.05,
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api'],
    capabilities: ['text-to-video'],
    bestFor: 'xAI grok-imagine-video generation.',
    inputModalities: ['text'],
    outputModalities: ['video'],
    usageRates: [rate('video_second', 0.05, 'second')],
    url: XAI_PRICING,
    sourceUrls: [{ label: 'xAI official pricing', url: XAI_PRICING, publisher: 'xAI' }],
    lastVerified: VERIFIED_1113,
    verifiedAt: VERIFIED_1113,
    deferredDbSeed: true,
    deferredDbSeedScript: 'seed:catalog-2026-11-13-audit-fixes:apply',
    notes: 'This row keeps the existing production slug grok-imagine-video-720p and maps to official grok-imagine-video at $0.050/sec. The 2026-11-13 official pricing page publishes only flat per-second rates and no 480p/720p/1080p tiers. The previous catalog 720p $0.07/s rate is superseded.',
  },
  {
    slug: 'grok-imagine-video-1-5-agent',
    name: 'grok-imagine-video-1.5-agent',
    provider: 'xAI',
    providerSlug: 'xai',
    kind: 'video-model',
    modelCategory: 'video',
    status: 'available',
    pricing: '$0.080/second (grok-imagine-video-1.5)',
    unit: 'second',
    pricingUnit: 'per_second',
    billingUnit: 'per_second',
    pricePerUnit: 0.08,
    priceStatus: 'priced',
    pricingConfidence: 'verified',
    currency: 'USD',
    access: ['api'],
    capabilities: ['text-to-video'],
    bestFor: 'xAI grok-imagine-video-1.5 generation.',
    inputModalities: ['text'],
    outputModalities: ['video'],
    usageRates: [rate('video_second', 0.08, 'second')],
    url: XAI_PRICING,
    sourceUrls: [{ label: 'xAI official pricing', url: XAI_PRICING, publisher: 'xAI' }],
    lastVerified: VERIFIED_1113,
    verifiedAt: VERIFIED_1113,
    deferredDbSeed: true,
    deferredDbSeedScript: 'seed:catalog-2026-11-13-audit-fixes:apply',
    notes: 'Mapped to official grok-imagine-video-1.5 at $0.080/sec. The 2026-11-13 official pricing page publishes only flat per-second rates (1.5 $0.080, 1.5-lite $0.020, grok-imagine-video $0.050) and no resolution tiers. Previous catalog 720p $0.14 / 1080p $0.25 rows are withdrawn. Official 1.5-lite $0.020/sec has no aiplans production page and is not added here.',
  },
];

export const CATALOG_1113 = [...ELEVENLABS_1113, ...XAI_VIDEO_1113];
export const CATALOG_1113_SLUGS = new Set(CATALOG_1113.map(item => item.slug!));
