import { DECISION_1103_SPECS, decision1103ChannelProviders } from '../../src/lib/decision-models-2026-11-03';
import { MORPH_REFLEX_SPEC } from '../../src/lib/decision-models-2026-11-05';
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
  // Ant Ling pricing page, verified 2026-11-06: Ling-3.2-flash is free for the first two weeks
  // after the 2026-11-05 launch. No post-promo price. Only this official channel is exempt.
  if (providerSlug === 'inclusionai' && modelSlug === 'inclusionai-ling-3-2-flash') return true;
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

/**
 * Intel 2026-11-03 decision models, re-checked 2026-11-03: Workers AI model pages / pricing table list only
 * "$x per M input tokens" and say "Clef models do not charge for output tokens" (Clairic's usage reports
 * output_tokens 0); Vercel AI Gateway /v1/models returns pricing.output "0" (type "evaluation") for
 * Baseten Mammoth-1 / Elephant-1 and Liquid d1 / d1-ultra. Exempt only those explicitly inputOnly specs,
 * on their verified channel, while input stays positive.
 */
const INPUT_ONLY_1103 = new Map(DECISION_1103_SPECS.filter(spec => spec.inputOnly)
  .map(spec => [spec.slug, new Set(decision1103ChannelProviders(spec))]));

export function isVerifiedFreeOutput(modelSlug: string | undefined, providerSlug: string | undefined, input: number | null) {
  // https://openrouter.ai/morph/reflex, verified 2026-11-05: decisions bill input only.
  if (modelSlug === MORPH_REFLEX_SPEC.slug && providerSlug === MORPH_REFLEX_SPEC.channel && input != null && input > 0) return true;
  // Official Sarvam pricing, verified 2026-11-04: ₹4/M input, free probability output.
  if (modelSlug === 'sarvam-prism' && providerSlug === 'sarvam' && input === 4) return true;
  if (INPUT_ONLY_1103.get(modelSlug ?? '')?.has(providerSlug ?? '') && input != null && input > 0) return true;
  if (modelSlug === 'subq-snap' && providerSlug === 'subq' && input === 0.05) return true;
  // Vercel Decider announcement, verified 2026-10-17: input-only billing.
  if (providerSlug === 'vercel' || providerSlug === 'vercel-ai-gateway') {
    if (modelSlug === 'perplexity-pplx-decider-v1-2' && input === 0.02) return true;
    if (modelSlug === 'perplexity-pplx-decider-flash-v1-2' && input === 0.01) return true;
  }
  return OPENROUTER_INPUT_ONLY.has(modelSlug ?? '') && providerSlug === 'openrouter' && input != null && input > 0;
}

/**
 * OpenRouter /api/v1/models publishes free / stealth / `:free` models with pricing
 * { prompt: "0", completion: "0" } (checked 2026-11-05: stealth/crouton-alpha and 15 others).
 * The scraper (classifyOpenRouterPricing) rejects missing/empty pricing as invalid, so a stored
 * openrouter row with input === 0 AND output === 0 is an explicit published free price, not missing
 * data. null, negative, or one-sided zero stays critical.
 */
export function isOpenRouterPublishedFree(providerSlug: string | undefined, input: number | null | undefined, output: number | null | undefined) {
  return providerSlug === 'openrouter' && input === 0 && output === 0;
}
