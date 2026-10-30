/** Allow daily publication with a buffer, matching the default FX maximum age. */
export function parsePlanpriceV1TtlHours(value: string | undefined): number {
  const hours = Number(value ?? 30);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`PLANPRICE_V1_TTL_HOURS must be a positive finite number; received ${JSON.stringify(value)}`);
  }
  return hours;
}
