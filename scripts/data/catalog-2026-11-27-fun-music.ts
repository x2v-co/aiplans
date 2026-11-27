import type { Sql } from 'postgres';
import {
  BILLING_RULE, CHANNEL_SLUG, FUN_MUSIC_CATALOG, FUN_MUSIC_MODELS, INVITE_NOTE,
  PRICE_KIND, PRICE_UNIT, PRICING_PAGE, PRICING_UNIT, QUOTA_VALIDITY, REGION, TICKET_URL, VERIFIED,
} from '../../src/lib/catalog-2026-11-27-fun-music';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';

/** Manual only. Caller owns the serializable transaction; validate everything
 * before writing. No provider inserts, token prices, plans, deletes or .env. */
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const SEED_TABLES = ['providers', 'models', 'usage_prices'] as const;
/** Production-shaped expectation, NOT a measured production dry-run:
 * qwen exists; both models and their planless output-audio prices are absent. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 2, update: 0 },
  usage_prices: { insert: 2, update: 0 },
} as const;

export function funMusicSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run', '--db'].includes(arg)) ||
      (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-27-fun-music.ts [--dry-run | --apply] [--db]');
  }
  return { apply: args.includes('--apply'), db: args.includes('--db') || args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = typeof SEED_TABLES[number];
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }
export function seedStepCounts(steps: Step[]) {
  const counts = Object.fromEntries(SEED_TABLES.map(table => [table, { insert: 0, update: 0 }])) as Record<Table, { insert: number; update: number }>;
  for (const step of steps) counts[step.table][step.action]++;
  return counts;
}

export async function seedFunMusic1127(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (message: string): never => { throw new Error(`${message}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target}`);
    return rows[0] ?? null;
  };
  const channel = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${CHANNEL_SLUG}`, 'providers/qwen', true)!;
  if (!['official', 'producer', 'cloud'].includes(String(channel.type))) fail('Unexpected Model Studio channel type');
  const lookup = FUN_MUSIC_MODELS.flatMap(model => [model.id, `qwen-${model.id}`, `qwen/${model.id}`]);
  const matches = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(lookup)}`;
  if (matches.some(row => !FUN_MUSIC_MODELS.some(model => model.id === row.slug))) fail('Non-canonical Fun-Music identity');

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, old: Row | null, values: Record<string, unknown>, target: string): Row => {
    const changes = seedChanges(old, values);
    if (!Object.keys(changes).length) return old!;
    const id = old?.id ?? previewId--;
    steps.push({ table, target, action: old ? 'update' : 'insert', changes });
    pending.push({ table, existing: old, values, id });
    return { ...old, ...values, id };
  };

  for (const [index, fact] of FUN_MUSIC_MODELS.entries()) {
    const item = FUN_MUSIC_CATALOG[index];
    const existing = one(matches.filter(row => row.slug === fact.id), `models/${fact.id}`);
    if (existing && ((existing.type != null && existing.type !== 'multimodal') ||
        (existing.model_category != null && existing.model_category !== 'music'))) fail('Unexpected model taxonomy');
    if (existing?.provider_ids != null && (!Array.isArray(existing.provider_ids) ||
        existing.provider_ids.some(id => id !== channel.id))) fail('Unexpected model provider ownership');
    if (existing?.pricing_unit != null && existing.pricing_unit !== PRICING_UNIT) fail('Unexpected model billing unit');
    const evidence = verticalModelDescription(item);
    const description = String(existing?.description ?? '');
    const model = save('models', existing, {
      slug: fact.id, name: fact.name, type: 'multimodal', model_category: 'music', provider_ids: [channel.id],
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities,
      capabilities: item.capabilities, pricing_unit: PRICING_UNIT,
      ...(existing?.offical_link ? {} : { offical_link: PRICING_PAGE }),
      description: description.includes(evidence) ? description : [description, evidence].filter(Boolean).join('\n'),
    }, fact.id);
    const usageRows = existing ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${existing.id} AND provider_id = ${channel.id}` : [];
    const owned = usageRows.filter(row => row.plan_id == null);
    if (owned.some(row => row.price_kind !== PRICE_KIND || row.unit !== PRICE_UNIT ||
        (row.currency != null && row.currency !== 'CNY') ||
        ((row.constraints_json as Record<string, unknown> | null)?.region != null &&
         (row.constraints_json as Record<string, unknown>).region !== REGION))) fail('Unexpected usage pricing identity/unit/region');
    const usage = one(owned, `usage_prices/${fact.id}`);
    // Preserve newer verification evidence and any existing unavailability.
    if (!usage?.last_verified || new Date(String(usage.last_verified)).getTime() <= VERIFIED_AT.getTime()) {
      save('usage_prices', usage, {
        model_id: model.id, provider_id: channel.id, plan_id: null,
        price_kind: PRICE_KIND, unit: PRICE_UNIT, price: fact.price, currency: 'CNY',
        is_available: usage?.is_available === false ? false : true,
        source_url: PRICING_PAGE, last_verified: VERIFIED_AT,
        constraints_json: {
          official_model_id: fact.id, region: REGION, region_label: '华北2（北京）',
          billing_rule: BILLING_RULE, input_charged: false, note: INVITE_NOTE, ticket_url: TICKET_URL,
          access: 'invite-only', free_quota: { seconds: fact.freeSeconds, label: fact.freeSeconds ? '1,000 秒' : '无',
            ...(fact.freeSeconds ? { validity: QUOTA_VALIDITY } : {}) },
        },
      }, `${CHANNEL_SLUG}/${fact.id}/${REGION}/${PRICE_KIND}`);
    }
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id']) if (key in payload) payload[key] = resolveId(payload[key]);
      if (operation.existing) await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(operation.id, inserted.id);
      }
    }
  }
  return steps;
}
