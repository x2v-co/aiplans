import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Facts supplied in /workspace/aiplans-gaps-facts.md, Step 5 Preview section only.
// Identity follows generateOpenRouterSlug('stepfun/step-5-preview').
export const STEP5_SLUG = 'stepfun-step-5-preview';
export const STEP5_SOURCE = 'https://huggingface.co/stepfun-ai/Step-5-Preview';
export const STEP5_METADATA = {
  open_source: true,
  license: 'StepFun Model License 1.0',
  license_url: STEP5_SOURCE,
  offical_link: STEP5_SOURCE,
  parameters: '600B',
  'active parameters': '27B',
  context_window: 1_000_000,
} as const;

export function step5SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-step5-license.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Caller owns a serializable transaction. Preview executes SELECT only.
 * Requires 0009_model_license; updates the existing model, never prices.
 */
export async function seedStep5License(tx: Sql, apply = false) {
  const rows = await tx<Array<Record<string, unknown> & { id: number }>>`
    SELECT id, slug, open_source, license, license_url, offical_link,
           parameters, "active parameters", context_window
    FROM models WHERE slug = ${STEP5_SLUG}
  `;
  if (rows.length > 1) throw new Error(`Ambiguous models/${STEP5_SLUG}; transaction aborted. Review duplicates before retrying.`);
  if (!rows.length) throw new Error(`Missing models/${STEP5_SLUG}; transaction aborted. Verify the existing catalog identity before retrying.`);
  const existing = rows[0];
  const changes = seedChanges(existing, STEP5_METADATA);
  if (!Object.keys(changes).length) return [];
  if (apply) {
    const payload = { ...STEP5_METADATA, updated_at: new Date() };
    await tx`UPDATE models SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
  }
  return [{ table: 'models', target: STEP5_SLUG, action: 'update', changes }];
}
