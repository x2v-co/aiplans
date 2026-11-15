import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Intel 2026-11-15 07:50 morning aiplans gaps. Manual seed only; never part of
 * deploy or seed-catalog.sh. CLI dry-run uses apply=true inside runRehearsable
 * (writes then ROLLBACK). :apply is a separate npm script. No deletes.
 *
 * Writes: Qwen Model Studio (千问AI平台/百炼) Qwen3.5 legacy shutdown. New
 * purchases stop 2026-11-18; inference stops 2027-01-19 10:00 Beijing time
 * (02:00 UTC, same UTC day, so shutdown_date is 2027-01-19). Replacement
 * qwen3.8-flash.
 *
 * shutdown_date retires every channel of a model row (shutdown-availability
 * sweep), so it is written only where every channel is Alibaba-served:
 * qwen3.5-plus (Qwen official only) and the two dated plus snapshots (their
 * only channel is OpenRouter, whose only upstream is Alibaba). qwen3.5-397b-a17b
 * is open weights served by DeepInfra, Novita, Parasail and others on
 * OpenRouter, so the model row is left alone and only its Qwen official channel
 * gets the notice.
 *
 * Not written: Coding Plan / Token Plan mappings for these models (removing a
 * mapping is a delete; the shutdown_date badge covers it). ChatGPT voice
 * retirement and Decider v1.3 AA scores are code-only.
 */
export const VERIFIED = '2026-11-15';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const QWEN35_SOURCE = 'https://platform.qianwenai.com/docs/changelog/model-deprecations/qwen3.5-legacy-models';
export const QWEN35_ANNOUNCED_ON = '2026-10-19';
export const QWEN35_EOM = '2026-11-18';
export const QWEN35_SHUTDOWN_DATE = '2027-01-19';
export const QWEN35_REPLACEMENT = 'qwen3.8-flash';
const ALIBABA_PROVIDERS = ['qwen', 'openrouter'];

export interface Qwen35Spec { slug: string; apiId: string; input: number; output: number; exclusive: boolean }
export const QWEN35_MODELS: readonly Qwen35Spec[] = [
  { slug: 'qwen3.5-plus', apiId: 'qwen3.5-plus', input: 0.8, output: 4.8, exclusive: true },
  { slug: 'qwen-qwen3-5-plus-02-15', apiId: 'qwen3.5-plus-2026-02-15', input: 0.8, output: 4.8, exclusive: true },
  { slug: 'qwen-qwen3-5-plus-20260420', apiId: 'qwen3.5-plus-2026-04-20', input: 0.8, output: 4.8, exclusive: true },
  { slug: 'qwen3.5-397b-a17b', apiId: 'qwen3.5-397b-a17b', input: 1.2, output: 7.2, exclusive: false },
];

export function qwen35Notice(spec: Qwen35Spec): string {
  return `Qwen Model Studio ${spec.apiId} (¥${spec.input} / ¥${spec.output} per 1M input/output tokens): new purchases stop ${QWEN35_EOM}; inference stops ${QWEN35_SHUTDOWN_DATE} 10:00 Beijing time (subject to the actual change time). Recommended replacement ${QWEN35_REPLACEMENT} (¥0.8 / ¥2.7). Coding Plan / Token Plan models are removed at the same time; unused prepaid packs can be refunded by ticket. Announced ${QWEN35_ANNOUNCED_ON}. Source: ${QWEN35_SOURCE} (verified ${VERIFIED}).`;
}

export const SEED_TABLES = ['models', 'api_channel_prices'] as const;
export type Table = (typeof SEED_TABLES)[number];

/** Production-shaped dry-run: the four rows exist without a shutdown_date; 397b has one Qwen official channel. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  models: { insert: 0, update: 3 },
  api_channel_prices: { insert: 0, update: 1 },
} as const;

export function catalog20261115IntelSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-15-intel.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update' | 'skip';
  changes: ReturnType<typeof seedChanges>;
  reason?: string;
}

export function seedStepCounts(steps: Step[]) {
  return Object.fromEntries(SEED_TABLES.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

/** postgres.js parses DATE columns to a UTC-midnight Date; compare as YYYY-MM-DD. */
function day(value: unknown): string | null {
  if (value == null) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export async function seedCatalog20261115Intel(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const steps: Step[] = [];
  const pending: { table: Table; id: number; values: Record<string, unknown> }[] = [];
  const skip = (table: Table, target: string, reason: string) => steps.push({ table, target, action: 'skip', changes: {}, reason });
  const save = (table: Table, row: Row, desired: Record<string, unknown>, target: string) => {
    if (table === 'api_channel_prices' && row.last_verified
      && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime()) return;
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return;
    steps.push({ table, target, action: 'update', changes });
    pending.push({ table, id: row.id, values: desired });
  };

  const slugs = QWEN35_MODELS.map(spec => spec.slug);
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(slugs)}`;
  const providers = await tx<Row[]>`SELECT id, slug FROM providers WHERE slug IN ${tx(ALIBABA_PROVIDERS)}`;
  const qwen = providers.find(row => row.slug === 'qwen') ?? null;
  const alibabaIds = new Set(providers.map(row => row.id));

  for (const spec of QWEN35_MODELS) {
    const matches = models.filter(row => row.slug === spec.slug);
    if (matches.length > 1) fail(`Ambiguous models/${spec.slug}`);
    const model = matches[0];
    if (!model) { skip('models', spec.slug, 'not in catalog; not created'); continue; }
    const channels = await tx<Row[]>`SELECT id, provider_id, notes, last_verified FROM api_channel_prices WHERE model_id = ${model.id}`;
    if (spec.exclusive) {
      const foreign = channels.filter(row => !alibabaIds.has(row.provider_id as number));
      if (foreign.length) {
        skip('models', spec.slug, `has non-Alibaba channels (provider_id ${foreign.map(row => row.provider_id).join(', ')}); shutdown_date would retire them, left alone`);
        continue;
      }
      const shutdown = day(model.shutdown_date);
      if (shutdown && shutdown !== QWEN35_SHUTDOWN_DATE) {
        skip('models', spec.slug, `already has shutdown_date ${shutdown}; not overwritten`);
        continue;
      }
      save('models', { ...model, shutdown_date: shutdown, deprecated_at: day(model.deprecated_at) }, {
        shutdown_date: QWEN35_SHUTDOWN_DATE,
        deprecated_at: QWEN35_ANNOUNCED_ON,
        replacement_model: QWEN35_REPLACEMENT,
        deprecation_source_url: QWEN35_SOURCE,
        description: appendEvidence(model.description, qwen35Notice(spec)),
      }, spec.slug);
      continue;
    }
    const official = qwen ? channels.filter(row => row.provider_id === qwen.id) : [];
    if (official.length !== 1) {
      skip('api_channel_prices', `qwen/${spec.slug}`, `expected one Qwen official channel, found ${official.length}; shared open-weights model row not retired`);
      continue;
    }
    save('api_channel_prices', official[0], { notes: appendEvidence(official[0].notes, qwen35Notice(spec)) }, `qwen/${spec.slug}`);
  }

  if (apply) {
    for (const op of pending) {
      const payload = { ...op.values, updated_at: new Date() };
      await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.id}`;
    }
  }
  return steps;
}
