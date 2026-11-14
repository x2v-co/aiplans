import type { AiCatalogItem } from './ai-vertical-catalog';

/** Official facts supplied by the catalog reviewer, verified 2026-11-04. */
export const VERIFIED_1104 = '2026-11-04';
export const SOURCES_1104 = {
  google: 'https://ai.google.dev/gemini-api/docs/pricing',
  deprecations: 'https://ai.google.dev/gemini-api/docs/deprecations',
  openai: 'https://platform.openai.com/docs/pricing',
  elevenlabs: 'https://elevenlabs.io/pricing/api',
  sarvam: 'https://docs.sarvam.ai/api-reference-docs/getting-started/pricing',
  mureka: 'https://platform.mureka.ai/pricing',
  xai: 'https://docs.x.ai/developers/pricing',
  xaiModels: 'https://docs.x.ai/developers/models',
} as const;
type Rate = NonNullable<AiCatalogItem['usageRates']>[number];
const rate = (priceKind: string, price: number, unit = 'per_1m_tokens'): Rate => ({ priceKind, price, unit });
const batch = (rates: Rate[]): Rate[] => rates.flatMap(r => [r, { ...r, priceKind: `${r.priceKind} (batch)`, price: r.price / 2 }]);
function item(slug: string, name: string, provider: string, providerSlug: string, source: string, fields: Partial<AiCatalogItem>): AiCatalogItem {
  return {
    slug, name, provider, providerSlug, kind: 'voice-model', modelCategory: 'speech', status: 'available',
    pricing: '', unit: 'per_1m_tokens', pricingUnit: 'per_1m_tokens', priceStatus: 'priced', pricingConfidence: 'verified',
    currency: 'USD', access: ['api'], capabilities: [], bestFor: name,
    lastVerified: VERIFIED_1104, verifiedAt: VERIFIED_1104, url: source,
    sourceUrls: [{ label: `${provider} official pricing`, url: source, publisher: provider }],
    deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-04:apply', ...fields,
  };
}

/**
 * Intel 2026-11-14 evening, checked on the deprecations page that day. The preview
 * TTS models are not catalog rows (they would be shutdown-only rows), so the date
 * lives on their recommended replacements.
 */
export const TTS_PREVIEW_SHUTDOWN_DATE = '2026-12-18';
export const TTS_PREVIEW_MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'] as const;
export const TTS_PREVIEW_SHUTDOWN_NOTE = `Preview TTS ${TTS_PREVIEW_MODELS.join(', ')} shut down ${TTS_PREVIEW_SHUTDOWN_DATE} (earliest possible date per the Gemini API deprecations page, checked 2026-11-14); recommended replacement gemini-3.8-flash-tts or gemini-3.8-flash-lite-tts.`;

const tts = (lite: boolean): AiCatalogItem => {
  const output = lite ? 6 : 9;
  const current = [rate('text input through 2026-12-31', 0.5), rate('audio output through 2026-12-31', output)];
  const future = [rate('text input from 2027-01-01', 1), rate('audio output from 2027-01-01', output * 2)];
  return item(`gemini-3.8-flash${lite ? '-lite' : ''}-tts`, `Gemini 3.8 Flash${lite ? ' Lite' : ''} TTS`, 'Google', 'google', SOURCES_1104.google, {
    pricing: `$0.50/M text input; $${output.toFixed(2)}/M audio output through 2026-12-31; from 2027-01-01 $1.00/$${output * 2}.00; batch half`,
    inputPricePer1M: 0.5, outputPricePer1M: output,
    inputModalities: ['text'], outputModalities: ['audio'],
    usageRates: [...batch(current).map(r => ({ ...r, validThrough: '2026-12-31' })), ...batch(future).map(r => ({ ...r, validFrom: '2027-01-01' }))],
    notes: `Approximately $${lite ? '0.0015' : '0.00225'} per 10 seconds of audio through 2026-12-31. Future rates are separate dated tiers; batch is half. ${TTS_PREVIEW_SHUTDOWN_NOTE}`,
    sourceUrls: [
      { label: 'Google official pricing', url: SOURCES_1104.google, publisher: 'Google' },
      { label: 'Gemini API deprecations', url: SOURCES_1104.deprecations, publisher: 'Google' },
    ],
  });
};
export const VOICE_MODELS_1104: AiCatalogItem[] = [
  ...[false, true].map(turbo => item(`eleven-v4${turbo ? '-turbo' : ''}`, `Eleven v4${turbo ? ' Turbo' : ''}`, 'ElevenLabs', 'elevenlabs', SOURCES_1104.elevenlabs, {
    pricing: `$${turbo ? '0.04' : '0.08'} / 1K characters (official API pay-as-you-go)`,
    unit: '1K characters', pricingUnit: 'per_1k_characters',
    inputModalities: ['text'], outputModalities: ['audio'],
    usageRates: [rate('text_to_speech', turbo ? 0.04 : 0.08, 'per_1k_characters')],
    notes: 'Official ElevenLabs API pay-as-you-go; Eleven v4 is $0.08/1K characters; $0.04 is Eleven v4 Turbo.',
  })),
  tts(false), tts(true),
  item('gemini-3.5-transcribe', 'Gemini 3.5 Transcribe', 'Google', 'google', SOURCES_1104.google, {
    pricing: '$2.00/M audio input tokens; $12.00/M output tokens; approximately $0.005/min blended',
    inputPricePer1M: 2, outputPricePer1M: 12, inputModalities: ['audio'], outputModalities: ['text'],
    usageRates: [rate('audio input', 2), rate('text output', 12)],
    notes: 'Approximately $0.003/min input plus $0.002/min output; blended approximately $0.005/min.',
  }),
  item('gemini-3.5-transcribe-live', 'Gemini 3.5 Transcribe Live', 'Google', 'google', SOURCES_1104.google, {
    pricing: 'Approximately $0.009/min', unit: 'minute', pricingUnit: 'per_minute', billingUnit: 'per_minute',
    pricePerUnit: 0.009, approximatePrice: true, inputModalities: ['audio'], outputModalities: ['text'],
    usageRates: [{ ...rate('live transcription', 0.009, 'minute'), approximate: true }],
  }),
];

export const EMBEDDING_MODELS_1104: AiCatalogItem[] = [
  item('gemini-embedding-2', 'Gemini Embedding 2', 'Google', 'google', SOURCES_1104.google, {
    kind: 'embedding-model', modelCategory: 'embedding', outputModalities: ['embedding'], releasedAt: '2026-04-22',
    pricing: 'Text $0.20/M; image $0.45/M; audio $6.50/M; video $12.00/M tokens; batch half',
    inputPricePer1M: 0.2, inputModalities: ['text', 'image', 'audio', 'video'],
    usageRates: batch([rate('text input', 0.2), rate('image input', 0.45), rate('audio input', 6.5), rate('video input', 12)]),
    notes: 'GA, released 2026-04-22. Image $0.00012/image; audio $0.00016/s; video $0.00079/frame. Batch is half. Replaces deprecated gemini-embedding-2-preview (formerly embedding-2-preview). Effective 2026-11-06, API requests to gemini-embedding-2-preview route to gemini-embedding-2 at Embedding 2 pricing; same API schema and embedding space, so stored vectors do not need re-indexing. The deprecations table lists the preview shutdown date as 2026-11-06 with that same routing note. gemini-embedding-001 shuts down 2028-05-14. Routing note checked 2026-11-07.',
    sourceUrls: [
      { label: 'Google pricing', url: SOURCES_1104.google, publisher: 'Google' },
      { label: 'Google deprecations', url: SOURCES_1104.deprecations, publisher: 'Google' },
      { label: 'Gemini API changelog (2026-11-06)', url: 'https://ai.google.dev/gemini-api/docs/changelog', publisher: 'Google' },
    ],
  }),
  ...([['text-embedding-3-small', 0.02], ['text-embedding-3-large', 0.13], ['text-embedding-ada-002', 0.1]] as const).map(([slug, input]) =>
    item(slug, slug, 'OpenAI', 'openai', SOURCES_1104.openai, {
      kind: 'embedding-model', modelCategory: 'embedding', outputModalities: ['embedding'], pricing: `$${input.toFixed(2)}/M input tokens`,
      inputPricePer1M: input, inputModalities: ['text'], usageRates: [rate('text input', input)],
    })),
];

export const SARVAM_PRISM_1104 = item('sarvam-prism', 'Sarvam Prism', 'Sarvam AI', 'sarvam', SOURCES_1104.sarvam, {
  kind: 'decision-model', modelCategory: 'decision', currency: 'INR',
  pricing: '₹4/M input tokens; output ₹0 (returns probabilities)', unit: 'INR/1M input tokens', billingUnit: 'per_token',
  inputPricePer1M: 4, outputPricePer1M: 0, pricePer1MTasks: null, inputModalities: ['text'], outputModalities: ['text'],
  notes: 'Based on Sarvam 105B. Returns probabilities; state counted once per request. Input-only billing, output ₹0.',
});

export const MUREKA_1104 = item('mureka', 'Mureka', 'Mureka', 'mureka', SOURCES_1104.mureka, {
  kind: 'music-model', modelCategory: 'music', inputModalities: ['text', 'audio'], outputModalities: ['music', 'audio'],
  capabilities: ['music generation', 'vocals', 'lyrics', 'instrumentals'], billingUnit: 'per_song', pricingUnit: 'per_generation', unit: 'song',
  pricing: 'API $0.03–$0.50/song', pricePerUnit: 0.03, pricePerUnitHigh: 0.5,
  usageRates: [
    ...['Lyrics-to-song', 'BGM'].flatMap(task => [rate(`${task} V9 / O2 / V8`, 0.045, 'song'), rate(`${task} V7.6`, 0.03, 'song'), rate(`${task} V9.5`, 0.15, 'song')]),
    rate('Prompt-to-song V7.6 / O2 / V8 / V9', 0.3, 'song'), rate('Prompt-to-song V9.5', 0.5, 'song'),
  ],
  notes: 'Per-song official API prices. Lyrics-to-song and BGM: V9/O2/V8 $0.045, V7.6 $0.03, V9.5 $0.15. Prompt-to-song: V7.6/O2/V8/V9 $0.30, V9.5 $0.50.',
});

export const GROK_VIDEO_1104: AiCatalogItem[] = [
  item('grok-imagine-video-720p', 'grok-imagine-video-720p', 'xAI', 'xai', SOURCES_1104.xai, {
    kind: 'video-model', modelCategory: 'video', inputModalities: ['text'], outputModalities: ['video'], unit: 'second', pricingUnit: 'per_second', billingUnit: 'per_second', resolutionTier: '720p',
    pricing: '$0.07/second (grok-imagine-video 1.0, 720p)', pricePerUnit: 0.07,
    usageRates: [rate('grok-imagine-video 1.0 720p', 0.07, 'second')],
    notes: 'This 720p row maps to grok-imagine-video (1.0): 480p $0.05/s, 720p $0.07/s.',
  }),
  item('grok-imagine-video-1-5-agent', 'grok-imagine-video-1.5-agent', 'xAI', 'xai', SOURCES_1104.xai, {
    kind: 'video-model', modelCategory: 'video', inputModalities: ['text'], outputModalities: ['video'], unit: 'second', pricingUnit: 'per_second', billingUnit: 'per_second',
    pricing: 'grok-imagine-video-1.5: 480p $0.08/s; 720p $0.14/s; 1080p $0.25/s', pricePerUnit: 0.08, pricePerUnitHigh: 0.25,
    usageRates: [rate('grok-imagine-video-1.5 480p', 0.08, 'second'), rate('grok-imagine-video-1.5 720p', 0.14, 'second'), rate('grok-imagine-video-1.5 1080p', 0.25, 'second')],
    notes: 'Mapped to grok-imagine-video-1.5. Separate lite model: 480p $0.02/s, 720p $0.03/s, 1080p $0.14/s; those prices do not apply to this row.',
  }),
].map(row => ({ ...row, sourceUrls: [...row.sourceUrls!, { label: 'xAI models', url: SOURCES_1104.xaiModels, publisher: 'xAI' }] }));

export const CATALOG_1104 = [...VOICE_MODELS_1104, ...EMBEDDING_MODELS_1104, SARVAM_PRISM_1104, ...GROK_VIDEO_1104];
