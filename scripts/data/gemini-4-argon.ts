import { effectivePrice } from '../../src/lib/effective-price';

export const ARGON_SLUG = 'gemini-4-argon';
export const ARGON_PROMO_ENDS_AT = '2026-12-01T08:00:00.000Z';
export const ARGON_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';
export const ARGON_UNENTITLED_PLANS = ['gemini-free', 'gemini-advanced', 'google-ai-pro'];

export function argonModelRow(googleId: number) {
  return { name: 'Gemini 4 Argon', slug: ARGON_SLUG, type: 'llm', model_category: 'text',
    context_window: 1_000_000, provider_ids: [googleId],
    offical_link: 'https://ai.google.dev/gemini-api/docs/models/gemini-4-argon' };
}

export function argonChannelRow(providerId: number, modelId: number | null, now: Date, google = true) {
  const row = {
    model_id: modelId, provider_id: providerId,
    input_price_per_1m: 2, output_price_per_1m: 10,
    cached_input_price_per_1m: google ? 0.1 : null,
    promo_ends_at: google ? ARGON_PROMO_ENDS_AT : null,
    regular_input_price_per_1m: google ? 4 : null,
    regular_output_price_per_1m: google ? 20 : null,
    regular_cached_input_price_per_1m: google ? 0.2 : null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    last_verified: new Date('2026-10-13T00:00:00Z'),
    notes: google
      ? `Source: ${ARGON_SOURCE} (updated 2026-10-13). Introductory Standard input/output/cache $2/$10/$0.10 through 2026-11-30; regular $4/$20/$0.20 thereafter. Cache is implicit only. Google gives no timezone; cutoff assumes Pacific midnight, ${ARGON_PROMO_ENDS_AT}. Batch and Flex $1/$5/$0.05 -> $2/$10/$0.10; Priority $3.60/$18/$0.18 -> $7.20/$36/$0.36. Tiers recorded in notes: Google does not currently use api_channel_price_variants. No Free API tier or Google AI Pro entitlement.`
      : 'Cursor lists Gemini 4 Argon at $2/$10 per 1M input/output (verified 2026-10-13). Third-party models are billed separately; no included subscription entitlement. Cache rate and future price schedule are unverified.',
  };
  return effectivePrice(row, now);
}

/** Print field-level changes, and avoid updates that only refresh updated_at. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MIDNIGHT = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/;

/** Canonical form for comparison: sorted object keys, Dates as ISO, UTC-midnight timestamps as dates. */
export function canonicalSeedValue(v: unknown): unknown {
  if (v instanceof Date) return canonicalSeedValue(v.toISOString());
  if (typeof v === 'string') {
    const midnight = v.match(ISO_MIDNIGHT);
    if (midnight) return midnight[1];
    if (!ISO_DATE.test(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v))) return canonicalSeedValue(new Date(v).toISOString());
    return v;
  }
  if (Array.isArray(v)) return v.map(canonicalSeedValue);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonicalSeedValue((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export function seedChanges(existing: Record<string, unknown> | null, desired: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(desired)) {
    const previous = existing?.[key] ?? null;
    if (!existing || JSON.stringify(canonicalSeedValue(previous)) !== JSON.stringify(canonicalSeedValue(value))) {
      changes[key] = { from: previous, to: value };
    }
  }
  return changes;
}
