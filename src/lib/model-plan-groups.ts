import { groupPlansByKind } from './plan-kinds';

type OwnedPlan = { providers: { id: number } | null; plan_kind: string | null };

/** Ownership comes from the model producer, never from a plan's provider type:
 * GitHub is official for Copilot, but third-party on an OpenAI model page. */
export function groupModelPlansByOwnership<T extends OwnedPlan>(plans: readonly T[], producerId: number | null) {
  return [true, false].flatMap(official => {
    const rows = plans.filter(plan => (producerId != null && plan.providers?.id === producerId) === official);
    return rows.length ? [{ official, kindGroups: groupPlansByKind(rows, plan => plan.plan_kind) }] : [];
  });
}
