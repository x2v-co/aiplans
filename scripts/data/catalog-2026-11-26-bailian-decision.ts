import type { Sql } from 'postgres';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';
import {
  BAILIAN_DECISION_REGIONS, BAILIAN_DECISION_SPECS, BAILIAN_PRICING,
  DECISION_MODELS_2026_11_26, VERIFIED,
} from '../../src/lib/decision-models-2026-11-26';

/** Manual only. CLI rehearses real writes inside runRehearsable then ROLLBACK by default. No deletes. */
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const SEED_TABLES = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const;
export type Table = (typeof SEED_TABLES)[number];

/** Production-shaped expectation: official/producer qwen exists; these two models, channels and regional variants are absent. This is not a measured production dry-run. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 2, update: 0 },
  api_channel_prices: { insert: 2, update: 0 },
  api_channel_price_variants: { insert: 4, update: 0 },
} as const;

export function catalog20261126BailianDecisionSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-26-bailian-decision.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update';
  changes: ReturnType<typeof seedChanges>;
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

export async function seedCatalog20261126BailianDecision(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  const qwen = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'qwen'}`, 'providers/qwen', true)!;
  if (!['official', 'producer'].includes(String(qwen.type))) fail(`providers/qwen has type ${String(qwen.type)}`);
  const aliases = BAILIAN_DECISION_SPECS.flatMap(spec => [...spec.aliases]);
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(aliases)}`;
  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, row: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if ((table === 'api_channel_prices' || table === 'api_channel_price_variants') && row?.last_verified
      && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime()) return row;
    const changes = seedChanges(row, desired);
    const id = row?.id ?? previewId--;
    if (Object.keys(changes).length) {
      steps.push({ table, target, action: row ? 'update' : 'insert', changes });
      pending.push({ table, existing: row, values: desired, id });
    }
    return { ...row, ...desired, id };
  };

  for (const spec of BAILIAN_DECISION_SPECS) {
    const existing = one(models.filter(row => (spec.aliases as readonly string[]).includes(String(row.slug))), `models/${spec.slug}`);
    const item = DECISION_MODELS_2026_11_26.find(item => item.slug === spec.slug)!;
    const model = save('models', existing, {
      slug: spec.slug, name: item.name, type: 'llm', model_category: 'decision',
      provider_ids: [...new Set([...((existing?.provider_ids as number[] | undefined) ?? []), qwen.id])],
      context_window: spec.context, max_output_tokens: 0, open_source: false,
      released_at: new Date(`${spec.releasedAt}T00:00:00Z`),
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities,
      capabilities: item.capabilities, pricing_unit: 'per_1m_tokens',
      offical_link: item.url, description: verticalModelDescription(item),
    }, spec.slug);
    const channels = model.id < 0 ? [] : await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${qwen.id}`;
    const official = one(channels, `api_channel_prices/qwen/${spec.slug}`);
    const notes = `${item.notes} Verified ${VERIFIED}. Source: ${item.sourceUrls!.map(source => source.url).join(' ; ')}`;
    save('api_channel_prices', official, retainLockedUnavailable({
      model_id: model.id, provider_id: qwen.id,
      input_price_per_1m: spec.beijingInput, output_price_per_1m: 0,
      cached_input_price_per_1m: null, currency: 'CNY', price_unit: 'per_1m_tokens',
      is_available: true, last_verified: VERIFIED_AT, notes,
    }, official), `qwen/${spec.slug}`);

    const variants = model.id < 0 ? [] : await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${qwen.id}`;
    if (variants.some(row => row.is_headline === true && row.variant_key !== 'cn-beijing')) {
      fail(`qwen/${spec.slug} already has another headline variant`);
    }
    for (const region of BAILIAN_DECISION_REGIONS) {
      const current = one(variants.filter(row => row.variant_key === region.key), `${spec.slug}/${region.key}`);
      save('api_channel_price_variants', current, retainLockedUnavailable({
        model_id: model.id, provider_id: qwen.id,
        variant_key: region.key, variant_name: region.name, variant_kind: 'region',
        input_price_per_1m: region.headline ? spec.beijingInput : spec.singaporeInput,
        output_price_per_1m: 0, cached_input_price_per_1m: null,
        currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true,
        is_public: true, is_self_service: true, is_partner_only: false,
        is_headline: region.headline, headline_rank: region.headline ? 0 : 1,
        headline_reason: region.headline ? 'Official 华北2（北京） input-only list price.' : null,
        constraints_json: {
          region: region.key, input_only: true,
          ...(spec.status === 'preview' ? { limited_time_free: true }
            : { free_quota_tokens: region.headline ? 1_000_000 : 0,
              ...(region.headline ? { free_quota_validity_days: 90, free_quota_validity_basis: '自开通百炼、模型发布或申请通过之日起（以较晚者为准）' } : {}) }),
        },
        source_url: BAILIAN_PRICING, last_verified: VERIFIED_AT,
        notes: `${region.name}. ${notes}`,
      }, current), `qwen/${spec.slug}/${region.key}`);
    }
  }

  // All identities and uniqueness checks above complete before the first write.
  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      const payload = { ...op.values };
      if ('model_id' in payload) payload.model_id = resolveId(payload.model_id);
      if (op.existing) {
        await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.existing.id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(op.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(op.id, inserted.id);
      }
    }
  }
  return steps;
}
