/** Null prices require a deliberate, visible provenance marker. Partial nulls are rejected. */
export function allowsUnverifiedPrice(data: {
  input_price_per_1m: number | null; output_price_per_1m: number | null;
  notes?: string; last_verified: Date | null;
}) {
  return data.input_price_per_1m === null && data.output_price_per_1m === null
    && data.last_verified === null && data.notes?.startsWith('[needs-verification]') === true;
}
