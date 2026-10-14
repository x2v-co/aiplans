// Verified 2026-10-14. Keep the slug identical to OpenRouter's generated slug:
// unknown producers are ingested only when that exact model row already exists.
export const LFM_SLUG = 'liquid-lfm-2-5-24b-a2b';
export const LFM_OPENROUTER_ID = 'liquid/lfm-2.5-24b-a2b';
export const LFM_SOURCE = 'https://www.liquid.ai/blog/lfm2-5-24b-a2b';
export const LFM_HF_SOURCE = 'https://huggingface.co/LiquidAI/LFM2.5-24B-A2B';

export function liquidProviderRow() {
  return {
    name: 'Liquid AI', slug: 'liquid', type: 'official', region: 'global',
    currency: 'USD', website: 'https://www.liquid.ai',
    pricing_url: LFM_SOURCE, api_docs_url: 'https://docs.liquid.ai',
    access_from_china: false,
    notes: 'Liquid Console official API. Mainland China access has not been verified.',
  };
}

export function lfmModelRow(liquidId: number | null) {
  return {
    name: 'LFM2.5-24B-A2B', slug: LFM_SLUG, type: 'llm', model_category: 'text',
    provider_ids: liquidId == null ? null : [liquidId],
    context_window: 131_072,
    released_at: new Date('2026-10-13T00:00:00Z'),
    open_source: true, offical_link: LFM_HF_SOURCE,
    input_modalities: ['text'], output_modalities: ['text'],
    capabilities: ['reasoning', 'tool-calling', 'structured-outputs'],
    parameters: '24B', 'active parameters': '~2B',
    description: `Open-weight, reasoning-only mixture-of-experts model. Liquid reports 24B total / ~2B active parameters and a 131,072-token context (${LFM_SOURCE}). OpenRouter reports 2.45B active, 128,000 context and an 8,192-token completion limit for its route (${LFM_OPENROUTER_ID}; canonical liquid/lfm-2.5-24b-a2b-20261012). The completion limit is channel-specific.`,
  };
}

export function lfmOfficialChannelRow(liquidId: number | null, modelId: number | null) {
  return {
    model_id: modelId, provider_id: liquidId,
    input_price_per_1m: 0.10, output_price_per_1m: 1.00,
    cached_input_price_per_1m: 0.05,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    last_verified: new Date('2026-10-14T00:00:00Z'),
    notes: `Source: ${LFM_SOURCE} (released 2026-10-13; verified 2026-10-14). Liquid Console official input/cached input/output $0.10/$0.05/$1.00 per 1M tokens. Official context: 131,072 tokens. OpenRouter is a separate channel with separate prices and limits, maintained by its scraper.`,
  };
}
