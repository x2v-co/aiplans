import type { Sql } from 'postgres';
import type { ModelSelector } from '../../src/lib/plan-selector';
import { CLASSIFICATIONS } from '../config/plan-classifications';
import { ARGON_AI_PRO_NOTE, ARGON_SLUG, seedChanges } from './gemini-4-argon';

export function argonProSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-google-ai-pro-argon-2026-10-17.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Keep existing pricing/context prose and the separate Free API restriction. */
export function argonProNote(previous: string | null): string {
  const cleaned = (previous ?? '')
    .replace(/No Free API tier or Google AI Pro entitlement\.?/gi, 'No Free API tier.')
    .replace(/\bNo (?:Google )?AI Pro entitlement\.?/gi, '')
    .trim();
  return cleaned.includes(ARGON_AI_PRO_NOTE) ? cleaned : [cleaned, ARGON_AI_PRO_NOTE].filter(Boolean).join('\n');
}

type Row = Record<string, unknown> & { id: number };
type TextRow = Row & { notes: string | null };
export interface ArgonProStep {
  table: 'models' | 'plans' | 'api_channel_prices';
  target: string;
  action: 'update';
  changes: ReturnType<typeof seedChanges>;
}

/** Caller owns a serializable transaction. Preview uses SELECT only. No rows or prices are created. */
export async function seedArgonPro(tx: Sql, apply = false): Promise<ArgonProStep[]> {
  const one = <T extends Row>(rows: T[], target: string): T | null => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const google = one(await tx<Array<Row & { type: string | null }>>`SELECT id, type FROM providers WHERE slug = 'google'`, 'providers/google');
  if (!google || !['official', 'producer'].includes(google.type ?? '')) throw new Error('Expected official/producer google; nothing written.');
  const model = one(await tx<Array<Row & { description: string | null }>>`SELECT id, description FROM models WHERE slug = ${ARGON_SLUG}`, ARGON_SLUG);
  if (!model) throw new Error('Canonical gemini-4-argon model missing; nothing written.');
  const plan = one(await tx<Array<TextRow & { model_selector: ModelSelector | null }>>`
    SELECT id, notes, model_selector FROM plans WHERE provider_id = ${google.id} AND slug = 'google-ai-pro'`, 'plans/google-ai-pro');
  const channels = await tx<TextRow[]>`SELECT id, notes FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${google.id}`;
  one(channels, 'google/gemini-4-argon channel');

  // Plan all changes before writing, so an ambiguity never produces a partial preview/apply.
  const pending: Array<{ step: ArgonProStep; id: number; values: Record<string, unknown> }> = [];
  const update = (table: ArgonProStep['table'], target: string, existing: Row, values: Record<string, unknown>) => {
    const changes = seedChanges(existing, values);
    if (Object.keys(changes).length) pending.push({ step: { table, target, action: 'update', changes }, id: existing.id, values });
  };
  update('models', ARGON_SLUG, model, { description: argonProNote(model.description) });
  for (const channel of channels) {
    update('api_channel_prices', `google/${ARGON_SLUG}`, channel, { notes: argonProNote(channel.notes) });
  }
  if (plan) {
    const fallback = CLASSIFICATIONS.find(row => row.providerSlug === 'google' && row.planSlug === 'google-ai-pro')!;
    const selector = plan.model_selector ?? fallback.selector;
    // Preserve every other existing rule; legacy gemini-advanced is deliberately untouched.
    const model_selector = selector.exclude?.includes(ARGON_SLUG)
      ? { ...selector, exclude: selector.exclude.filter(slug => slug !== ARGON_SLUG) }
      : selector;
    update('plans', 'google/google-ai-pro', plan, { model_selector, notes: argonProNote(plan.notes) });
  }
  if (apply) {
    for (const { step, id, values } of pending) {
      const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
      await tx`UPDATE ${tx(step.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${id}`;
    }
  }
  return pending.map(({ step }) => step);
}
