/** Intentional unknowns stay visible as warnings, not fabricated zero prices. */
export function isExplicitlyUnverifiedPrice(row: {
  input_price_per_1m: number | null; output_price_per_1m: number | null;
  last_verified: unknown; notes?: string | null;
}) {
  return row.input_price_per_1m === null && row.output_price_per_1m === null
    && row.last_verified == null && row.notes?.startsWith('[needs-verification]') === true;
}

/** Verified free channels. A free gateway must never exempt other model channels. */
export function isVerifiedFreePrice(modelSlug: string | undefined, providerSlug: string | undefined) {
  if (providerSlug === 'zhipu-china' && (modelSlug === 'glm-4.7-flash' || modelSlug === 'glm-4.6v-flash')) return true;
  // https://opencode.ai/docs/zen/ Free models (2026-10-15): limited-time free endpoint deepseek-v4.1-flash-free.
  if (providerSlug === 'opencode-zen' && modelSlug === 'deepseek-v4.1-flash') return true;
  // Vercel endpoints + changelog verified 2026-10-17: only the Reflection-hosted
  // Beam route is temporarily free; other channels are not exempt.
  if ((providerSlug === 'vercel' || providerSlug === 'vercel-ai-gateway') && [
    'reflection-beam-1-0-501b-a23b', 'reflection-beam-1-0', 'reflection-beam', 'reflection/beam',
  ].includes(modelSlug ?? '')) return true;
  // /workspace/aiplans-gaps-facts.md, Nemotron 3.5 Lightning section (2026-10-15).
  return modelSlug === 'nemotron-3.5-lightning'
    && (providerSlug === 'vercel' || providerSlug === 'vercel-ai-gateway');
}

/** Audit A2 #2 explicitly confirms this paid-input/free-output API. */
/** OpenRouter /api/v1/models + /endpoints (checked 2026-10-15): ScaleDown's only endpoint bills input only, completion "0". */
const OPENROUTER_INPUT_ONLY = new Set(['scaledown-summarize', 'scaledown-extract']);

export function isVerifiedFreeOutput(modelSlug: string | undefined, providerSlug: string | undefined, input: number | null) {
  if (modelSlug === 'subq-snap' && providerSlug === 'subq' && input === 0.05) return true;
  // Vercel Decider announcement, verified 2026-10-17: input-only billing.
  if (providerSlug === 'vercel' || providerSlug === 'vercel-ai-gateway') {
    if (modelSlug === 'perplexity-pplx-decider-v1-2' && input === 0.02) return true;
    if (modelSlug === 'perplexity-pplx-decider-flash-v1-2' && input === 0.01) return true;
  }
  return OPENROUTER_INPUT_ONLY.has(modelSlug ?? '') && providerSlug === 'openrouter' && input != null && input > 0;
}
