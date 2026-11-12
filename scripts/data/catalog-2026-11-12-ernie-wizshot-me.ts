import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/**
 * Optional manual catalog seed for ERNIE-Wizshot-ME (文心一镜微表情大模型).
 * Never part of deploy or seed-catalog.sh. The CLI dry-run calls this with
 * apply=true inside runRehearsable, which rolls back. :apply is a separate
 * npm script. No deletes. Reuses providers.baidu; does not insert a second
 * Qianfan / baidu / baidu-global provider. No international USD price was
 * verified, so baidu-global is not written.
 *
 * A usage row whose last_verified is later than VERIFIED_AT keeps its price
 * and evidence.
 */

export const VERIFIED = '2026-11-12';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const BAIDU_PROVIDER = 'baidu';
export const MODEL_SLUG = 'ernie-wizshot-me';
export const MODEL_ID = 'ernie-wizshot-me';
export const MODEL_NAME = 'ERNIE-Wizshot-ME';
export const MODEL_NAME_ZH = '文心一镜微表情大模型';

/** Official 接入点 ID plus likely catalog aliases; production pages for all of these 404ed on 2026-11-12. */
export const LOOKUP_SLUGS = [
  MODEL_SLUG,
  'baidu-ernie-wizshot-me',
  'ernie-wizshot',
  'wizshot-me',
  'wenxin-wizshot-me',
  'baidu-wizshot-me',
  'baidu-ernie-wizshot',
] as const;

export const BILLING_PAGE = 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya';
export const MODEL_LIST_PAGE = 'https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j';
export const CREATE_API_PAGE = 'https://cloud.baidu.com/doc/qianfan-api/s/8mwbylac7';
export const QUERY_API_PAGE = 'https://cloud.baidu.com/doc/qianfan-api/s/Imwc2p4go';
export const PRODUCT_PAGE = 'https://cloud.baidu.com/product/qianfan.html';
export const CREATE_API_PATH = 'https://qianfan.baidubce.com/v2/mm/ernie/ernie-wizshot-me';

/** Official 价格说明 table: 模型名称 ERNIE-Wizshot-ME, 视频时长（秒） 1, 调用价格（元） 0.7. */
export const LIST_PRICE_CNY_PER_SECOND = 0.7;
export const PRICE_KIND = 'video_second';
export const PRICE_UNIT = 'second';
export const PRICING_UNIT = 'per_second';
export const CURRENCY = 'CNY';

export const ANNOUNCED_AT = new Date('2026-11-12T00:00:00Z');

/**
 * Production-shaped dry-run when providers.baidu already exists as official/producer,
 * and none of LOOKUP_SLUGS already exist as a models.slug (aiplans.dev probes on
 * 2026-11-12 returned 404 for these aliases). If a lookup slug already exists,
 * expect models 0 insert / 1 update (provider_ids only; slug is not rewritten)
 * plus usage_prices 1 insert.
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 1, update: 0 },
  usage_prices: { insert: 1, update: 0 },
  api_channel_prices: { insert: 0, update: 0 },
  api_channel_price_variants: { insert: 0, update: 0 },
} as const;

export const SEED_TABLES = [
  'providers', 'models', 'usage_prices', 'api_channel_prices', 'api_channel_price_variants',
] as const;
export type Table = (typeof SEED_TABLES)[number];

export const MODEL_FACTS = [
  `${MODEL_NAME}（${MODEL_NAME_ZH}）是百度千帆视频生成模型，官方 model 参数 / 接入点 ID 为 ${MODEL_ID}。`,
  `创建任务 API：POST ${CREATE_API_PATH}。输入为人物图、参考人声与台词等文本，输出为视频。`,
  `千帆刊例价：人民币 ${LIST_PRICE_CNY_PER_SECOND} 元 / 1 秒视频时长（调用价格，不是蒸汽机 Air 的积分定价）。官方价格说明页更新时间 2026-11-11。`,
  `官方创建任务文档将合成语音时长 + 静音时长限制为 4s ~ 16s（含边界）；产品页文案为产出 4–15s、1080p。计费表未写时长或分辨率档位。未核实国际站 USD 报价，不写入 baidu-global。`,
  `Verified ${VERIFIED}. Source: ${BILLING_PAGE} ; ${MODEL_LIST_PAGE} ; ${CREATE_API_PAGE} ; ${PRODUCT_PAGE}`,
].join('\n');

export const USAGE_CONSTRAINTS = {
  official_model_id: MODEL_ID,
  official_docs_updated: '2026-11-11',
  billing: { video_seconds: 1, price_cny: LIST_PRICE_CNY_PER_SECOND, unit: '元' },
  api_duration_seconds: { min: 4, max: 16, inclusive: true, source: CREATE_API_PAGE },
  product_page_duration_seconds: { min: 4, max: 15, source: PRODUCT_PAGE },
  product_page_resolution: '1080p',
} as const;

const USAGE_EVIDENCE_KEYS = [
  'price', 'currency', 'unit', 'price_kind', 'source_url', 'last_verified',
  'is_available', 'constraints_json', 'plan_id',
] as const;

export function catalog20261112ErnieWizshotMeSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-12-ernie-wizshot-me.ts [--dry-run | --apply]');
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

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export async function seedCatalog20261112ErnieWizshotMe(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${BAIDU_PROVIDER}`;
  const baidu = one(providers, `providers/${BAIDU_PROVIDER}`, true)!;
  if (!['official', 'producer'].includes(String(baidu.type))) {
    fail(`providers/${BAIDU_PROVIDER} has type ${String(baidu.type)}`);
  }

  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...LOOKUP_SLUGS])}`;
  const existing = one(models, `models/${LOOKUP_SLUGS.join('|')}`);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, current: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if (table === 'usage_prices' && current?.last_verified &&
        new Date(String(current.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      desired = { ...desired };
      for (const key of USAGE_EVIDENCE_KEYS) delete desired[key];
    }
    const changes = seedChanges(current, desired);
    if (!Object.keys(changes).length) return current!;
    const id = current?.id ?? previewId--;
    steps.push({ table, target, action: current ? 'update' : 'insert', changes });
    pending.push({ table, existing: current, values: desired, id });
    return { ...current, ...desired, id };
  };

  const ownerIds = [...new Set([
    ...((existing?.provider_ids as number[] | undefined) ?? []),
    baidu.id,
  ])];

  const model = existing
    ? save('models', existing, {
      provider_ids: ownerIds,
      pricing_unit: PRICING_UNIT,
      ...(nonEmpty(existing.offical_link) ? {} : { offical_link: BILLING_PAGE }),
      description: nonEmpty(existing.description) ? appendEvidence(existing.description, MODEL_FACTS) : MODEL_FACTS,
    }, String(existing.slug))
    : save('models', null, {
      slug: MODEL_SLUG,
      name: MODEL_NAME,
      type: 'multimodal',
      model_category: 'video',
      provider_ids: ownerIds,
      parameters: null,
      'active parameters': null,
      context_window: null,
      max_output_tokens: null,
      open_source: null,
      license: null,
      license_url: null,
      released_at: ANNOUNCED_AT,
      input_type: ['text', 'image', 'audio'],
      output_type: ['video'],
      input_modalities: ['text', 'image', 'audio'],
      output_modalities: ['video'],
      capabilities: ['video generation', 'character performance'],
      pricing_unit: PRICING_UNIT,
      offical_link: BILLING_PAGE,
      description: MODEL_FACTS,
    }, MODEL_SLUG);

  const usageRows = (model.id > 0 && baidu.id > 0)
    ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id} AND provider_id = ${baidu.id}`
    : [];
  const owned = usageRows.filter(row => row.plan_id == null);
  const exact = owned.filter(row => row.price_kind === PRICE_KIND && row.unit === PRICE_UNIT);
  const legacy = owned.filter(row =>
    (row.price_kind === PRICE_KIND || row.price_kind === 'video_output_tokens') &&
    (row.unit === PRICE_UNIT || row.unit === 'per_second'));
  const usage = one(exact.length ? exact : legacy, `usage_prices/${MODEL_SLUG}/${PRICE_KIND}`);
  save('usage_prices', usage, {
    model_id: model.id,
    provider_id: baidu.id,
    plan_id: null,
    price_kind: PRICE_KIND,
    unit: PRICE_UNIT,
    price: LIST_PRICE_CNY_PER_SECOND,
    currency: CURRENCY,
    is_available: true,
    source_url: BILLING_PAGE,
    last_verified: VERIFIED_AT,
    constraints_json: USAGE_CONSTRAINTS,
  }, `${MODEL_SLUG}/${PRICE_KIND}`);

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
