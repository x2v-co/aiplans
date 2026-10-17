import type { Sql } from 'postgres';
import { ARGON_SLUG } from './gemini-4-argon';

/**
 * The live Google AI Pro row is google/gemini-advanced (historical slug). #213's seed looked up
 * slug 'google-ai-pro', which has no row, so it silently skipped the plan. This seed only removes
 * gemini-4-argon from that row's model_selector.exclude; every other field and rule is untouched.
 */
export const ADVANCED_SLUG = 'gemini-advanced';

export function advancedArgonSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-gemini-advanced-argon-2026-10-17.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Selector = Record<string, unknown> & { exclude?: unknown };
export interface AdvancedArgonStep {
  table: 'plans'; target: string; id: number; action: 'update';
  changes: { model_selector: { from: Selector; to: Selector } };
}

/** Caller owns a serializable transaction. Throws (nothing written) unless exactly one row matches. */
export async function seedAdvancedArgon(tx: Sql, apply = false): Promise<AdvancedArgonStep[]> {
  const providers = await tx<Array<{ id: number; type: string | null }>>`SELECT id, type FROM providers WHERE slug = 'google'`;
  if (providers.length !== 1) throw new Error(`Expected exactly one google provider, found ${providers.length}; nothing written.`);
  const plans = await tx<Array<{ id: number; model_selector: Selector | null }>>`
    SELECT id, model_selector FROM plans WHERE provider_id = ${providers[0].id} AND slug = ${ADVANCED_SLUG}`;
  if (plans.length !== 1) throw new Error(`Expected exactly one google/${ADVANCED_SLUG} plan, found ${plans.length}; nothing written.`);
  const [plan] = plans;
  const selector = plan.model_selector;
  if (!selector || !Array.isArray(selector.exclude) || !selector.exclude.includes(ARGON_SLUG)) return [];
  const to: Selector = { ...selector, exclude: (selector.exclude as unknown[]).filter(slug => slug !== ARGON_SLUG) };
  if (apply) {
    await tx`UPDATE plans SET model_selector = ${tx.json(to as never)}, updated_at = ${new Date()} WHERE id = ${plan.id}`;
  }
  return [{ table: 'plans', target: `google/${ADVANCED_SLUG}`, id: plan.id, action: 'update',
    changes: { model_selector: { from: selector, to } } }];
}
