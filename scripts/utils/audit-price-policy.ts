/** Intentional unknowns stay visible as warnings, not fabricated zero prices. */
export function isExplicitlyUnverifiedPrice(row: {
  input_price_per_1m: number | null; output_price_per_1m: number | null;
  last_verified: unknown; notes?: string | null;
}) {
  return row.input_price_per_1m === null && row.output_price_per_1m === null
    && row.last_verified == null && row.notes?.startsWith('[needs-verification]') === true;
}

/** Audit A2 #2 explicitly confirms this paid-input/free-output API. */
/** OpenRouter /api/v1/models + /endpoints (checked 2026-10-15): ScaleDown's only endpoint bills input only, completion "0". */
const OPENROUTER_INPUT_ONLY = new Set(['scaledown-summarize', 'scaledown-extract']);

export function isVerifiedFreeOutput(modelSlug: string | undefined, providerSlug: string | undefined, input: number | null) {
  if (modelSlug === 'subq-snap' && providerSlug === 'subq' && input === 0.05) return true;
  return OPENROUTER_INPUT_ONLY.has(modelSlug ?? '') && providerSlug === 'openrouter' && input != null && input > 0;
}
