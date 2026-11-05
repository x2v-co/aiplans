import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { replaceStalePlanNotes } from './catalog-2026-11-05-intel';

/** One-row manual fix for plans/google-ai-plus (id 1960); never part of rollout.
 * Only price/currency/price_unit/region/last_verified/notes on that row may change; nothing else is touched.
 * Evidence (re-checked 2026-11-05 SGT): official US subscriptions page (price rendered client-side) and
 * Google's 2026-06-08 announcement cutting AI Plus to $4.99/mo in the US (product lead Vikas Kansal on X;
 * reported by TechCrunch 2026-06-09). */
export const SLUG = 'google-ai-plus';
export const VERIFIED = '2026-11-05';
export const VERIFIED_AT = new Date('2026-11-05T00:00:00Z');
export const PLUS_SOURCE = 'https://gemini.google/us/subscriptions/?hl=en';
export const PLUS_NEWS_SOURCE = 'https://techcrunch.com/2026/06/09/google-just-fired-a-warning-shot-in-the-ai-subscription-price-wars/';
export const NOTE = `Google AI Plus US monthly price $4.99 (cut from $7.99 on 2026-06-08; ${PLUS_NEWS_SOURCE}). Verified ${VERIFIED}. Source: ${PLUS_SOURCE}`;
/** Stale lines: the withheld prefix line and the superseded 11-04 evidence line. */
export const STALE_PATTERNS = [/^\s*\[needs-verification\]/i, /US price not identified|prices withheld/i, /^US monthly price \$4\.99\. Verified 2026-11-04\./];
export const ALLOWED_FIELDS = ['price', 'currency', 'price_unit', 'region', 'last_verified', 'notes'] as const;

export function googleAiPlusSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-google-ai-plus-2026-11-05.ts [--dry-run (default, writes then ROLLBACK) | --apply]');
  }
  return { apply: args.includes('--apply') };
}
type Row = Record<string, unknown> & { id: number };
export interface Step { table: 'plans'; target: string; action: 'update'; changes: ReturnType<typeof seedChanges> }

/** Always writes inside the caller's transaction (runRehearsable rolls back unless --apply). */
export async function seedGoogleAiPlus20261105(tx: Sql): Promise<Step[]> {
  const google = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'google'}`;
  if (google.length !== 1) throw new Error('Ambiguous or missing providers/google; nothing written.');
  const plans = await tx<Row[]>`SELECT * FROM plans WHERE slug IN ${tx([SLUG])}`;
  if (plans.length !== 1) throw new Error(`Ambiguous or missing plans/${SLUG}; nothing written.`);
  const plan = plans[0];
  if ([plan.provider_id, plan.product_id].some(id => id != null && id !== google[0].id)) throw new Error(`Wrong plans/${SLUG} ownership; nothing written.`);
  const values: Record<string, unknown> = { price: 4.99, currency: 'USD', price_unit: 'per_month', region: 'US', last_verified: VERIFIED_AT,
    notes: replaceStalePlanNotes(plan.notes, STALE_PATTERNS, NOTE) };
  const changes = seedChanges(plan, values);
  if (!Object.keys(changes).length) return [];
  const payload = Object.fromEntries(Object.keys(changes).map(k => [k, values[k]]));
  await tx`UPDATE ${tx('plans')} SET ${tx({ ...payload, updated_at: new Date() }, ...Object.keys(payload), 'updated_at')} WHERE id = ${plan.id}`;
  return [{ table: 'plans', target: SLUG, action: 'update', changes }];
}
