import type { Sql } from 'postgres';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { verticalModelDescription } from './catalog-audit-vertical';
import { voiceModelType } from './catalog-2026-11-05-intel';
import { retainLockedUnavailable } from '../utils/manual-unavailable';
import {
  CATALOG_1113, ELEVENLABS_1113, XAI_VIDEO_1113,
} from '../../src/lib/catalog-2026-11-13';
import type { AiCatalogItem } from '../../src/lib/ai-vertical-catalog';

/**
 * Intel 2026-11-13 P0/P1 corrections. Optional manual seed, never part of
 * deploy or seed-catalog.sh. The CLI dry-run calls this with apply=true inside
 * runRehearsable, which rolls back. :apply is a separate npm script. No deletes.
 * Missing lifecycle rows are skipped. A usage row verified after VERIFIED_AT is
 * left alone. Does not create a second provider. Long-context tiers and the
 * Alibaba Token Plan personal edition are not in this seed.
 */
export const VERIFIED = '2026-11-13';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const ELEVENLABS_API = 'https://elevenlabs.io/pricing/api';
export const MISTRAL_MODELS = 'https://docs.mistral.ai/models';
export const GEMINI_DEPRECATIONS = 'https://ai.google.dev/gemini-api/docs/deprecations';
export const OPENAI_DEPRECATIONS = 'https://developers.openai.com/api/docs/deprecations';
export const XAI_PRICING = 'https://docs.x.ai/developers/pricing';
export const QWEN_TOKEN_PLAN = 'https://help.aliyun.com/zh/model-studio/token-plan-personal-overview';

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;

export interface LifecycleFix {
  key: string;
  slugs: readonly string[];
  deprecatedAt?: string;
  shutdownDate?: string;
  replacement: string;
  source: string;
  note: string;
}

export const LIFECYCLE: readonly LifecycleFix[] = [
  {
    key: 'mistral-medium-3.5',
    slugs: ['mistral-medium-3.5', 'mistral-medium-3-5'],
    deprecatedAt: '2026-10-31',
    shutdownDate: '2027-04-30',
    replacement: 'mistral-large-4',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Mistral Medium 3.5, API mistral-medium-3-5, deprecation 2026-10-31, retirement 2027-04-30, replacement Mistral Large 4.',
      [MISTRAL_MODELS],
    ),
  },
  {
    key: 'gemini-3.1-flash-lite',
    slugs: ['gemini-3.1-flash-lite'],
    shutdownDate: '2027-05-07',
    replacement: 'gemini-3.5-flash-lite',
    source: GEMINI_DEPRECATIONS,
    note: evidence(
      'Gemini deprecations table row gemini-3.1-flash-lite: release date May 7, 2026, shutdown date May 7, 2027, recommended replacement gemini-3.5-flash-lite. The page states that shutdown dates in the table are the earliest possible dates a model might be retired, and that Google will communicate the exact shutdown date with advance notice. No separate deprecation-announcement date is published, so deprecated_at is left unset. The May 7, 2026 column is the release date.',
      [GEMINI_DEPRECATIONS],
    ),
  },
  {
    key: 'devstral-2512',
    slugs: ['mistral-devstral-2512', 'devstral-2512', 'devstral-2'],
    deprecatedAt: '2026-05-22',
    shutdownDate: '2026-07-31',
    replacement: 'mistral-medium-3.5',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Devstral 2, API devstral-2512, deprecation 2026-05-22, retirement 2026-07-31, replacement Mistral Medium 3.5. Production catalog slug is mistral-devstral-2512; this seed does not rewrite the slug.',
      [MISTRAL_MODELS],
    ),
  },
  {
    key: 'gpt-image-2',
    slugs: ['gpt-image-2'],
    deprecatedAt: '2026-11-10',
    shutdownDate: '2027-02-10',
    replacement: 'gpt-image-2.6-sunburst or gpt-image-2.6-flare',
    source: OPENAI_DEPRECATIONS,
    note: evidence(
      'OpenAI deprecations table: gpt-image-2 and snapshot gpt-image-2-2026-04-21 are deprecated (announced Nov 10, 2026) and shut down February 10, 2027. Replacement gpt-image-2.6-sunburst or gpt-image-2.6-flare. This updates the models row (the /models/ copy and API shutdown_date). The image-models static page was already marked.',
      [OPENAI_DEPRECATIONS],
    ),
  },
  {
    key: 'gpt-image-2-snapshot',
    slugs: ['gpt-image-2-2026-04-21', 'openai-gpt-image-2-2026-04-21'],
    deprecatedAt: '2026-11-10',
    shutdownDate: '2027-02-10',
    replacement: 'gpt-image-2.6-sunburst or gpt-image-2.6-flare',
    source: OPENAI_DEPRECATIONS,
    note: evidence(
      'Snapshot gpt-image-2-2026-04-21 is deprecated with gpt-image-2 and shuts down February 10, 2027. A snapshot row is updated only when that slug already exists.',
      [OPENAI_DEPRECATIONS],
    ),
  },
];

export const QWEN_PREVIEW_SLUG = 'qwen4-max-preview';
export const QWEN_PREVIEW_ALIASES = [QWEN_PREVIEW_SLUG, 'qwen4.0-max-preview'] as const;
export const QWEN_PREVIEW_SHUTDOWN = '2026-11-26';
export const QWEN_PREVIEW_NOTES = evidence(
  'Token Plan only; no official pay-as-you-go token price. Alias qwen4.0-max-preview; both IDs work and bills show qwen4.0-max-preview. Official help.aliyun.com Token Plan personal overview: preview from 2026-11-11 10:00 to 2026-11-25 24:00 (UTC+8), then taken offline. shutdown_date is the date-only column value 2026-11-26 (11-25 24:00 UTC+8). Credits as low as 20% (2折) during the preview; the overnight extra discount wording is not structured here (Token Plan personal plans are not seeded in this change).',
  [QWEN_TOKEN_PLAN],
);

const USAGE_EVIDENCE_KEYS = [
  'price', 'currency', 'unit', 'price_kind', 'source_url', 'last_verified',
  'is_available', 'constraints_json', 'plan_id',
] as const;

export const SEED_TABLES = ['providers', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants'] as const;
export type Table = (typeof SEED_TABLES)[number];

/**
 * Production-shaped dry-run when: providers elevenlabs, xai and qwen exist as
 * official/producer; existing rows are elevenlabs-scribe-v2 / v2-realtime,
 * mistral-medium-3.5, gemini-3.1-flash-lite, mistral-devstral-2512, gpt-image-2,
 * grok-imagine-video-1-5-agent and grok-imagine-video-720p; qwen4-max-preview,
 * the snapshot slug and the new ElevenLabs models are absent; Scribe usage
 * rows still hold the 2026-11-05 $0.22 / $0.39 hour rates; the 1.5-agent row
 * still has the three resolution usage rates and the 720p slug still has $0.07.
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 6, update: 8 },
  usage_prices: { insert: 9, update: 6 },
  api_channel_prices: { insert: 0, update: 0 },
  api_channel_price_variants: { insert: 0, update: 0 },
} as const;

export function catalog20261113AuditFixesSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-13-audit-fixes.ts [--dry-run | --apply]');
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

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}
export const day = (value: unknown) => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
};

export async function seedCatalog20261113AuditFixes(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = ['elevenlabs', 'xai', 'qwen'];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const provider = (slug: string, required = false) => one(providers.filter(row => row.slug === slug), `providers/${slug}`, required);
  const elevenlabs = provider('elevenlabs');
  const xai = provider('xai');
  const qwen = provider('qwen');
  for (const row of [elevenlabs, xai, qwen]) {
    if (row && !['official', 'producer'].includes(String(row.type))) fail(`providers/${String(row.slug)} has type ${String(row.type)}`);
  }

  const lookupSlugs = [...new Set([
    ...LIFECYCLE.flatMap(item => item.slugs),
    ...QWEN_PREVIEW_ALIASES,
    ...CATALOG_1113.map(item => item.slug!),
  ])];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(lookupSlugs)}`;
  const findBySlugs = (slugs: readonly string[], label: string) =>
    one(models.filter(row => slugs.includes(String(row.slug))), `models/${label}`);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if (table === 'usage_prices' && existing?.last_verified
      && new Date(String(existing.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      desired = { ...desired };
      for (const key of USAGE_EVIDENCE_KEYS) delete desired[key];
    }
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };
  const skip = (table: Table, target: string, reason: string) => {
    steps.push({ table, target, action: 'skip', changes: {}, reason });
  };

  for (const item of LIFECYCLE) {
    const row = findBySlugs(item.slugs, item.key);
    if (!row) {
      skip('models', item.key, `no row for ${item.slugs.join(' | ')}; not created`);
      continue;
    }
    const current = { ...row, deprecated_at: day(row.deprecated_at), shutdown_date: day(row.shutdown_date) };
    const desired: Record<string, unknown> = {
      replacement_model: item.replacement,
      deprecation_source_url: item.source,
      description: appendEvidence(row.description, item.note),
    };
    if (item.deprecatedAt) desired.deprecated_at = item.deprecatedAt;
    if (item.shutdownDate) desired.shutdown_date = item.shutdownDate;
    save('models', current, desired, String(row.slug));
  }

  const writeCatalogModel = async (item: AiCatalogItem, owner: Row | null) => {
    if (!owner) {
      skip('models', item.slug!, `providers/${item.providerSlug} missing; not created`);
      return;
    }
    const existing = findBySlugs([item.slug!], item.slug!);
    const model = existing
      ? save('models', existing, {
        provider_ids: [...new Set([...((existing.provider_ids as number[] | undefined) ?? []), owner.id])],
        pricing_unit: item.pricingUnit,
        ...(nonEmpty(existing.offical_link) ? {} : { offical_link: item.url }),
        description: nonEmpty(existing.description) ? appendEvidence(existing.description, verticalModelDescription(item)) : verticalModelDescription(item),
      }, item.slug!)
      : save('models', null, {
        slug: item.slug, name: item.name, type: voiceModelType(null),
        model_category: item.modelCategory, provider_ids: [owner.id],
        input_type: item.inputModalities, input_modalities: item.inputModalities,
        output_type: item.outputModalities, output_modalities: item.outputModalities,
        ...modelCapabilities(null, item.capabilities), pricing_unit: item.pricingUnit,
        offical_link: item.url, description: verticalModelDescription(item),
      }, item.slug!);

    const usage = (model.id > 0 && owner.id > 0)
      ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id} AND provider_id = ${owner.id}`
      : [];
    const owned = usage.filter(row => row.plan_id == null);
    const wanted = new Set((item.usageRates ?? []).map(rate => `${rate.priceKind}|${rate.unit}`));
    const claimed = new Set<number>();
    for (const rate of item.usageRates ?? []) {
      const exact = owned.filter(row => row.price_kind === rate.priceKind && row.unit === rate.unit && !claimed.has(Number(row.id)));
      const samePrice = item.kind === 'video-model'
        ? owned.filter(row => String(row.unit) === 'second' && Number(row.price) === rate.price && row.is_available !== false && !claimed.has(Number(row.id)))
        : [];
      const onlySecond = item.kind === 'video-model'
        ? owned.filter(row => String(row.unit) === 'second' && row.is_available !== false && !claimed.has(Number(row.id)))
        : [];
      const legacy = exact.length ? exact : samePrice.length ? samePrice : (onlySecond.length === 1 ? onlySecond : []);
      const current = one(legacy, `usage_prices/${item.slug}/${rate.priceKind}`);
      if (current) claimed.add(Number(current.id));
      save('usage_prices', current, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id, plan_id: null,
        price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: item.currency,
        source_url: item.sourceUrls![0].url, last_verified: VERIFIED_AT, is_available: true,
        constraints_json: { publishedPricingText: item.pricing, note: item.notes ?? null },
      }, current), `${item.slug}/${rate.priceKind}/${rate.unit}`);
    }
    if (item.kind === 'video-model') {
      for (const row of owned) {
        const key = `${row.price_kind}|${row.unit}`;
        if (claimed.has(Number(row.id)) || wanted.has(key)) continue;
        if (String(row.unit) === 'second' && row.is_available !== false) {
          save('usage_prices', row, retainLockedUnavailable({
            is_available: false,
            last_verified: VERIFIED_AT,
            source_url: item.sourceUrls![0].url,
            constraints_json: { note: 'Official 2026-11-13 pricing page no longer publishes resolution tiers; list price is the flat per-second rate.' },
          }, row), `${item.slug}/retired-${row.price_kind}`);
        }
      }
    }
  };

  for (const item of ELEVENLABS_1113) await writeCatalogModel(item, elevenlabs);
  for (const item of XAI_VIDEO_1113) await writeCatalogModel(item, xai);

  const previewClash = models.filter(row => row.slug === 'qwen4.0-max-preview');
  if (previewClash.length) fail(`Non-canonical qwen4.0-max-preview row exists; nothing written.`);
  const existingPreview = findBySlugs([QWEN_PREVIEW_SLUG], QWEN_PREVIEW_SLUG);
  if (!qwen) skip('models', QWEN_PREVIEW_SLUG, 'providers/qwen missing; not created');
  else if (existingPreview) {
    save('models', { ...existingPreview, shutdown_date: day(existingPreview.shutdown_date) }, {
      provider_ids: [...new Set([...((existingPreview.provider_ids as number[] | undefined) ?? []), qwen.id])],
      pricing_unit: 'subscription_only',
      shutdown_date: QWEN_PREVIEW_SHUTDOWN,
      offical_link: nonEmpty(existingPreview.offical_link) ? existingPreview.offical_link : QWEN_TOKEN_PLAN,
      description: appendEvidence(existingPreview.description, QWEN_PREVIEW_NOTES),
    }, QWEN_PREVIEW_SLUG);
  } else {
    save('models', null, {
      slug: QWEN_PREVIEW_SLUG, name: 'Qwen4 Max Preview', type: 'llm', model_category: 'text',
      provider_ids: [qwen.id], pricing_unit: 'subscription_only',
      shutdown_date: QWEN_PREVIEW_SHUTDOWN, offical_link: QWEN_TOKEN_PLAN,
      input_type: ['text', 'image'], input_modalities: ['text', 'image'],
      output_type: ['text'], output_modalities: ['text'],
      description: QWEN_PREVIEW_NOTES,
    }, QWEN_PREVIEW_SLUG);
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id']) if (key in payload) payload[key] = resolveId(payload[key]);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolveId);
      if (operation.existing) await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(operation.id, inserted.id);
      }
    }
  }
  return steps;
}
