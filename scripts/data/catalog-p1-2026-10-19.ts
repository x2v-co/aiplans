import type { Sql } from 'postgres';

export const CLAUDE_DEPRECATIONS = 'https://platform.claude.com/docs/en/about-claude/model-deprecations';
export const ZHIPU_GLOBAL_SOURCE = 'https://docs.z.ai/guides/overview/pricing';

/** Official API id is claude-sonnet-4-5-20250929. Both catalog slugs are that Sonnet 4.5 product. */
export const SONNET_45_SHUTDOWN = {
  shutdown_date: '2026-11-30',
  deprecated_at: '2026-09-30',
  replacement_model: 'claude-sonnet-5-5',
  deprecation_source_url: CLAUDE_DEPRECATIONS,
  slugs: ['claude-sonnet-4.5', 'anthropic-claude-sonnet-4-5'],
} as const;

export const SONNET_45_NOTE = '[shutdown] Official API id claude-sonnet-4-5-20250929 was deprecated 2026-09-30 and retires 2026-11-30 on Anthropic-operated platforms (Claude API, Claude Platform on AWS, Microsoft Foundry). Recommended replacement claude-sonnet-5-5. Amazon Bedrock and Google Cloud set their own dates and were not verified. Source: https://platform.claude.com/docs/en/about-claude/model-deprecations (verified 2026-10-19).';

export function withSonnetNote(description: string | null): string {
  const text = String(description ?? '');
  if (text.includes('[shutdown] Official API id claude-sonnet-4-5-20250929')) return text;
  return [text.trim(), SONNET_45_NOTE].filter(Boolean).join('\n');
}

/** Per 1M tokens on the Z.ai international price page, verified 2026-10-19. */
export const ZHIPU_GLOBAL_PRICES = [
  { slug: 'glm-5.3', input: 1.4, cached: 0.26, output: 4.4 },
  { slug: 'glm-5.2', input: 1.4, cached: 0.26, output: 4.4 },
  { slug: 'glm-5.3-flash', input: 0.15, cached: 0.03, output: 0.5 },
  { slug: 'glm-5.3-flashx', input: 0.37, cached: 0.075, output: 1.25 },
] as const;

export const ZHIPU_GLOBAL_NOTE = `Z.ai international list price, per 1M tokens. Cached-input storage is limited-time free and is not stored as a price. Source: ${ZHIPU_GLOBAL_SOURCE} (verified 2026-10-19).`;

export interface ZhipuModel { id: number; slug: string }
export interface ZhipuChannel {
  id: number;
  model_id: number;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  cached_input_price_per_1m: number | null;
  currency: string | null;
  notes: string | null;
}

export function planZhipuGlobalPrices(models: readonly ZhipuModel[], channels: readonly ZhipuChannel[]) {
  const missing: string[] = [];
  const inserts: Array<{ model_id: number; slug: string; input: number; cached: number; output: number }> = [];
  const updates: Array<{ id: number; slug: string; changes: Record<string, { from: unknown; to: unknown }> }> = [];
  for (const price of ZHIPU_GLOBAL_PRICES) {
    const matches = models.filter(model => model.slug === price.slug);
    if (matches.length > 1) throw new Error(`Duplicate model ${price.slug}; nothing written.`);
    if (matches.length === 0) {
      missing.push(price.slug);
      continue;
    }
    const rows = channels.filter(channel => channel.model_id === matches[0].id);
    if (rows.length > 1) throw new Error(`Duplicate zhipu-global channel for ${price.slug}; nothing written.`);
    if (rows.length === 0) {
      inserts.push({ model_id: matches[0].id, slug: price.slug, input: price.input, cached: price.cached, output: price.output });
      continue;
    }
    const row = rows[0];
    const desired = {
      input_price_per_1m: price.input,
      cached_input_price_per_1m: price.cached,
      output_price_per_1m: price.output,
      currency: 'USD',
      notes: ZHIPU_GLOBAL_NOTE,
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, to] of Object.entries(desired)) {
      const from = row[key as keyof ZhipuChannel];
      const same = typeof to === 'number' ? Number(from) === to : (from ?? null) === to;
      if (!same) changes[key] = { from: from ?? null, to };
    }
    if (Object.keys(changes).length) updates.push({ id: row.id, slug: price.slug, changes });
  }
  return { missing, inserts, updates };
}

export const QWEN_CN_SOURCE = 'https://help.aliyun.com/zh/model-studio/model-pricing';

/** 华北2（北京）and the matching「全球」deployment. US / 国际 prices are a different table. */
export const QWEN_CN_NOTE = `Bailian China list price (华北2 北京, same CNY bands on 全球 deployment), per 1M tokens. Displayed channel price is the ≤128K band. 128K–256K and 256K–1M are context_band variants. Thinking and non-thinking output match. US and 国际 deployment prices were not written. Batch half-price and context-cache discounts are rules, not stored amounts. Source: ${QWEN_CN_SOURCE} (verified 2026-10-19).`;

export interface QwenCnBand {
  key: string;
  name: string;
  input: number;
  output: number;
  headline: boolean;
  constraints: { prompt_tokens_lte: number; prompt_tokens_gt?: number };
}

export const QWEN_CN_MODELS: readonly { slug: string; bands: readonly QwenCnBand[] }[] = [
  {
    slug: 'qwen3.5-plus',
    bands: [
      { key: 'context-le-128k', name: '≤128K', input: 0.8, output: 4.8, headline: true, constraints: { prompt_tokens_lte: 128_000 } },
      { key: 'context-128k-256k', name: '128K–256K', input: 2, output: 12, headline: false, constraints: { prompt_tokens_gt: 128_000, prompt_tokens_lte: 256_000 } },
      { key: 'context-256k-1m', name: '256K–1M', input: 4, output: 24, headline: false, constraints: { prompt_tokens_gt: 256_000, prompt_tokens_lte: 1_000_000 } },
    ],
  },
  {
    slug: 'qwen3.5-flash',
    bands: [
      { key: 'context-le-128k', name: '≤128K', input: 0.2, output: 2, headline: true, constraints: { prompt_tokens_lte: 128_000 } },
      { key: 'context-128k-256k', name: '128K–256K', input: 0.8, output: 8, headline: false, constraints: { prompt_tokens_gt: 128_000, prompt_tokens_lte: 256_000 } },
      { key: 'context-256k-1m', name: '256K–1M', input: 1.2, output: 12, headline: false, constraints: { prompt_tokens_gt: 256_000, prompt_tokens_lte: 1_000_000 } },
    ],
  },
  {
    slug: 'qwen-flash',
    bands: [
      { key: 'context-le-128k', name: '≤128K', input: 0.15, output: 1.5, headline: true, constraints: { prompt_tokens_lte: 128_000 } },
      { key: 'context-128k-256k', name: '128K–256K', input: 0.6, output: 6, headline: false, constraints: { prompt_tokens_gt: 128_000, prompt_tokens_lte: 256_000 } },
      { key: 'context-256k-1m', name: '256K–1M', input: 1.2, output: 12, headline: false, constraints: { prompt_tokens_gt: 256_000, prompt_tokens_lte: 1_000_000 } },
    ],
  },
];

export function qwenHeadline(slug: string): QwenCnBand {
  const model = QWEN_CN_MODELS.find(item => item.slug === slug);
  const band = model?.bands.find(item => item.headline);
  if (!model || !band) throw new Error(`No Qwen headline for ${slug}`);
  return band;
}

export interface QwenCnModel { id: number; slug: string }
export interface QwenCnChannel {
  id: number;
  model_id: number;
  input_price_per_1m: number | string | null;
  output_price_per_1m: number | string | null;
  currency: string | null;
  price_unit: string | null;
  notes: string | null;
  is_available: boolean | null;
  availability_locked?: boolean | null;
}
export interface QwenCnVariant {
  id: number;
  model_id: number;
  variant_key: string;
  variant_name: string | null;
  variant_kind: string | null;
  input_price_per_1m: number | string | null;
  output_price_per_1m: number | string | null;
  currency: string | null;
  price_unit: string | null;
  is_headline: boolean | null;
  is_available: boolean | null;
  constraints_json: unknown;
  source_url: string | null;
  notes: string | null;
}
/**
 * A channel whose notes record the model as retired by the vendor (e.g. the
 * qwen-flash #14836 report) is not a live price. Do not reprice it or add bands.
 *
 * The scraper's own soft-retire marker ("retired <ts>: absent from successful
 * full-catalog Qwen scrape") is not a vendor retirement: index-dynamic writes
 * it when one run misses a model, and the next run that sees the model turns
 * the row back on but leaves the marker in notes. That marker is ignored here.
 */
export const RETIRED_NOTE = /\bretired\b|已(?:退役|下线)/i;
const SCRAPE_RETIRE_MARKER = /\|?\s*retired \S+: absent from successful full-catalog [^|]*/gi;
export function channelRetired(notes: string | null | undefined): boolean {
  return RETIRED_NOTE.test(String(notes ?? '').replace(SCRAPE_RETIRE_MARKER, ''));
}

export interface QwenCnPlan {
  missing: string[];
  disabled: string[];
  /** Channels whose notes say retired: no price/variant writes, only is_available → false. */
  retired: Array<{ id: number; slug: string; channelAvailable: boolean; variantIds: number[] }>;
  channelInserts: Array<{ model_id: number; slug: string; input: number; output: number }>;
  channelUpdates: Array<{ id: number; slug: string; changes: Record<string, { from: unknown; to: unknown }> }>;
  variantInserts: Array<{ model_id: number; slug: string; band: QwenCnBand }>;
  variantUpdates: Array<{ id: number; slug: string; key: string; changes: Record<string, { from: unknown; to: unknown }> }>;
}

function qwenNumberSame(from: unknown, to: number): boolean {
  const value = typeof from === 'number' ? from : typeof from === 'string' && from.trim() !== '' ? Number(from) : Number.NaN;
  return Number.isFinite(value) && Math.abs(value - to) < 1e-4;
}

function qwenJsonSame(from: unknown, to: unknown): boolean {
  const stable = (value: unknown): string => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]));
    }
    return JSON.stringify(value ?? null);
  };
  return stable(from) === stable(to);
}

/** Plans the qwen provider's China headline and context bands. Missing slugs are skipped. */
export function planQwenCnPrices(
  models: readonly QwenCnModel[],
  channels: readonly QwenCnChannel[],
  variants: readonly QwenCnVariant[],
): QwenCnPlan {
  const missing: string[] = [];
  const disabled: string[] = [];
  const retired: QwenCnPlan['retired'] = [];
  const channelInserts: QwenCnPlan['channelInserts'] = [];
  const channelUpdates: QwenCnPlan['channelUpdates'] = [];
  const variantInserts: QwenCnPlan['variantInserts'] = [];
  const variantUpdates: QwenCnPlan['variantUpdates'] = [];
  for (const spec of QWEN_CN_MODELS) {
    const matches = models.filter(model => model.slug === spec.slug);
    if (matches.length > 1) throw new Error(`Duplicate model ${spec.slug}; nothing written.`);
    if (matches.length === 0) {
      missing.push(spec.slug);
      continue;
    }
    const model = matches[0];
    const rows = channels.filter(channel => channel.model_id === model.id);
    if (rows.length > 1) throw new Error(`Duplicate qwen channel for ${spec.slug}; nothing written.`);
    const headline = spec.bands.find(band => band.headline)!;
    if (rows.length === 0) {
      channelInserts.push({ model_id: model.id, slug: spec.slug, input: headline.input, output: headline.output });
    } else if (channelRetired(rows[0].notes)) {
      // Retired wins over the price list: skip repricing and the bands, and
      // switch the channel (and any existing variants) off. Never turns one on.
      const variantIds = variants
        .filter(variant => variant.model_id === model.id && variant.is_available !== false)
        .map(variant => variant.id);
      const unlocked = rows[0].is_available !== false || rows[0].availability_locked !== true;
      if (unlocked || variantIds.length) retired.push({ id: rows[0].id, slug: spec.slug, channelAvailable: rows[0].is_available !== false, variantIds });
      else disabled.push(spec.slug);
      continue;
    } else if (rows[0].is_available === false) {
      disabled.push(spec.slug);
      continue;
    } else {
      const row = rows[0];
      const desired = {
        input_price_per_1m: headline.input,
        output_price_per_1m: headline.output,
        currency: 'CNY',
        price_unit: 'per_1m_tokens',
        notes: QWEN_CN_NOTE,
      };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, to] of Object.entries(desired)) {
        const from = row[key as keyof QwenCnChannel];
        const same = typeof to === 'number' ? qwenNumberSame(from, to) : (from ?? null) === to;
        if (!same) changes[key] = { from: from ?? null, to };
      }
      if (Object.keys(changes).length) channelUpdates.push({ id: row.id, slug: spec.slug, changes });
    }
    const owned = variants.filter(variant => variant.model_id === model.id);
    for (const band of spec.bands) {
      const found = owned.filter(variant => variant.variant_key === band.key);
      if (found.length > 1) throw new Error(`Duplicate qwen variant ${spec.slug}/${band.key}; nothing written.`);
      if (found.length === 0) {
        variantInserts.push({ model_id: model.id, slug: spec.slug, band });
        continue;
      }
      const row = found[0];
      const desired = {
        variant_name: band.name,
        variant_kind: 'context_band',
        input_price_per_1m: band.input,
        output_price_per_1m: band.output,
        currency: 'CNY',
        price_unit: 'per_1m_tokens',
        is_headline: band.headline,
        is_available: true,
        constraints_json: band.constraints,
        source_url: QWEN_CN_SOURCE,
        notes: QWEN_CN_NOTE,
      };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, to] of Object.entries(desired)) {
        const from = row[key as keyof QwenCnVariant];
        const same = typeof to === 'number'
          ? qwenNumberSame(from, to)
          : typeof to === 'boolean'
            ? from === to
            : key === 'constraints_json'
              ? qwenJsonSame(from, to)
              : (from ?? null) === to;
        if (!same) changes[key] = { from: from ?? null, to };
      }
      if (Object.keys(changes).length) variantUpdates.push({ id: row.id, slug: spec.slug, key: band.key, changes });
    }
    for (const extra of owned.filter(variant => variant.is_headline === true && !spec.bands.some(band => band.key === variant.variant_key && band.headline))) {
      if (spec.bands.some(band => band.key === extra.variant_key)) continue;
      variantUpdates.push({
        id: extra.id,
        slug: spec.slug,
        key: extra.variant_key,
        changes: { is_headline: { from: true, to: false } },
      });
    }
  }
  return { missing, disabled, retired, channelInserts, channelUpdates, variantInserts, variantUpdates };
}

export function catalogP1SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-p1-2026-10-19.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type ModelRow = {
  id: number;
  slug: string;
  shutdown_date: string | null;
  deprecated_at: string | null;
  replacement_model: string | null;
  deprecation_source_url: string | null;
  description: string | null;
};
export interface P1Step { table: 'models' | 'api_channel_prices' | 'api_channel_price_variants'; target: string; id: number | null; changes: Record<string, unknown> }

/** Caller owns a serializable transaction. Missing model slugs are skipped. Duplicate rows abort. */
export async function seedCatalogP1(tx: Sql, apply = false): Promise<P1Step[]> {
  const steps: P1Step[] = [];
  const sonnet = await tx<ModelRow[]>`
    SELECT id, slug, shutdown_date::text, deprecated_at::text, replacement_model, deprecation_source_url, description
    FROM models WHERE slug IN ${tx([...SONNET_45_SHUTDOWN.slugs])}`;
  for (const slug of SONNET_45_SHUTDOWN.slugs) {
    const matches = sonnet.filter(row => row.slug === slug);
    if (matches.length > 1) throw new Error(`Duplicate ${slug}; nothing written.`);
    const row = matches[0];
    if (!row) continue;
    const description = withSonnetNote(row.description);
    const desired = {
      shutdown_date: SONNET_45_SHUTDOWN.shutdown_date,
      deprecated_at: SONNET_45_SHUTDOWN.deprecated_at,
      replacement_model: SONNET_45_SHUTDOWN.replacement_model,
      deprecation_source_url: SONNET_45_SHUTDOWN.deprecation_source_url,
      description,
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, to] of Object.entries(desired)) {
      const from = row[key as keyof ModelRow] ?? null;
      if (from !== to) changes[key] = { from, to };
    }
    if (!Object.keys(changes).length) continue;
    if (apply) {
      await tx`UPDATE models SET shutdown_date = ${desired.shutdown_date}::date, deprecated_at = ${desired.deprecated_at}::date,
        replacement_model = ${desired.replacement_model}, deprecation_source_url = ${desired.deprecation_source_url},
        description = ${desired.description}, updated_at = ${new Date()} WHERE id = ${row.id}`;
    }
    steps.push({ table: 'models', target: slug, id: row.id, changes });
  }

  const providers = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = 'zhipu-global'`;
  if (providers.length !== 1) throw new Error(`Expected exactly one zhipu-global provider, found ${providers.length}; nothing written.`);
  const slugs = ZHIPU_GLOBAL_PRICES.map(price => price.slug);
  const models = await tx<ZhipuModel[]>`SELECT id, slug FROM models WHERE slug IN ${tx([...slugs])}`;
  const modelIds = models.map(model => model.id);
  const channels = modelIds.length
    ? await tx<ZhipuChannel[]>`
        SELECT id, model_id, input_price_per_1m, output_price_per_1m, cached_input_price_per_1m, currency, notes
        FROM api_channel_prices WHERE provider_id = ${providers[0].id} AND model_id IN ${tx(modelIds)}`
    : [];
  const plan = planZhipuGlobalPrices(models, channels);
  const verified = new Date('2026-10-19T00:00:00Z');
  for (const row of plan.inserts) {
    if (apply) {
      const inserted = await tx<Array<{ id: number }>>`
        INSERT INTO api_channel_prices (model_id, provider_id, input_price_per_1m, output_price_per_1m, cached_input_price_per_1m,
          currency, price_unit, is_available, last_verified, notes, updated_at)
        VALUES (${row.model_id}, ${providers[0].id}, ${row.input}, ${row.output}, ${row.cached},
          'USD', 'per_1m_tokens', true, ${verified}, ${ZHIPU_GLOBAL_NOTE}, ${new Date()})
        RETURNING id`;
      steps.push({ table: 'api_channel_prices', target: `zhipu-global/${row.slug}`, id: inserted[0]?.id ?? null, changes: { insert: row } });
    } else {
      steps.push({ table: 'api_channel_prices', target: `zhipu-global/${row.slug}`, id: null, changes: { insert: row } });
    }
  }
  for (const row of plan.updates) {
    const price = ZHIPU_GLOBAL_PRICES.find(item => item.slug === row.slug)!;
    if (apply) {
      await tx`UPDATE api_channel_prices SET input_price_per_1m = ${price.input}, output_price_per_1m = ${price.output},
        cached_input_price_per_1m = ${price.cached}, currency = 'USD', price_unit = 'per_1m_tokens',
        notes = ${ZHIPU_GLOBAL_NOTE}, last_verified = ${verified}, updated_at = ${new Date()} WHERE id = ${row.id}`;
    }
    steps.push({ table: 'api_channel_prices', target: `zhipu-global/${row.slug}`, id: row.id, changes: row.changes });
  }
  for (const slug of plan.missing) {
    steps.push({ table: 'models', target: slug, id: null, changes: { skipped: 'model slug is not in the catalog; price was not invented onto a new row' } });
  }

  const qwenProviders = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = 'qwen'`;
  if (qwenProviders.length !== 1) throw new Error(`Expected exactly one qwen provider, found ${qwenProviders.length}; nothing written.`);
  const qwenSlugs = QWEN_CN_MODELS.map(item => item.slug);
  const qwenModels = await tx<QwenCnModel[]>`SELECT id, slug FROM models WHERE slug IN ${tx([...qwenSlugs])}`;
  const qwenIds = qwenModels.map(model => model.id);
  const qwenChannels = qwenIds.length
    ? await tx<QwenCnChannel[]>`
        SELECT id, model_id, input_price_per_1m, output_price_per_1m, currency, price_unit, notes, is_available, availability_locked
        FROM api_channel_prices WHERE provider_id = ${qwenProviders[0].id} AND model_id IN ${tx(qwenIds)}`
    : [];
  const qwenVariants = qwenIds.length
    ? await tx<QwenCnVariant[]>`
        SELECT id, model_id, variant_key, variant_name, variant_kind, input_price_per_1m, output_price_per_1m,
          currency, price_unit, is_headline, is_available, constraints_json, source_url, notes
        FROM api_channel_price_variants WHERE provider_id = ${qwenProviders[0].id} AND model_id IN ${tx(qwenIds)}`
    : [];
  const qwenPlan = planQwenCnPrices(qwenModels, qwenChannels, qwenVariants);
  const qwenProviderId = qwenProviders[0].id;
  for (const row of qwenPlan.channelInserts) {
    if (apply) {
      const inserted = await tx<Array<{ id: number }>>`
        INSERT INTO api_channel_prices (model_id, provider_id, input_price_per_1m, output_price_per_1m,
          currency, price_unit, is_available, last_verified, notes, updated_at)
        VALUES (${row.model_id}, ${qwenProviderId}, ${row.input}, ${row.output},
          'CNY', 'per_1m_tokens', true, ${verified}, ${QWEN_CN_NOTE}, ${new Date()})
        RETURNING id`;
      steps.push({ table: 'api_channel_prices', target: `qwen/${row.slug}`, id: inserted[0]?.id ?? null, changes: { insert: row } });
    } else {
      steps.push({ table: 'api_channel_prices', target: `qwen/${row.slug}`, id: null, changes: { insert: row } });
    }
  }
  for (const row of qwenPlan.channelUpdates) {
    const headline = qwenHeadline(row.slug);
    if (apply) {
      await tx`UPDATE api_channel_prices SET input_price_per_1m = ${headline.input}, output_price_per_1m = ${headline.output},
        currency = 'CNY', price_unit = 'per_1m_tokens', notes = ${QWEN_CN_NOTE}, last_verified = ${verified}, updated_at = ${new Date()}
        WHERE id = ${row.id}`;
    }
    steps.push({ table: 'api_channel_prices', target: `qwen/${row.slug}`, id: row.id, changes: row.changes });
  }
  for (const row of qwenPlan.variantInserts) {
    const band = row.band;
    if (apply) {
      const inserted = await tx<Array<{ id: number }>>`
        INSERT INTO api_channel_price_variants (model_id, provider_id, variant_key, variant_name, variant_kind,
          input_price_per_1m, output_price_per_1m, currency, price_unit, is_available, is_public, is_headline,
          constraints_json, source_url, notes, last_verified, updated_at)
        VALUES (${row.model_id}, ${qwenProviderId}, ${band.key}, ${band.name}, 'context_band',
          ${band.input}, ${band.output}, 'CNY', 'per_1m_tokens', true, true, ${band.headline},
          ${tx.json(band.constraints)}, ${QWEN_CN_SOURCE}, ${QWEN_CN_NOTE}, ${verified}, ${new Date()})
        RETURNING id`;
      steps.push({ table: 'api_channel_price_variants', target: `qwen/${row.slug}#${band.key}`, id: inserted[0]?.id ?? null, changes: { insert: band } });
    } else {
      steps.push({ table: 'api_channel_price_variants', target: `qwen/${row.slug}#${band.key}`, id: null, changes: { insert: band } });
    }
  }
  for (const row of qwenPlan.variantUpdates) {
    const band = QWEN_CN_MODELS.find(item => item.slug === row.slug)?.bands.find(item => item.key === row.key);
    if (apply && band) {
      await tx`UPDATE api_channel_price_variants SET variant_name = ${band.name}, variant_kind = 'context_band',
        input_price_per_1m = ${band.input}, output_price_per_1m = ${band.output}, currency = 'CNY', price_unit = 'per_1m_tokens',
        is_headline = ${band.headline}, is_available = true, constraints_json = ${tx.json(band.constraints)},
        source_url = ${QWEN_CN_SOURCE}, notes = ${QWEN_CN_NOTE}, last_verified = ${verified}, updated_at = ${new Date()}
        WHERE id = ${row.id}`;
    } else if (apply) {
      await tx`UPDATE api_channel_price_variants SET is_headline = false, updated_at = ${new Date()} WHERE id = ${row.id}`;
    }
    steps.push({ table: 'api_channel_price_variants', target: `qwen/${row.slug}#${row.key}`, id: row.id, changes: row.changes });
  }
  for (const slug of qwenPlan.missing) {
    steps.push({ table: 'models', target: slug, id: null, changes: { skipped: 'model slug is not in the catalog; Qwen China price was not invented onto a new row' } });
  }
  for (const row of qwenPlan.retired) {
    if (apply) {
      await tx`UPDATE api_channel_prices SET is_available = false, availability_locked = true, updated_at = ${new Date()}
        WHERE id = ${row.id}`;
      if (row.variantIds.length) {
        await tx`UPDATE api_channel_price_variants SET is_available = false, availability_locked = true, updated_at = ${new Date()}
          WHERE id IN ${tx(row.variantIds)}`;
      }
    }
    steps.push({
      table: 'api_channel_prices',
      target: `qwen/${row.slug}`,
      id: row.id,
      changes: {
        ...(row.channelAvailable ? { is_available: { from: true, to: false } } : {}),
        availability_locked: true,
        ...(row.variantIds.length ? { variants_disabled: row.variantIds } : {}),
        skipped: 'notes say retired; price and context-band variants were not written',
      },
    });
  }
  for (const slug of qwenPlan.disabled) {
    steps.push({ table: 'api_channel_prices', target: `qwen/${slug}`, id: null, changes: { skipped: 'qwen channel is disabled; headline and variants were not written' } });
  }
  return steps;
}
