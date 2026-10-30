/** Historical rows stay addressable, but no longer claim current entitlements. */
export function isSupersededPlan(plan: { notes?: string | null }): boolean {
  return /\[aiplans:superseded-by\s+[^\]]+\]/.test(plan.notes ?? '');
}
