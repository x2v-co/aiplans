import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { hasScrapeAbsenceNote, retainLockedUnavailable, stripScrapeAbsenceNote } from '../utils/manual-unavailable';

/**
 * Intel 2026-11-11 P0/P1 corrections. Optional manual seed, never part of deploy
 * or seed-catalog.sh. The CLI dry-run calls this with apply=true inside
 * runRehearsable, which rolls back. :apply is a separate npm script. No deletes.
 * Missing model rows are skipped. A channel verified after 2026-11-11 is left alone.
 *
 * P1-6 (xAI video resolution prices) is not seeded: the official pricing page and
 * the grok-imagine-video-1.5 model page still publish resolution tiers
 * (1.5: 480p $0.08 / 720p $0.14 / 1080p $0.25 per second; 1.5-lite: $0.02 / $0.03 /
 * $0.14; grok-imagine-video: 480p $0.05 / 720p $0.07). Those match the catalog.
 */
export const VERIFIED = '2026-11-11';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);

export const OPENAI_DEPRECATIONS = 'https://platform.openai.com/docs/deprecations';
export const OPENAI_PRICING = 'https://developers.openai.com/api/docs/pricing';
export const MISTRAL_MODELS = 'https://docs.mistral.ai/models';
export const GEMINI_DEPRECATIONS = 'https://ai.google.dev/gemini-api/docs/deprecations';
export const GEMINI_PRICING = 'https://ai.google.dev/gemini-api/docs/pricing';
export const QWEN_PRICING = 'https://help.aliyun.com/zh/model-studio/model-pricing';
export const DEEPSEEK_UPDATES = 'https://api-docs.deepseek.com/updates';
export const DEEPSEEK_PRICING = 'https://api-docs.deepseek.com/quick_start/pricing';
export const OPENROUTER_MODELS = 'https://openrouter.ai/api/v1/models';

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;

export interface LifecycleFix {
  key: string;
  slugs: readonly string[];
  deprecatedAt?: string;
  /** Set only when the official page publishes a removal date. Routing-without-shutdown leaves this unset. */
  shutdownDate?: string;
  replacement: string;
  source: string;
  note: string;
}

export const LIFECYCLE: readonly LifecycleFix[] = [
  {
    key: 'gpt-image-2',
    slugs: ['gpt-image-2'],
    deprecatedAt: '2026-11-10',
    shutdownDate: '2027-02-10',
    replacement: 'gpt-image-2.6-sunburst or gpt-image-2.6-flare',
    source: OPENAI_DEPRECATIONS,
    note: evidence(
      'OpenAI deprecations entry "2026-11-10: GPT Image 2": gpt-image-2 and snapshot gpt-image-2-2026-04-21 are deprecated and will be removed from the API on February 10, 2027. Recommended replacement gpt-image-2.6-sunburst or gpt-image-2.6-flare. A separate snapshot row is updated only when that slug already exists.',
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
      'Snapshot gpt-image-2-2026-04-21 is deprecated with gpt-image-2 and shuts down on February 10, 2027. Replacement gpt-image-2.6-sunburst or gpt-image-2.6-flare.',
      [OPENAI_DEPRECATIONS],
    ),
  },
  {
    key: 'mistral-medium-3.5',
    slugs: ['mistral-medium-3.5', 'mistral-medium-3-5'],
    deprecatedAt: '2026-10-31',
    shutdownDate: '2027-04-30',
    replacement: 'mistral-large-4',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Mistral Medium 3.5, version 26.04, API mistral-medium-3-5, deprecation 10/31/2026, retirement 4/30/2027, alternative Mistral Large 4. OpenRouter still listed mistralai/mistral-medium-3-5 at $1.50 / $7.50 per 1M tokens on 2026-11-11.',
      [MISTRAL_MODELS, OPENROUTER_MODELS],
    ),
  },
  {
    key: 'gemini-3.1-flash-lite',
    slugs: ['gemini-3.1-flash-lite'],
    shutdownDate: '2027-05-07',
    replacement: 'gemini-3.5-flash-lite',
    source: GEMINI_DEPRECATIONS,
    note: evidence(
      'Gemini deprecations table row gemini-3.1-flash-lite: release date May 7, 2026, shutdown date May 7, 2027, recommended replacement gemini-3.5-flash-lite. The page says shutdown dates in the table are the earliest possible dates a model might be retired, and that Google will communicate the exact shutdown date with advance notice. No separate deprecation-announcement date is published, so deprecated_at is left unset. The May 7, 2026 column is the release date.',
      [GEMINI_DEPRECATIONS],
    ),
  },
  {
    key: 'deepseek-v4-flash',
    slugs: ['deepseek-v4-flash'],
    deprecatedAt: '2026-09-10',
    replacement: 'deepseek-v4.1-flash',
    source: DEEPSEEK_UPDATES,
    note: evidence(
      'DeepSeek changelog 2026-09-10: previous-generation V4 Flash and V4 Flash Vision Exp have been retired. The names deepseek-v4-flash and deepseek-v4-flash-vision-exp are temporarily routed to V4.1 Flash (API id deepseek-flash, catalog slug deepseek-v4.1-flash) and billed at the Flash price. The pricing-page footnote repeats that those legacy names are still accepted and served by DeepSeek-V4.1-Flash-1017. shutdown_date is not written: the name is still accepted, and a past shutdown date would lock every channel off on the next scrape.',
      [DEEPSEEK_UPDATES, DEEPSEEK_PRICING],
    ),
  },
  {
    key: 'deepseek-v4-flash-vision',
    slugs: ['deepseek-v4-flash-vision-exp', 'deepseek-deepseek-v4-flash-vision-exp'],
    deprecatedAt: '2026-09-10',
    replacement: 'deepseek-v4.1-flash',
    source: DEEPSEEK_UPDATES,
    note: evidence(
      'Same 2026-09-10 retirement as deepseek-v4-flash. deepseek-v4-flash-vision-exp is temporarily routed to V4.1 Flash (deepseek-flash) and billed at the Flash price. The endpoint name is still accepted, so shutdown_date is not written.',
      [DEEPSEEK_UPDATES, DEEPSEEK_PRICING],
    ),
  },
  {
    key: 'gemini-3.5-flash',
    slugs: ['gemini-3.5-flash', 'google-gemini-gemini-3-5-flash-batch'],
    replacement: 'gemini-3.6-flash',
    source: GEMINI_DEPRECATIONS,
    note: evidence(
      'Gemini deprecations table: gemini-3.5-flash release date May 19, 2026, shutdown column N/A. It is no longer available in Google AI Studio; the endpoint is not shutting down and automatically routes API requests to gemini-3.6-flash. No deprecation-announcement date is published (May 19, 2026 is the release date), so deprecated_at is left unset. shutdown_date is not written.',
      [GEMINI_DEPRECATIONS, GEMINI_PRICING],
    ),
  },
  {
    key: 'gemini-3.7-flash',
    slugs: ['gemini-3.7-flash', 'google-gemini-gemini-3-7-flash-batch'],
    replacement: 'gemini-3.8-flash',
    source: GEMINI_DEPRECATIONS,
    note: evidence(
      'Gemini deprecations table: gemini-3.7-flash release date August 13, 2026, shutdown column N/A. It is no longer available in Google AI Studio; the endpoint is not shutting down and automatically routes API requests to gemini-3.8-flash. No deprecation-announcement date is published, so deprecated_at is left unset. shutdown_date is not written.',
      [GEMINI_DEPRECATIONS, GEMINI_PRICING],
    ),
  },
  {
    key: 'mistral-medium-3',
    slugs: ['mistral-medium-3', 'mistral-medium-2505', 'mistral-mistral-medium-3', 'mistral-mistral-medium-2505'],
    deprecatedAt: '2026-05-22',
    shutdownDate: '2026-08-31',
    replacement: 'mistral-medium-3.5',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Mistral Medium 3, version 25.05, API mistral-medium-2505, deprecation 5/22/2026, retirement 8/31/2026, alternative Mistral Medium 3.5. Medium 3.5 itself is deprecated 2026-10-31 with retirement 2027-04-30 and alternative Mistral Large 4; the table still names Medium 3.5 as this row\'s alternative. OpenRouter /api/v1/models on 2026-11-11 still lists mistralai/mistral-medium-3 at prompt 0.0000004 / completion 0.000002 per token ($0.40 / $2.00 per 1M).',
      [MISTRAL_MODELS, OPENROUTER_MODELS],
    ),
  },
  {
    key: 'mistral-medium-3.1',
    slugs: ['mistral-medium-3.1', 'mistral-medium-2508', 'mistral-mistral-medium-3.1', 'mistral-mistral-medium-2508'],
    deprecatedAt: '2026-05-22',
    shutdownDate: '2026-08-31',
    replacement: 'mistral-medium-3.5',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Mistral Medium 3.1, version 25.08, API mistral-medium-2508, deprecation 5/22/2026, retirement 8/31/2026, alternative Mistral Medium 3.5 (itself later deprecated toward Mistral Large 4). OpenRouter on 2026-11-11 still lists mistralai/mistral-medium-3.1 at $0.40 / $2.00 per 1M tokens.',
      [MISTRAL_MODELS, OPENROUTER_MODELS],
    ),
  },
  {
    key: 'devstral-2',
    slugs: ['devstral-2', 'devstral-2512', 'mistral-devstral-2512'],
    deprecatedAt: '2026-05-22',
    shutdownDate: '2026-07-31',
    replacement: 'mistral-medium-3.5',
    source: MISTRAL_MODELS,
    note: evidence(
      'Mistral deprecated-and-retired table: Devstral 2, version 25.12, API devstral-2512, deprecation 5/22/2026, retirement 7/31/2026, alternative Mistral Medium 3.5 (itself later deprecated toward Mistral Large 4). OpenRouter on 2026-11-11 still lists mistralai/devstral-2512 at prompt 0.0000004 / completion 0.000002 per token ($0.40 / $2.00 per 1M), context_length 262144.',
      [MISTRAL_MODELS, OPENROUTER_MODELS],
    ),
  },
];

export interface ContextBand {
  key: string;
  name: string;
  input: number;
  output: number;
  cached?: number;
  headline: boolean;
  constraints: Record<string, number>;
}

const le = (tokens: number, extra: Record<string, number> = {}): Record<string, number> => ({ prompt_tokens_lte: tokens, ...extra });
const between = (gt: number, lte: number, extra: Record<string, number> = {}): Record<string, number> => ({
  prompt_tokens_gt: gt, prompt_tokens_lte: lte, ...extra,
});

/** Official Bailian China (华北2 / 全球 CNY) context bands, per 1M tokens. Headline is the first band. */
export const QWEN_TIERS: readonly { slug: string; bands: readonly ContextBand[] }[] = [
  {
    slug: 'qwen3.7-flash',
    bands: [
      { key: 'context-le-32k', name: '≤32K', input: 0.2, output: 0.8, headline: true, constraints: le(32_000) },
      { key: 'context-32k-256k', name: '32K–256K', input: 0.6, output: 2.4, headline: false, constraints: between(32_000, 256_000) },
      { key: 'context-256k-1m', name: '256K–1M', input: 1.2, output: 4.8, headline: false, constraints: between(256_000, 1_000_000) },
    ],
  },
  {
    slug: 'qwen3.6-flash',
    bands: [
      { key: 'context-le-256k', name: '≤256K', input: 1.2, output: 7.2, headline: true, constraints: le(256_000) },
      { key: 'context-256k-1m', name: '256K–1M', input: 4.8, output: 28.8, headline: false, constraints: between(256_000, 1_000_000) },
    ],
  },
  {
    slug: 'qwen3.6-plus',
    bands: [
      { key: 'context-le-256k', name: '≤256K', input: 2, output: 12, headline: true, constraints: le(256_000) },
      { key: 'context-256k-1m', name: '256K–1M', input: 8, output: 48, headline: false, constraints: between(256_000, 1_000_000) },
    ],
  },
  {
    slug: 'qwen-plus',
    // Output column is 非思考. 思考模式 is thinking_output_price_per_1m (8 / 24 / 64).
    bands: [
      { key: 'context-le-128k', name: '≤128K', input: 0.8, output: 2, headline: true, constraints: le(128_000, { thinking_output_price_per_1m: 8 }) },
      { key: 'context-128k-256k', name: '128K–256K', input: 2.4, output: 20, headline: false, constraints: between(128_000, 256_000, { thinking_output_price_per_1m: 24 }) },
      { key: 'context-256k-1m', name: '256K–1M', input: 4.8, output: 48, headline: false, constraints: between(256_000, 1_000_000, { thinking_output_price_per_1m: 64 }) },
    ],
  },
  {
    slug: 'qwen3.5-397b-a17b',
    bands: [
      { key: 'context-le-128k', name: '≤128K', input: 1.2, output: 7.2, headline: true, constraints: le(128_000) },
      { key: 'context-128k-256k', name: '128K–256K', input: 3, output: 18, headline: false, constraints: between(128_000, 256_000) },
    ],
  },
  {
    slug: 'qwen3-coder-flash',
    bands: [
      { key: 'context-le-32k', name: '≤32K', input: 1, output: 4, headline: true, constraints: le(32_000) },
      { key: 'context-32k-128k', name: '32K–128K', input: 1.5, output: 6, headline: false, constraints: between(32_000, 128_000) },
      { key: 'context-128k-256k', name: '128K–256K', input: 2.5, output: 10, headline: false, constraints: between(128_000, 256_000) },
      { key: 'context-256k-1m', name: '256K–1M', input: 5, output: 25, headline: false, constraints: between(256_000, 1_000_000) },
    ],
  },
  {
    slug: 'qwen3-vl-plus',
    bands: [
      { key: 'context-le-32k', name: '≤32K', input: 1, output: 10, headline: true, constraints: le(32_000) },
      { key: 'context-32k-128k', name: '32K–128K', input: 1.5, output: 15, headline: false, constraints: between(32_000, 128_000) },
      { key: 'context-128k-256k', name: '128K–256K', input: 3, output: 30, headline: false, constraints: between(128_000, 256_000) },
    ],
  },
];

/** Still on the Bailian price page. Flat (无阶梯) or the qwen-plus headline above. */
export const QWEN_STILL_SOLD = [
  { slug: 'qwen-max', input: 2.4, output: 9.6, note: 'qwen-max, 仅非思考模式, 无阶梯计价, input ¥2.4 / output ¥9.6 per 1M tokens.' },
  { slug: 'qwen-long', input: 0.5, output: 2, note: 'qwen-long input ¥0.5 / output ¥2 per 1M tokens. No context ladder on the price page.' },
  { slug: 'qwen-vl-ocr', input: 0.3, output: 0.5, note: 'qwen-vl-ocr (当前能力等同于 qwen-vl-ocr-2025-11-20) input ¥0.3 / output ¥0.5 per 1M tokens.' },
] as const;

export const GEMINI_TIERS: readonly { slugs: readonly string[]; bands: readonly ContextBand[] }[] = [
  {
    slugs: ['gemini-3.1-pro', 'gemini-3.1-pro-preview'],
    bands: [
      { key: 'context-le-200k', name: '≤200K prompts', input: 2, output: 12, cached: 0.2, headline: true, constraints: le(200_000) },
      { key: 'context-gt-200k', name: '>200K prompts', input: 4, output: 18, cached: 0.4, headline: false, constraints: { prompt_tokens_gt: 200_000 } },
    ],
  },
  {
    slugs: ['gemini-2.5-pro'],
    bands: [
      { key: 'context-le-200k', name: '≤200K prompts', input: 1.25, output: 10, cached: 0.125, headline: true, constraints: le(200_000) },
      { key: 'context-gt-200k', name: '>200K prompts', input: 2.5, output: 15, cached: 0.25, headline: false, constraints: { prompt_tokens_gt: 200_000 } },
    ],
  },
];

/** Standard speed, same >272K split already stored for gpt-6.1-terra. Long rates are the pricing page's long-context map. */
export const OPENAI_LONG_CONTEXT: readonly { slugs: readonly string[]; short: ContextBand; long: ContextBand }[] = [
  {
    slugs: ['gpt-6-astra', 'openai-gpt-6-astra'],
    short: { key: 'standard', name: 'Short context (≤272K input tokens)', input: 10, output: 50, cached: 1, headline: true, constraints: { max_input_tokens: 272_000 } },
    long: { key: 'long-context', name: 'Long context (>272K input tokens)', input: 20, output: 75, cached: 2, headline: false, constraints: { min_input_tokens_exclusive: 272_000 } },
  },
  {
    slugs: ['gpt-6.1-sol', 'openai-gpt-6-1-sol'],
    short: { key: 'standard', name: 'Short context (≤272K input tokens)', input: 2, output: 10, cached: 0.1, headline: true, constraints: { max_input_tokens: 272_000 } },
    long: { key: 'long-context', name: 'Long context (>272K input tokens)', input: 4, output: 15, cached: 0.2, headline: false, constraints: { min_input_tokens_exclusive: 272_000 } },
  },
  {
    slugs: ['gpt-6-luna', 'openai-gpt-6-luna'],
    short: { key: 'standard', name: 'Short context (≤272K input tokens)', input: 0.1, output: 0.5, cached: 0.01, headline: true, constraints: { max_input_tokens: 272_000 } },
    long: { key: 'long-context', name: 'Long context (>272K input tokens)', input: 0.2, output: 0.75, cached: 0.02, headline: false, constraints: { min_input_tokens_exclusive: 272_000 } },
  },
];

/**
 * Production-shaped dry-run: one row for each audit-named model, official channels
 * already present, no context-band variants yet, and no extra alias rows
 * (gpt-image-2 snapshot, V4 Flash Vision Exp, batch SKUs, openai-gpt-6-* duplicates).
 */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 0, update: 9 },
  api_channel_prices: { insert: 0, update: 15 },
  api_channel_price_variants: { insert: 29, update: 0 },
} as const;

export function catalog20261111AuditFixesSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-11-audit-fixes.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'api_channel_price_variants';
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update' | 'skip';
  changes: ReturnType<typeof seedChanges>;
  reason?: string;
}

export function seedStepCounts(steps: Step[]) {
  const tables = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const;
  return Object.fromEntries(tables.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

const day = (value: unknown) => {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
};
const appendEvidence = (existing: unknown, note: string) => {
  const previous = stripScrapeAbsenceNote(typeof existing === 'string' ? existing : existing == null ? null : String(existing)) ?? '';
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
};

export async function seedCatalog20261111AuditFixes(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) fail(`Ambiguous ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = ['openai', 'google', 'qwen'];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const provider = (slug: string) => one(providers.filter(row => row.slug === slug), `providers/${slug}`);
  const openai = provider('openai');
  const google = provider('google');
  const qwen = provider('qwen');
  for (const row of [openai, google, qwen]) {
    if (row && !['official', 'producer'].includes(String(row.type))) fail(`providers/${String(row.slug)} has type ${String(row.type)}`);
  }

  const slugs = [...new Set([
    ...LIFECYCLE.flatMap(item => item.slugs),
    ...QWEN_TIERS.map(item => item.slug),
    ...QWEN_STILL_SOLD.map(item => item.slug),
    ...GEMINI_TIERS.flatMap(item => item.slugs),
    ...OPENAI_LONG_CONTEXT.flatMap(item => item.slugs),
  ])];
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(slugs)}`;
  const modelBySlug = (slug: string) => one(models.filter(row => row.slug === slug), `models/${slug}`);

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row | null => {
    if ((table === 'api_channel_prices' || table === 'api_channel_price_variants') && existing?.last_verified
      && new Date(String(existing.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      return existing;
    }
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };
  const skip = (table: Table, target: string, reason: string) => {
    steps.push({ table, target, action: 'skip', changes: {}, reason });
  };

  for (const item of LIFECYCLE) {
    const found = item.slugs.flatMap(slug => {
      const row = modelBySlug(slug);
      return row ? [row] : [];
    });
    if (!found.length) {
      skip('models', item.key, `no row for ${item.slugs.join(' | ')}; not created`);
      continue;
    }
    for (const row of found) {
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
  }

  const channelsOf = async (modelId: number, providerId: number) => {
    if (modelId < 0) return [];
    return tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${modelId} AND provider_id = ${providerId}`;
  };
  const variantsOf = async (modelId: number, providerId: number) => {
    if (modelId < 0) return [];
    return tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${modelId} AND provider_id = ${providerId}`;
  };

  const writeTiers = async (
    model: Row, providerId: number, providerSlug: string, bands: readonly ContextBand[],
    kind: 'context_band' | 'tier', currency: 'USD' | 'CNY', source: string, note: string,
    restore: boolean,
  ) => {
    const headline = bands.find(band => band.headline);
    if (!headline) fail(`No headline band for ${String(model.slug)}`);
    const channels = await channelsOf(model.id, providerId);
    const channel = one(channels, `api_channel_prices/${providerSlug}/${String(model.slug)}`);
    const falselyRetired = hasScrapeAbsenceNote(channel?.notes);
    let channelDesired: Record<string, unknown> = {
      model_id: model.id, provider_id: providerId,
      input_price_per_1m: headline.input, output_price_per_1m: headline.output,
      ...(headline.cached != null ? { cached_input_price_per_1m: headline.cached } : {}),
      currency, price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
      notes: appendEvidence(channel?.notes, note),
    };
    if (restore && falselyRetired && channel?.availability_locked === true) channelDesired.availability_locked = false;
    else if (!restore) channelDesired = retainLockedUnavailable(channelDesired as { is_available: boolean }, channel);
    else if (channel?.availability_locked === true && !falselyRetired) {
      channelDesired = retainLockedUnavailable(channelDesired as { is_available: boolean }, channel);
    }
    save('api_channel_prices', channel, channelDesired, `${providerSlug}/${String(model.slug)}`);

    const variants = await variantsOf(model.id, providerId);
    if (variants.some(row => row.is_headline === true && !bands.some(band => band.key === row.variant_key && band.headline))) {
      fail(`${providerSlug}/${String(model.slug)} already has another headline variant; nothing written.`);
    }
    for (const band of bands) {
      const current = one(variants.filter(row => row.variant_key === band.key), `${String(model.slug)}/${band.key}`);
      save('api_channel_price_variants', current, retainLockedUnavailable({
        model_id: model.id, provider_id: providerId, variant_key: band.key, variant_name: band.name, variant_kind: kind,
        input_price_per_1m: band.input, output_price_per_1m: band.output,
        ...(band.cached != null ? { cached_input_price_per_1m: band.cached } : {}),
        currency, price_unit: 'per_1m_tokens', is_available: true,
        is_public: true, is_self_service: true, is_partner_only: false, is_headline: band.headline,
        headline_rank: band.headline ? 0 : 1,
        headline_reason: band.headline ? 'Official shortest-context list price.' : null,
        constraints_json: band.constraints, source_url: source, last_verified: VERIFIED_AT,
        notes: evidence(band.name, [source]),
      }, current), `${providerSlug}/${String(model.slug)}/${band.key}`);
    }
  };

  const qwenNote = evidence(
    'Bailian China list price (model-pricing, 华北2（北京） / 全球 CNY table), per 1M tokens. The channel headline is the shortest context band. Higher bands are context_band variants. qwen-plus output is the 非思考 column; 思考模式 is thinking_output_price_per_1m on that variant. US / 国际 prices are not stored. Batch half-price is a rule, not a stored amount. qwen-max, qwen-plus, qwen-long and qwen-vl-ocr are still on this page; an "absent from scrape" marker is not a vendor retirement.',
    [QWEN_PRICING],
  );
  if (qwen) {
    for (const spec of QWEN_TIERS) {
      const model = modelBySlug(spec.slug);
      if (!model) { skip('models', spec.slug, 'model row not found; tiers not created'); continue; }
      await writeTiers(model, qwen.id, 'qwen', spec.bands, 'context_band', 'CNY', QWEN_PRICING, qwenNote, spec.slug === 'qwen-plus');
    }
    for (const spec of QWEN_STILL_SOLD) {
      const model = modelBySlug(spec.slug);
      if (!model) { skip('models', spec.slug, 'model row not found; not created'); continue; }
      const channels = await channelsOf(model.id, qwen.id);
      const channel = one(channels, `api_channel_prices/qwen/${spec.slug}`);
      const falselyRetired = hasScrapeAbsenceNote(channel?.notes);
      const desired: Record<string, unknown> = {
        model_id: model.id, provider_id: qwen.id,
        input_price_per_1m: spec.input, output_price_per_1m: spec.output,
        currency: 'CNY', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
        notes: appendEvidence(channel?.notes, evidence(spec.note, [QWEN_PRICING])),
      };
      if (falselyRetired && channel?.availability_locked === true) desired.availability_locked = false;
      else if (channel?.availability_locked === true && !falselyRetired) {
        Object.assign(desired, retainLockedUnavailable(desired as { is_available: boolean }, channel));
      }
      save('api_channel_prices', channel, desired, `qwen/${spec.slug}`);
    }
  } else if (QWEN_TIERS.some(spec => modelBySlug(spec.slug)) || QWEN_STILL_SOLD.some(spec => modelBySlug(spec.slug))) {
    fail('providers/qwen is missing while a Qwen model row exists');
  }

  const geminiNote = evidence(
    'Gemini API Standard paid tier, per 1M tokens. Headline is prompts ≤200K. prompts >200K is a context_band variant. Cache storage ($/hour) is not a token price.',
    [GEMINI_PRICING],
  );
  if (google) {
    for (const spec of GEMINI_TIERS) {
      const matches = spec.slugs.flatMap(slug => {
        const row = modelBySlug(slug);
        return row ? [row] : [];
      });
      if (!matches.length) skip('models', spec.slugs[0], `no row for ${spec.slugs.join(' | ')}; tiers not created`);
      for (const model of matches) {
        await writeTiers(model, google.id, 'google', spec.bands, 'context_band', 'USD', GEMINI_PRICING, geminiNote, false);
      }
    }
  } else if (GEMINI_TIERS.some(spec => spec.slugs.some(slug => modelBySlug(slug)))) {
    fail('providers/google is missing while a Gemini tier model exists');
  }

  const openaiNote = evidence(
    'OpenAI Standard speed. Short context is ≤272K input tokens (the pricing page control "Short: ≤272K input tokens"). Long context is >272K and is the long-context map on that page (same variant keys as gpt-6.1-terra). Flex/Batch, Fast and Ultrafast are not these rows. Cache-write columns are not stored.',
    [OPENAI_PRICING],
  );
  if (openai) {
    for (const spec of OPENAI_LONG_CONTEXT) {
      const matches = spec.slugs.flatMap(slug => {
        const row = modelBySlug(slug);
        return row ? [row] : [];
      });
      if (!matches.length) skip('models', spec.slugs[0], `no row for ${spec.slugs.join(' | ')}; long-context tier not created`);
      for (const model of matches) {
        await writeTiers(model, openai.id, 'openai', [spec.short, spec.long], 'tier', 'USD', OPENAI_PRICING, openaiNote, false);
      }
    }
  } else if (OPENAI_LONG_CONTEXT.some(spec => spec.slugs.some(slug => modelBySlug(slug)))) {
    fail('providers/openai is missing while a GPT-6 tier model exists');
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
