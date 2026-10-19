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
export interface P1Step { table: 'models' | 'api_channel_prices'; target: string; id: number | null; changes: Record<string, unknown> }

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
  return steps;
}
