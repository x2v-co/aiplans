import type { Sql } from 'postgres';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';
import {
  CATALOG_1114,
  CF_EMBEDDING_300M_REPLACEMENT,
  CF_EMBEDDING_300M_SLUG,
  CF_EMBEDDING_ENDPOINT,
  CF_EMBEDDING_PRICE,
  CF_EMBEDDING_SLUG,
  PARALLEL_SLUG,
  TOKEN_PASS_CHANGELOG,
  TOKEN_PASS_CREDIT_USD,
  TOKEN_PASS_DOCS,
  TOKEN_PASS_FEE_USD,
  TOKEN_PASS_MODELS_DOCS,
  TOKEN_PASS_SLUG,
  VERIFIED,
} from '../../src/lib/catalog-2026-11-14';
import type { AiCatalogItem } from '../../src/lib/ai-vertical-catalog';

/**
 * Intel 2026-11-14 morning + noon aiplans gaps. Manual seed only; never part of
 * deploy or seed-catalog.sh. CLI dry-run uses apply=true inside runRehearsable
 * (writes then ROLLBACK). :apply is a separate npm script. No deletes.
 *
 * Writes: Token Pass credit $80→$150 and featured-model list; DeepSeek TTS/ASR
 * models + usage; Parallel Decisions Fast; Cloudflare EmbeddingGemma 2;
 * ZONOS3-Mini; optional embeddinggemma-300m replacement-text refresh.
 *
 * Not written: DeepSeek OCR (static api-pricing table only); Copilot 12-14
 * deprecations (src/lib/copilot.ts, no DB); Microsoft Foundry Claude retirement
 * dates (no first-party Foundry/Azure Claude channel to annotate; do not copy
 * 2027-02-22 onto official Anthropic model shutdown_date).
 */
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const TOKEN_PASS_MODELS = [
  { name: 'Kimi K3', gatewayId: 'moonshotai/kimi-k3', slugs: ['kimi-k3', 'moonshotai-kimi-k3'] },
  { name: 'Kimi K3.1 Pro', gatewayId: 'moonshotai/kimi-k3.1-pro', slugs: ['moonshotai-kimi-k3-1-pro', 'kimi-k3.1-pro', 'kimi-k3-1-pro'] },
  { name: 'GLM 5.3', gatewayId: 'zai/glm-5.3', slugs: ['glm-5.3', 'glm-5-3', 'zai-glm-5-3', 'z-ai-glm-5.3'] },
  { name: 'GLM 5.3 Flash', gatewayId: 'zai/glm-5.3-flash', slugs: ['glm-5.3-flash', 'glm-5-3-flash', 'zai-glm-5-3-flash'] },
  { name: 'DeepSeek V4.1 Flash', gatewayId: 'deepseek/deepseek-v4.1-flash', slugs: ['deepseek-v4.1-flash', 'deepseek-v4-1-flash'] },
] as const;

export const TOKEN_PASS_FEATURES = [
  `$${TOKEN_PASS_CREDIT_USD} monthly credit for $${TOKEN_PASS_FEE_USD}/month`,
  'Covers Kimi K3, Kimi K3.1 Pro, GLM 5.3, GLM 5.3 Flash, and DeepSeek V4.1 Flash (Vercel may change the set)',
  'Unused credit does not roll over',
  'Standard API keys and OIDC tokens fall back to the team AI Gateway balance when credit runs out; Token Pass-scoped keys hard-stop with 403 and no overage',
  'Zero Data Retention by default',
  'Early access for Vercel Pro teams only',
];

const TOKEN_PASS_NOTES = [
  `Gateway subscription: $${TOKEN_PASS_FEE_USD} per team per month buys $${TOKEN_PASS_CREDIT_USD} of Token Pass credit on Vercel AI Gateway, deducted at the Token Pass provider's per-token prices.`,
  'Featured models: Kimi K3 (moonshotai/kimi-k3), Kimi K3.1 Pro (moonshotai/kimi-k3.1-pro), GLM 5.3 (zai/glm-5.3), GLM 5.3 Flash (zai/glm-5.3-flash), and DeepSeek V4.1 Flash (deepseek/deepseek-v4.1-flash). Vercel may change them. Currently served by the token-pass provider (Wafer).',
  'Unused credit expires each billing period. When credit runs out, requests with a standard AI Gateway key or OIDC token fall back to the team AI Gateway balance at the serving provider\'s rates; requests with a Token Pass-scoped key fail with 403 until the next period, with no Token Pass overage and no charge to the Gateway balance.',
  'ZDR enabled by default; prompts not used for training. Early access for Pro teams, with limited spots and a waitlist when they fill.',
  `Sources: ${TOKEN_PASS_CHANGELOG} ; ${TOKEN_PASS_DOCS} ; ${TOKEN_PASS_MODELS_DOCS} (verified ${VERIFIED}).`,
].join('\n');

const VERCEL_SLUGS = ['vercel-ai-gateway', 'vercel'] as const;
const JSON_PLAN_COLUMNS = ['features', 'quotas', 'model_selector'];

export const SEED_TABLES = ['providers', 'models', 'usage_prices', 'api_channel_prices', 'plans', 'model_plan_mapping'] as const;
export type Table = (typeof SEED_TABLES)[number];

/** Production-shaped dry-run: vercel/cloudflare/deepseek and the five Token Pass models exist; parallel and zyphra do not; the five new models and Token Pass mappings for the three newly covered models do not; embeddinggemma-300m still says “available soon”. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 2, update: 0 },
  models: { insert: 5, update: 1 },
  usage_prices: { insert: 5, update: 0 },
  api_channel_prices: { insert: 1, update: 0 },
  plans: { insert: 0, update: 1 },
  model_plan_mapping: { insert: 3, update: 0 },
} as const;

export function catalog20261114IntelSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-14-intel.ts [--dry-run | --apply]');
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

const MODEL_TYPE: Record<string, { type: string; model_category: string }> = {
  'decision-model': { type: 'llm', model_category: 'decision' },
  'embedding-model': { type: 'llm', model_category: 'embedding' },
  'voice-model': { type: 'multimodal', model_category: 'speech' },
};

function openSource(item: AiCatalogItem): boolean {
  return (item.access ?? []).includes('open-weights');
}

export async function seedCatalog20261114Intel(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const wantedProvider = ['parallel', 'zyphra', 'cloudflare', 'deepseek', ...VERCEL_SLUGS] as const;
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(wantedProvider)}`;
  const providerBySlug = new Map(providers.map(row => [String(row.slug), row]));
  const existingProvider = (slugs: readonly string[], required = false) =>
    one(slugs.flatMap(slug => providerBySlug.get(slug) ? [providerBySlug.get(slug)!] : []), `providers/${slugs.join('|')}`, required);

  const allModelSlugs = [
    ...CATALOG_1114.map(item => item.slug!),
    CF_EMBEDDING_300M_SLUG,
    ...TOKEN_PASS_MODELS.flatMap(model => [...model.slugs]),
  ];
  const modelRows = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(allModelSlugs)}`;

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number; jsonKeys?: string[] }[] = [];
  let previewId = -1;
  const save = (table: Table, row: Row | null, desired: Record<string, unknown>, target: string, jsonKeys: string[] = []): Row => {
    if ((table === 'usage_prices' || table === 'api_channel_prices' || table === 'plans') && row?.last_verified
      && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      return row;
    }
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return row ?? { ...desired, id: row?.id ?? previewId } as Row;
    const id = row?.id ?? previewId--;
    steps.push({ table, target, action: row ? 'update' : 'insert', changes });
    pending.push({ table, existing: row, values: desired, id, jsonKeys });
    const next = { ...row, ...desired, id };
    if (table === 'providers') providerBySlug.set(String(desired.slug ?? row?.slug), next);
    return next;
  };
  const skip = (table: Table, target: string, reason: string) => {
    steps.push({ table, target, action: 'skip', changes: {}, reason });
  };

  const cloudflare = existingProvider(['cloudflare']);
  const deepseek = existingProvider(['deepseek']);
  const vercel = existingProvider(VERCEL_SLUGS);

  const parallel = existingProvider(['parallel']) ?? save('providers', null, {
    name: 'Parallel', slug: 'parallel', type: 'official',
    website: 'https://parallel.ai', pricing_url: 'https://docs.parallel.ai/getting-started/pricing',
    currency: 'USD', region: null, access_from_china: null,
    notes: `Source: https://docs.parallel.ai/getting-started/pricing (verified ${VERIFIED}).`,
  }, 'parallel');

  const zyphra = existingProvider(['zyphra']) ?? save('providers', null, {
    name: 'Zyphra', slug: 'zyphra', type: 'official',
    website: 'https://www.zyphra.com', pricing_url: 'https://www.zyphra.com/models/zonos3-mini',
    currency: 'USD', region: null, access_from_china: null,
    notes: `Source: https://www.zyphra.com/models/zonos3-mini (verified ${VERIFIED}).`,
  }, 'zyphra');

  const ownerFor = (item: AiCatalogItem): Row | null => {
    if (item.providerSlug === 'parallel') return parallel;
    if (item.providerSlug === 'zyphra') return zyphra;
    if (item.providerSlug === 'cloudflare') return cloudflare;
    if (item.providerSlug === 'deepseek') return deepseek;
    return null;
  };

  for (const item of CATALOG_1114) {
    const owner = ownerFor(item);
    if (!owner) {
      skip('models', item.slug!, `providers/${item.providerSlug} is missing; not created`);
      continue;
    }
    const matches = modelRows.filter(row => row.slug === item.slug);
    if (matches.length > 1) fail(`Ambiguous models for ${item.slug}`);
    const existing = matches[0] ?? null;
    const kind = MODEL_TYPE[item.kind];
    if (!kind) fail(`Unsupported kind ${item.kind} for ${item.slug}`);
    const ownerIds = [...new Set([
      ...((existing?.provider_ids as number[] | undefined) ?? []),
      owner.id,
      ...(item.slug === PARALLEL_SLUG && vercel ? [vercel.id] : []),
    ])];
    const model = save('models', existing, {
      slug: item.slug, name: item.name, type: kind.type, model_category: kind.model_category,
      provider_ids: ownerIds,
      context_window: item.contextWindow ?? null,
      open_source: openSource(item), license: item.license ?? null,
      input_type: item.inputModalities ?? null, output_type: item.outputModalities ?? null,
      input_modalities: item.inputModalities ?? null, output_modalities: item.outputModalities ?? null,
      capabilities: item.capabilities ?? null, pricing_unit: item.pricingUnit,
      offical_link: item.url, description: verticalModelDescription(item),
    }, item.slug!);

    const usageExisting = model.id > 0 && owner.id > 0
      ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id} AND provider_id = ${owner.id}`
      : [];
    for (const rate of item.usageRates ?? []) {
      const current = one(
        usageExisting.filter(row => row.price_kind === rate.priceKind && row.unit === rate.unit),
        `usage_prices/${item.slug}/${rate.priceKind}`,
      );
      save('usage_prices', current, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id, plan_id: current?.plan_id ?? null,
        price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: item.currency,
        source_url: item.sourceUrls![0].url, last_verified: VERIFIED_AT, is_available: true,
        constraints_json: { publishedPricingText: item.pricing, note: item.notes ?? null },
      }, current), `${item.slug}/${rate.priceKind}/${rate.unit}`);
    }

    if (item.slug === CF_EMBEDDING_SLUG) {
      const channels = model.id > 0 && owner.id > 0
        ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${owner.id}`
        : [];
      const channel = one(channels, `api_channel_prices/cloudflare/${item.slug}`);
      save('api_channel_prices', channel, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id,
        input_price_per_1m: CF_EMBEDDING_PRICE, output_price_per_1m: null,
        cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
        is_available: true, last_verified: VERIFIED_AT,
        notes: `Workers AI ${CF_EMBEDDING_ENDPOINT}: $${CF_EMBEDDING_PRICE}/M input tokens. Verified ${VERIFIED}. Source: ${item.url}`,
      }, channel), `cloudflare/${item.slug}`);
    }
  }

  const gemma300 = modelRows.filter(row => row.slug === CF_EMBEDDING_300M_SLUG);
  if (gemma300.length > 1) fail(`Ambiguous models/${CF_EMBEDDING_300M_SLUG}`);
  const oldGemma = gemma300[0] ?? null;
  if (!oldGemma) {
    skip('models', CF_EMBEDDING_300M_SLUG, 'not in catalog; replacement text not updated');
  } else {
    const nextReplacement = CF_EMBEDDING_300M_REPLACEMENT;
    const description = String(oldGemma.description ?? '').replace(
      '@cf/google/embeddinggemma-2 (available soon)',
      nextReplacement,
    );
    save('models', oldGemma, {
      replacement_model: nextReplacement,
      ...(description !== String(oldGemma.description ?? '') ? { description } : {}),
    }, CF_EMBEDDING_300M_SLUG);
  }

  const gateway = existingProvider(VERCEL_SLUGS);
  if (!gateway) {
    skip('plans', TOKEN_PASS_SLUG, 'providers/vercel-ai-gateway and providers/vercel are missing');
  } else {
    const planRows = await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${gateway.id} AND slug = ${TOKEN_PASS_SLUG}`;
    const existingPlan = one(planRows, `plans/${TOKEN_PASS_SLUG}`);
    if (!existingPlan) {
      skip('plans', TOKEN_PASS_SLUG, 'plan row is missing; this seed updates the existing Token Pass plan and does not create it');
    } else {
      const catalog = modelRows;
      const mapped: Row[] = [];
      const missing: string[] = [];
      for (const model of TOKEN_PASS_MODELS) {
        const found = one(catalog.filter(row => (model.slugs as readonly string[]).includes(String(row.slug))), `models/${model.slugs[0]}`);
        if (found) mapped.push(found); else missing.push(model.name);
      }
      if (missing.length) {
        skip('model_plan_mapping', 'token-pass-featured', `Missing catalog models (not created): ${missing.join(', ')}`);
      }
      const plan = save('plans', existingPlan, {
        monthly_api_credit_usd: TOKEN_PASS_CREDIT_USD,
        monthly_api_credit_status: null,
        has_overage_pricing: false,
        model_selector: { only_extra: true, extra: mapped.map(model => model.slug) },
        third_party_coverage: 'full',
        third_party_coverage_note: 'Kimi K3, Kimi K3.1 Pro, GLM 5.3, GLM 5.3 Flash, and DeepSeek V4.1 Flash via the token-pass provider; Vercel may change the featured set. Other models are not covered.',
        features: TOKEN_PASS_FEATURES,
        notes: TOKEN_PASS_NOTES,
        last_verified: VERIFIED_AT,
      }, TOKEN_PASS_SLUG, JSON_PLAN_COLUMNS);

      const mappings = plan.id > 0
        ? await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE plan_id = ${plan.id}`
        : [];
      for (const model of mapped) {
        const existing = one(mappings.filter(row => row.model_id === model.id), `${TOKEN_PASS_SLUG}/${model.slug}`);
        save('model_plan_mapping', existing, { model_id: model.id, plan_id: plan.id, source: 'manual' }, `${TOKEN_PASS_SLUG}/${model.slug}`);
      }
    }
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      const payload: Record<string, unknown> = { ...op.values };
      if (op.table !== 'model_plan_mapping') payload.updated_at = new Date();
      if ('model_id' in payload) payload.model_id = resolveId(payload.model_id);
      if ('provider_id' in payload) payload.provider_id = resolveId(payload.provider_id);
      if ('plan_id' in payload && payload.plan_id != null) payload.plan_id = resolveId(payload.plan_id);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolveId);
      for (const key of op.jsonKeys ?? []) {
        if (key in payload && payload[key] !== null) payload[key] = tx.json(payload[key] as never);
      }
      if ('constraints_json' in payload && payload.constraints_json !== null && typeof payload.constraints_json === 'object') {
        payload.constraints_json = tx.json(payload.constraints_json as never);
      }
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

