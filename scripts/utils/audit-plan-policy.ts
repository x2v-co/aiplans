/**
 * Which classification fields a plan must carry (audit C14 plans.missing_kind).
 *
 * - model_selector is only meaningful for LLM plan kinds; creative plans
 *   (video/music/world/decision verticals) link no LLM models by design.
 * - official_reference / research rows are price-reference entries, not rungs
 *   of a purchasable ladder, so plan_line / tier_rank are optional there.
 */
export interface PlanClassificationRow {
  plan_kind?: string | null;
  plan_line?: string | null;
  tier_rank?: number | null;
  model_selector?: unknown;
  pricing_model?: string | null;
}

const REFERENCE_PRICING_MODELS = new Set(['official_reference', 'research']);
const NO_SELECTOR_KINDS = new Set(['creative']);

export function missingPlanFields(plan: PlanClassificationRow): string[] {
  const missing: string[] = [];
  const reference = REFERENCE_PRICING_MODELS.has(plan.pricing_model ?? '');
  if (!plan.plan_kind) missing.push('plan_kind');
  if (!reference && !plan.plan_line) missing.push('plan_line');
  if (!reference && plan.tier_rank == null) missing.push('tier_rank');
  if (!plan.model_selector && !NO_SELECTOR_KINDS.has(plan.plan_kind ?? '')) missing.push('model_selector');
  return missing;
}

/**
 * Audit exit code. Default: 1 on critical findings, else 0 (warnings are
 * reported but do not fail). `--strict` keeps the old contract: 2 when only
 * warnings exist.
 */
export function auditExitCode(hasCritical: boolean, findingCount: number, strict: boolean): number {
  if (hasCritical) return 1;
  return strict && findingCount > 0 ? 2 : 0;
}

/** Manual curation protects against deletion, not against stale verification. */
export function planVerificationFinding(
  plan: { id: number; slug: string; source?: string | null; last_verified?: string | Date | null },
  now: number,
  staleDays: number,
) {
  const verified = plan.last_verified ? new Date(plan.last_verified).getTime() : NaN;
  const ref = { plan: `${plan.slug}#${plan.id}` };
  if (!Number.isFinite(verified)) {
    return { check: 'plans.missing_verified', severity: 'warning' as const, message: 'plan.last_verified is missing or invalid', ref };
  }
  if (verified < now - staleDays * 86400_000) {
    const days = Math.floor((now - verified) / 86400_000);
    return { check: 'plans.stale', severity: 'warning' as const, message: `last_verified ${days}d ago`, ref: { ...ref, days } };
  }
  return null;
}

/** Freshness warnings require action even when the audit otherwise passes. */
export function shouldAlertFinding(finding: { check: string; severity: string }): boolean {
  return finding.severity === 'critical' || new Set([
    'prices.modelsdev_divergence', 'prices.aa_official_divergence',
    'plans.modelsdev_entitlements', 'plans.stale', 'plans.missing_verified',
  ]).has(finding.check);
}

/** Clearing resolved freshness fingerprints lets a later stale episode alert again. */
export function resolvedPlanFreshnessAlerts(saved: string[], active: Set<string>): string[] {
  return saved.filter(key => /^(plans\.stale|plans\.missing_verified):/.test(key) && !active.has(key));
}
