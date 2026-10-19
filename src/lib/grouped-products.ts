import type { ChannelTermsFields } from '@/lib/channel-terms';
import { effectivePrice, type PriceSchedule } from '@/lib/effective-price';
import { sql } from '@/lib/db';
import { attachPrimaryProvidersToModels } from '@/lib/schema-adapters';
import type { CurrencyCode, PriceUnit } from '@/lib/currency';
import { benchmarkKey, type ModelBenchmarkScore } from '@/lib/benchmarks';

/**
 * Builds the /api-pricing payload: every model of a given type, grouped by base
 * name, with all of its available channel prices attached.
 *
 * This used to live inside `app/api/products/grouped/route.ts` and was reachable
 * only over HTTP, which forced /api-pricing to fetch it from an effect in the
 * browser. That left the site's core SEO page serving 63 characters and a
 * spinner to crawlers. The page is a server component now and calls this
 * directly; the route stays as a thin wrapper so its contract is unchanged.
 */

export interface ChannelPriceVariant {
  id: number;
  variant_key: string;
  variant_name: string;
  variant_kind?: string | null;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number | null;
  currency: CurrencyCode;
  price_unit: PriceUnit;
  is_headline: boolean;
  headline_reason?: string | null;
  constraints_json?: Record<string, unknown> | null;
}

export interface ChannelPrice extends PriceSchedule, ChannelTermsFields {
  id: number;
  model_id: number;
  provider_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number | null;
  currency: CurrencyCode;
  price_unit: PriceUnit;
  notes?: string | null;
  rate_limit?: string | null;
  is_available?: boolean;
  /** This row's own shutdown day. The card header keeps the canonical member's date. */
  member_shutdown_date?: string | null;
  /** Slug of the model row this price belongs to (variants merge into one card). */
  model_slug?: string;
  /** Variant tags relative to the parent model, e.g. ['mini'], ['mini', 'batch']. */
  variant?: string[];
  price_variants?: ChannelPriceVariant[];
  providers: {
    id: number;
    name: string;
    slug: string;
    logo?: string | null;
    logo_url?: string | null;
    type: string;
    region: string;
    access_from_china: boolean;
    website?: string | null;
    pricing_url?: string | null;
    invite_url?: string | null;
  };
}

export interface GroupedProduct {
  id: number;
  name: string;
  slug: string;
  provider_ids: number[];
  context_window: number;
  benchmark_arena_elo: number | null;
  benchmarks: ModelBenchmarkScore[];
  released_at: string | null;
  created_at: string | null;
  providers?: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    logo_url?: string;
    region?: string;
    access_from_china?: boolean;
  };
  modelCategory?: string | null;
  shutdown_date?: string | null;
  baseName: string;
  versions: ChannelPrice[];
  hasChinaVersion: boolean;
  hasGlobalVersion: boolean;
  versionCounts: number;
  /** Distinct variant tags present on this card (for search/labels). */
  variantTags?: string[];
  /** Slugs of every model row merged into this card (for search). */
  memberSlugs?: string[];
}

/**
 * Distinct SKU suffixes that are price variants of the same model family:
 * gpt-5-mini, gpt-4o-batch, gpt-5-mini-batch. Returns the tags and the
 * remaining parent slug, or null for a standard model.
 */
export function variantOf(slug: string): { tags: string[]; parent: string } | null {
  const tags: string[] = [];
  let parent = slug;
  for (;;) {
    const match = parent.match(/-(batch|mini|nano)$/);
    if (!match) break;
    tags.unshift(match[1]);
    parent = parent.slice(0, match.index);
  }
  return tags.length ? { tags, parent } : null;
}

/** Existing loose group key: only collapse dated snapshots; major version
 * numbers are part of the model identity (gpt-4 vs gpt-5, grok-2 vs grok-4
 * must not merge). Variant suffixes are handled separately by variantOf. */
export function baseGroupName(name: string): string {
  return name
    .replace(/-(?:19|20)\d{2}-\d{2}-\d{2}$/, '')
    .replace(/-(?:19|20)\d{2}$/, '')
    .replace(/-\d+\.\d+\.\d+$/, '');
}

const VARIANT_RANK: Record<string, number> = { mini: 1, nano: 1, batch: 2 };
const VARIANT_SUFFIX = /-(batch|mini|nano)$/;

/**
 * Group key for a catalog slug. A suffix attaches to the nearest existing
 * parent, then follows that parent's own group. `openai-o3-mini-batch` joins
 * `o3-mini` (the `openai-` prefix is not part of the id, and `o3` is a
 * different shutdown). `gpt-4.1-nano` stays on `gpt-4.1`. `gpt-5-mini-batch`
 * still joins `gpt-5` when both `gpt-5-mini` and `gpt-5` exist.
 */
export function groupIdentity(slug: string, slugs: ReadonlySet<string>): { key: string; tags: string[] } {
  let parent = slug;
  const peeled: Array<{ parent: string; tag: string }> = [];
  for (;;) {
    const match = parent.match(VARIANT_SUFFIX);
    if (!match || match.index == null) break;
    peeled.push({ parent: parent.slice(0, match.index), tag: match[1] });
    parent = parent.slice(0, match.index);
  }
  for (let i = 0; i < peeled.length; i++) {
    const step = peeled[i];
    const unprefixed = step.parent.startsWith('openai-') ? step.parent.slice('openai-'.length) : null;
    const hit = slugs.has(step.parent) ? step.parent : unprefixed && slugs.has(unprefixed) ? unprefixed : null;
    if (!hit || hit === slug) continue;
    const rest = groupIdentity(hit, slugs);
    return { key: rest.key, tags: [...rest.tags, ...peeled.slice(0, i + 1).map((item) => item.tag).reverse()] };
  }
  return { key: baseGroupName(slug).toLowerCase(), tags: [] };
}

/** A dated snapshot (qwen3.5-plus-2026-04-20) never owns the card identity. */
export function isCanonicalSlug(slug: string): boolean {
  return !/-(?:19|20)\d{2}(?:-\d{2}-\d{2})?$/.test(slug)
    && !/\d+\.\d+\.\d+$/.test(slug);
}

export async function getGroupedProducts(type?: string | null, providerId?: number, now = new Date()): Promise<GroupedProduct[]> {
  // Without a provider filter, preserve the API-pricing LLM catalog.
  // Provider pages include every available model category sold by that channel.
  const [modelsData, channelPrices, benchmarkScores] = await Promise.all([
    sql<any[]>`
      SELECT id, name, slug, provider_ids, model_category, context_window, released_at, created_at, shutdown_date::text
      FROM models
      WHERE (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND (
        (${providerId ?? null}::int IS NULL AND type = ${type || 'llm'})
        OR (${providerId ?? null}::int IS NOT NULL AND EXISTS (
          SELECT 1 FROM api_channel_prices cp
          WHERE cp.model_id = models.id AND cp.provider_id = ${providerId ?? null}
            AND cp.is_available = true
        ))
      )
      ORDER BY name
    `,
    sql<any[]>`
      SELECT
        cp.id,
        cp.model_id,
        cp.provider_id,
        cp.input_price_per_1m,
        cp.output_price_per_1m,
        cp.cached_input_price_per_1m,
        cp.promo_ends_at,
        cp.regular_input_price_per_1m,
        cp.regular_output_price_per_1m,
        cp.regular_cached_input_price_per_1m,
        cp.currency,
        cp.price_unit,
        (to_jsonb(cp)->>'data_for_discount')::boolean AS data_for_discount,
        to_jsonb(cp)->>'data_for_discount_note' AS data_for_discount_note,
        to_jsonb(cp)->>'quota_unit' AS quota_unit,
        cp.notes,
        cp.rate_limit,
        cp.is_available,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', v.id,
            'variant_key', v.variant_key,
            'variant_name', v.variant_name,
            'variant_kind', v.variant_kind,
            'input_price_per_1m', v.input_price_per_1m,
            'output_price_per_1m', v.output_price_per_1m,
            'cached_input_price_per_1m', v.cached_input_price_per_1m,
            'currency', v.currency,
            'price_unit', v.price_unit,
            'is_headline', v.is_headline,
            'headline_reason', v.headline_reason,
            'constraints_json', v.constraints_json
          ) ORDER BY v.is_headline DESC, v.headline_rank ASC NULLS LAST, v.input_price_per_1m ASC NULLS LAST)
          FROM api_channel_price_variants v
          WHERE v.model_id = cp.model_id
            AND v.provider_id = cp.provider_id
            AND v.is_available = true
            AND v.is_public = true
        ), '[]'::jsonb) AS price_variants,
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'logo', p.logo,
          'logo_url', p.logo_url,
          'type', p.type,
          'region', p.region,
          'access_from_china', p.access_from_china,
          'website', p.website,
          'pricing_url', p.pricing_url,
          'invite_url', p.invite_url
        ) AS providers
      FROM api_channel_prices cp
      JOIN providers p ON p.id = cp.provider_id
      WHERE cp.is_available = true
        AND (${providerId ?? null}::int IS NULL OR cp.provider_id = ${providerId ?? null})
    `,
    // Fetch all current scores with their complete identity. Keeping benchmark,
    // version, task and metric together prevents unlike evaluation runs from
    // becoming a single ambiguous number in the comparison UI.
    sql<any[]>`
      SELECT s.model_id, m.slug AS source_model_slug, s.value,
             b.slug AS benchmark_slug, b.name AS benchmark_name,
             b.type AS benchmark_type, b.offical_url AS official_url,
             bv.version_label, bt.name AS task_name,
             bm.name AS metric_name, bm.unit, bm.higher_better,
             s.release_date
      FROM model_benchmark_scores s
      JOIN models m ON m.id = s.model_id
      JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
      JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id
        AND bv.is_current = true
      JOIN benchmarks b ON b.id = bv.benchmark_id
      JOIN benchmark_metrics bm ON bm.id = s.metric_id
      WHERE s.value IS NOT NULL
      ORDER BY b.name, s.value DESC NULLS LAST
    `,
  ]);

  const effectiveChannelPrices = channelPrices.map(cp => effectivePrice(cp, now));
  const products = await attachPrimaryProvidersToModels(modelsData as any[]);

  // Create benchmark map: model_id -> highest value (for arena elo)
  const benchmarkMap = new Map<number, number>();
  const benchmarksByModel = new Map<number, ModelBenchmarkScore[]>();
  benchmarkScores.forEach((bs: any) => {
    const modelId = bs.model_id;
    const value = bs.value;
    if (bs.benchmark_slug === 'arena-agent' &&
        (!benchmarkMap.has(modelId) || value > (benchmarkMap.get(modelId) || 0))) {
      benchmarkMap.set(modelId, value);
    }
    const scores = benchmarksByModel.get(modelId) || [];
    scores.push({
      benchmark_slug: bs.benchmark_slug,
      benchmark_name: bs.benchmark_name,
      benchmark_type: bs.benchmark_type,
      official_url: bs.official_url,
      version_label: bs.version_label || 'default',
      task_name: bs.task_name || 'default',
      metric_name: bs.metric_name,
      unit: bs.unit,
      higher_better: bs.higher_better !== false,
      value: Number(bs.value),
      release_date: bs.release_date,
      source_model_id: modelId,
      source_model_slug: bs.source_model_slug,
    });
    benchmarksByModel.set(modelId, scores);
  });

  // 按模型基础名称分组
  const modelGroups = new Map<string, GroupedProduct>();
  const allSlugs = new Set(products.map(product => product.slug));
  const slugById = new Map(products.map(product => [product.id, product.slug]));

  // A variant joins the nearest existing parent's card (gpt-5-mini → gpt-5).
  // An orphan variant (aion-3.0-mini) keeps its own card. Batch-of-mini stays
  // with mini when that slug is its own card (openai-o3-mini-batch → o3-mini).
  const variantInfo = new Map<string, { tags: string[]; key: string }>();
  for (const product of products) {
    const identity = groupIdentity(product.slug, allSlugs);
    if (identity.tags.length) variantInfo.set(product.slug, identity);
  }

  products.forEach(product => {
    const variant = variantInfo.get(product.slug);
    // 提取基础名称（变体先去掉 mini/nano/batch 后缀，再走数字版本归并）。
    // 用小写 slug 而非 name：DB 里显示名大小写不一（'GPT-5.4' vs slug
    // 'gpt-5.4'），用 name 会让变体行和标准行裂成两张卡。
    const baseName = variant ? variant.key : baseGroupName(product.slug).toLowerCase();

    let productPrices = effectiveChannelPrices.filter(cp => cp.model_id === product.id)
      .map(cp => ({
        ...cp,
        model_slug: slugById.get(cp.model_id) ?? product.slug,
        member_shutdown_date: product.shutdown_date ?? null,
        ...(variant ? { variant: variant.tags } : {}),
      })) as ChannelPrice[];
    // Standard rows first, then mini/nano, then batch — keeps table readable.
    const rankOf = (cp: ChannelPrice) => cp.variant
      ? cp.variant.reduce((max, t) => Math.max(max, VARIANT_RANK[t] ?? 3), 0)
      : 0;
    productPrices = productPrices.sort((a, b) => rankOf(a) - rankOf(b));
    const officialProducer =
      productPrices.find(cp => cp.providers?.type === 'producer') ||
      productPrices.find(cp => cp.providers?.type === 'official') ||
      null;
    const displayProvider = (product as any).providers || officialProducer?.providers || null;

    if (!modelGroups.has(baseName)) {
      const hasChinaVersion = productPrices.some(cp => (cp as any).providers?.region === 'china');
      const hasGlobalVersion = productPrices.some(cp => (cp as any).providers?.region === 'global');

      // (A cheapest-first ordering used to be computed here and never read.
      // It compared input_price_per_1m across currencies, so it would have
      // ranked ¥3 above $0.78; /api-pricing now normalises to USD itself.)

      modelGroups.set(baseName, {
        id: product.id,
        name: product.name,
        slug: product.slug,
        provider_ids: product.provider_ids,
        context_window: (product as any).context_window,
        benchmark_arena_elo: benchmarkMap.get(product.id) || null,
        benchmarks: benchmarksByModel.get(product.id) || [],
        released_at: product.released_at ?? null,
        created_at: product.created_at ?? null,
        providers: displayProvider,
        modelCategory: product.model_category,
        shutdown_date: product.shutdown_date ?? null,
        baseName,
        versions: productPrices as ChannelPrice[],
        hasChinaVersion,
        hasGlobalVersion,
        versionCounts: productPrices.length,
        variantTags: [...new Set(variant?.tags ?? [])],
        memberSlugs: [product.slug],
      });
    } else {
      // 合并到现有组
      const group = modelGroups.get(baseName)!;
      group.versions.push(...productPrices);
      group.versionCounts += productPrices.length;
      group.memberSlugs ??= [];
      group.variantTags ??= [];
      group.memberSlugs.push(product.slug);
      variant?.tags.forEach(t => {
        if (!group.variantTags!.includes(t)) group.variantTags!.push(t);
      });
      // Standard (non-snapshot, non-variant) model owns the card identity;
      // a dated snapshot or variant that created the group first yields to it.
      if (!variant && isCanonicalSlug(product.slug)) {
        group.shutdown_date = product.shutdown_date ?? null;
        group.id = product.id;
        group.name = product.name;
        group.slug = product.slug;
        group.provider_ids = product.provider_ids;
        group.context_window = (product as any).context_window;
        group.benchmark_arena_elo = benchmarkMap.get(product.id) || group.benchmark_arena_elo;
        group.released_at = product.released_at ?? group.released_at;
        group.created_at = product.created_at ?? group.created_at;
        if (!group.providers) group.providers = displayProvider;
      }

      const merged = new Map(group.benchmarks.map((score) => [benchmarkKey(score), score]));
      for (const score of benchmarksByModel.get(product.id) || []) {
        const key = benchmarkKey(score);
        const existing = merged.get(key);
        if (!existing || (score.higher_better ? score.value > existing.value : score.value < existing.value)) {
          merged.set(key, score);
        }
      }
      group.benchmarks = [...merged.values()];
      const groupArena = group.benchmarks.filter((score) => score.benchmark_slug === 'arena-agent');
      group.benchmark_arena_elo = groupArena.length
        ? Math.max(...groupArena.map((score) => score.value))
        : group.benchmark_arena_elo;

      if (!group.hasChinaVersion && productPrices.some(cp => cp.providers.region === 'china')) {
        group.hasChinaVersion = true;
      }
      if (!group.hasGlobalVersion && productPrices.some(cp => cp.providers.region === 'global')) {
        group.hasGlobalVersion = true;
      }
    }
  });

  // Filter out models that have no channel prices at all. These show up
  // with a provider name in the card header but an empty comparison table
  // underneath — confusing for /api-pricing viewers who expect price
  // data. Such models still exist and are reachable via /models/[slug]
  // (which reads from a different API), so nothing is lost.
  return Array.from(modelGroups.values())
    .filter((group) => group.versions.length > 0)
    .map((group) => ({
      ...group,
      versions: [...group.versions].sort((a, b) => {
        const rank = (cp: ChannelPrice) => cp.variant
          ? cp.variant.reduce((max, t) => Math.max(max, VARIANT_RANK[t] ?? 3), 0)
          : 0;
        return rank(a) - rank(b);
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
