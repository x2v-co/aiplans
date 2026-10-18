import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Display-layer fix for Intel 2026-10-18 midday: DeepSeek provider page still listed
 * "V4 Flash" and "V4.1 Flash" side by side without the 1017 snapshot. Official API
 * version is DeepSeek-V4.1-Flash-1017 (api-docs pricing page, checked 2026-10-18).
 * Does not touch CNY channel rows from seed-deepseek-v41-flash-cny-2026-10-18.
 */
export const OFFICIAL_SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';
export const VERIFIED_AT = new Date('2026-10-18T00:00:00Z');

export const DISPLAY_MODELS = [
  {
    slugs: ['deepseek-v4-flash'],
    name: 'DeepSeek V4 Flash (legacy slug; API DeepSeek-V4.1-Flash-1017)',
    description:
      `Legacy catalog slug deepseek-v4-flash. Official API ID deepseek-flash is currently served by model version DeepSeek-V4.1-Flash-1017. Prefer the deepseek-v4.1-flash row for aggregator channels. Source: ${OFFICIAL_SOURCE} (checked 2026-10-18).`,
  },
  {
    slugs: ['deepseek-v4.1-flash', 'deepseek-v4-1-flash'],
    name: 'DeepSeek V4.1 Flash (1017)',
    description:
      `Catalog identity for DeepSeek V4.1 Flash snapshot 1017 (API ID deepseek-flash / gateway id deepseek/deepseek-v4.1-flash-1017). Official version name DeepSeek-V4.1-Flash-1017. Source: ${OFFICIAL_SOURCE} (checked 2026-10-18).`,
  },
] as const;

export function flash1017DisplayOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-deepseek-flash-1017-display-2026-10-18.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Flash1017DisplayStep {
  table: 'models';
  target: string;
  action: 'update';
  changes: ReturnType<typeof seedChanges>;
}

/** Caller owns a serializable transaction. Default preview is SELECT-only. Never creates models. */
export async function seedDeepSeekFlash1017Display(tx: Sql, apply = false): Promise<Flash1017DisplayStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const steps: Flash1017DisplayStep[] = [];
  for (const model of DISPLAY_MODELS) {
    const existing = one(
      await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...model.slugs])}`,
      `models/${model.slugs[0]}`,
    );
    if (!existing) throw new Error(`Missing catalog model ${model.slugs[0]}; nothing written.`);
    const values = { name: model.name, description: model.description };
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) continue;
    steps.push({ table: 'models', target: String(existing.slug), action: 'update', changes });
    if (apply) {
      const payload = { ...values, updated_at: new Date() };
      await tx`UPDATE models SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
    }
  }
  return steps;
}
