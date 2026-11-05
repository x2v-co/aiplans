import type { AiCatalogItem } from './ai-vertical-catalog';

/** Intel 11-05 P1-2 voice rows. Every price re-read on the official page on 2026-11-05 (SGT). */
export const VERIFIED_1105 = '2026-11-05';
export const SOURCES_1105 = {
  openai: 'https://platform.openai.com/docs/pricing',
  elevenlabs: 'https://elevenlabs.io/pricing/api',
  deepgram: 'https://deepgram.com/pricing',
  assemblyai: 'https://www.assemblyai.com/pricing',
} as const;
type Rate = NonNullable<AiCatalogItem['usageRates']>[number];
const rate = (priceKind: string, price: number, unit: string, approximate = false): Rate => ({ priceKind, price, unit, ...(approximate ? { approximate } : {}) });
function voice(slug: string, name: string, provider: string, providerSlug: keyof typeof SOURCES_1105, asr: boolean, fields: Partial<AiCatalogItem>): AiCatalogItem {
  const source = SOURCES_1105[providerSlug];
  return {
    slug, name, provider, providerSlug, kind: 'voice-model', modelCategory: 'speech', status: 'available',
    pricing: '', unit: 'minute', pricingUnit: 'per_minute', priceStatus: 'priced', pricingConfidence: 'verified',
    currency: 'USD', access: ['api'], capabilities: asr ? ['ASR'] : ['TTS'], bestFor: asr ? `${name} speech-to-text API.` : `${name} text-to-speech API.`,
    inputModalities: asr ? ['audio'] : ['text'], outputModalities: asr ? ['text'] : ['audio'],
    lastVerified: VERIFIED_1105, verifiedAt: VERIFIED_1105, url: source,
    sourceUrls: [{ label: `${provider} official pricing`, url: source, publisher: provider }],
    deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-05-intel:apply', ...fields,
  };
}
const perMinute = (price: number, kind: string, approximate = false): Partial<AiCatalogItem> => ({
  pricing: `${approximate ? '≈' : ''}$${price}/minute`, pricePerUnit: price, billingUnit: 'per_minute',
  ...(approximate ? { approximatePrice: true } : {}), usageRates: [rate(kind, price, 'minute', approximate)],
});
const perHour = (price: number, kind: string): Partial<AiCatalogItem> => ({
  pricing: `$${price.toFixed(2)}/hour`, unit: 'hour', pricingUnit: 'per_hour', pricePerUnit: price,
  usageRates: [rate(kind, price, 'hour')],
});

export const OPENAI_VOICE_1105: AiCatalogItem[] = [
  voice('gpt-live-1', 'gpt-live-1', 'OpenAI', 'openai', false, {
    ...perMinute(0.05, 'speech_to_speech'), capabilities: ['realtime voice', 'speech-to-speech'], inputModalities: ['audio', 'text'], outputModalities: ['audio', 'text'],
    bestFor: 'OpenAI API realtime voice model (distinct from the ChatGPT-only GPT-Live-1.1).',
  }),
  voice('gpt-transcribe', 'gpt-transcribe', 'OpenAI', 'openai', true, perMinute(0.0045, 'transcription_batch')),
  voice('gpt-4o-transcribe', 'gpt-4o-transcribe', 'OpenAI', 'openai', true, {
    pricing: '$2.50/M audio input tokens; $10.00/M output tokens; ≈$0.006/minute', unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens',
    inputPricePer1M: 2.5, outputPricePer1M: 10, usageRates: [rate('audio_input', 2.5, 'per_1m_tokens'), rate('text_output', 10, 'per_1m_tokens'), rate('transcription_estimate', 0.006, 'minute', true)],
  }),
  voice('gpt-4o-mini-transcribe', 'gpt-4o-mini-transcribe', 'OpenAI', 'openai', true, {
    pricing: '$1.25/M audio input tokens; $5.00/M output tokens; ≈$0.003/minute', unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens',
    inputPricePer1M: 1.25, outputPricePer1M: 5, usageRates: [rate('audio_input', 1.25, 'per_1m_tokens'), rate('text_output', 5, 'per_1m_tokens'), rate('transcription_estimate', 0.003, 'minute', true)],
  }),
  voice('gpt-live-transcribe', 'gpt-live-transcribe', 'OpenAI', 'openai', true, { ...perMinute(0.017, 'transcription_streaming'), capabilities: ['ASR', 'streaming'] }),
  voice('gpt-realtime-whisper', 'gpt-realtime-whisper', 'OpenAI', 'openai', true, { ...perMinute(0.017, 'transcription_streaming'), capabilities: ['ASR', 'streaming'] }),
  ...([['tts-1', 'TTS-1', 15], ['tts-1-hd', 'TTS-1 HD', 30]] as const).map(([slug, name, price]) => voice(slug, name, 'OpenAI', 'openai', false, {
    pricing: `$${price.toFixed(2)}/1M characters`, unit: '1M characters', pricingUnit: 'per_1m_characters',
    usageRates: [rate('text_to_speech', price, 'per_1m_characters')],
  })),
];

export const ASR_TTS_1105: AiCatalogItem[] = [
  voice('elevenlabs-scribe-v2', 'Scribe v2', 'ElevenLabs', 'elevenlabs', true, perHour(0.22, 'transcription_batch')),
  voice('elevenlabs-scribe-v2-realtime', 'Scribe v2 Realtime', 'ElevenLabs', 'elevenlabs', true, { ...perHour(0.39, 'transcription_streaming'), capabilities: ['ASR', 'streaming'] }),
  voice('deepgram-nova-3', 'Nova-3', 'Deepgram', 'deepgram', true, {
    ...perMinute(0.0077, 'transcription_batch'),
    notes: 'Pay-as-you-go pre-recorded monolingual; Growth $0.0065/min. Multilingual $0.0092/min (Growth $0.0078).',
  }),
  voice('deepgram-aura-2', 'Aura-2', 'Deepgram', 'deepgram', false, {
    pricing: '$0.030/1K characters', unit: '1K characters', pricingUnit: 'per_1k_characters',
    usageRates: [rate('text_to_speech', 0.03, 'per_1k_characters')], notes: 'Pay as you go; Growth $0.027/1K characters.',
  }),
  voice('assemblyai-universal-3-5-pro', 'Universal-3.5 Pro', 'AssemblyAI', 'assemblyai', true, { ...perHour(0.21, 'transcription_batch'), notes: 'Pay as you go; keyterms prompting add-on $0.05/hour.' }),
  voice('assemblyai-universal-2', 'Universal-2', 'AssemblyAI', 'assemblyai', true, perHour(0.15, 'transcription_batch')),
];

export const CATALOG_1105 = [...OPENAI_VOICE_1105, ...ASR_TTS_1105];
