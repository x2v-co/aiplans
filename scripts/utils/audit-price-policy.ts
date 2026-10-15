/** Intentional unknowns stay visible as warnings, not fabricated zero prices. */
export function isExplicitlyUnverifiedPrice(row: {
  input_price_per_1m: number | null; output_price_per_1m: number | null;
  last_verified: unknown; notes?: string | null;
}) {
  return row.input_price_per_1m === null && row.output_price_per_1m === null
    && row.last_verified == null && row.notes?.startsWith('[needs-verification]') === true;
}

/** Audit A2 #2 explicitly confirms this paid-input/free-output API. */
export function isVerifiedFreeOutput(modelSlug: string | undefined, providerSlug: string | undefined, input: number | null) {
  return modelSlug === 'subq-snap' && providerSlug === 'subq' && input === 0.05;
}
