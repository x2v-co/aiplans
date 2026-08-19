#!/usr/bin/env tsx
/**
 * Data accuracy audit for api_channel_prices, models, plans, model_plan_mapping.
 *
 * Usage:
 *   npx tsx scripts/audit-data.ts                 # run all checks, summary only
 *   npx tsx scripts/audit-data.ts --verbose       # show every finding
 *   npx tsx scripts/audit-data.ts --json > out.json  # machine-readable
 *   npx tsx scripts/audit-data.ts --stale-days 14 # override staleness threshold
 *
 * Exit code 0 if no findings; 1 if any `critical` findings; 2 if only warnings.
 *
 * Check categories:
 *   C1 prices.zero_or_null        — price_per_1m <= 0 or null (critical)
 *   C2 prices.output_lt_input     — output_price < input_price (critical; physically wrong)
 *   C3 prices.input_eq_output     — input == output (warn; almost always parser bug)
 *   C4 prices.stale               — last_verified older than threshold (warn)
 *   C5 prices.missing_verified    — last_verified null (warn)
 *   C6 prices.cross_channel_outlier — >5x deviation from median across channels for same model (warn)
 *   C7 models.no_channel_price    — model has 0 rows in api_channel_prices (warn)
 *   C8 models.no_producer_channel — model has prices but none from a producer-type provider (warn)
 *   C9 mapping.orphan_model       — model_plan_mapping.model_id not in models (critical)
 *   C10 mapping.orphan_plan       — model_plan_mapping.plan_id not in plans (critical)
 *   C11 providers.unknown_ref     — api_channel_prices.provider_id not in providers (critical)
 *   C12 models.unknown_provider_id — models.provider_ids[] references missing provider (warn)
 *   C13 plans.stale               — plan last_verified older than threshold (warn)
 *   C14 plans.missing_kind        — plan has no plan_kind/plan_line/tier_rank (warn)
 *   C15 plans.no_model_mapping    — plan has 0 rows in model_plan_mapping (warn)
 *   C16 plans.selector_empty      — model_selector resolves to 0 models (critical)
 *   C17 plans.selector_unknown_slug — selector.extra names a nonexistent model (critical)
 */
import { supabaseAdmin } from './db/queries';
import { databaseSql } from './db/postgres-admin';
import { resolveSelector, type ModelSelector, type SelectableModel } from '../src/lib/plan-selector';

const args = new Set(process.argv.slice(2));
const VERBOSE = args.has('--verbose') || args.has('-v');
const JSON_OUT = args.has('--json');
const STALE_DAYS = (() => {
  const i = process.argv.indexOf('--stale-days');
  return i >= 0 ? Number(process.argv[i + 1]) : 30;
})();
const OUTLIER_RATIO = 5; // 5x deviation from median triggers outlier

type Severity = 'critical' | 'warning';
interface Finding {
  check: string;
  severity: Severity;
  message: string;
  ref?: Record<string, unknown>;
}

const findings: Finding[] = [];
const add = (check: string, severity: Severity, message: string, ref?: Record<string, unknown>) =>
  findings.push({ check, severity, message, ref });

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function main() {
  const log = JSON_OUT ? () => {} : (s: string) => console.log(s);
  log(`\n🔍 Data accuracy audit  (stale=${STALE_DAYS}d, outlier=${OUTLIER_RATIO}x)\n`);

  // ---------- fetch ----------
  // C14-C17 read columns added by migration 013/014. Nothing runs `npm run
  // migrate` automatically, so probe for them rather than crashing the nightly
  // job on a deploy that landed before the migration did.
  const planKindColumns = await databaseSql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'plans'
       AND column_name IN ('plan_kind', 'plan_line', 'tier_rank', 'model_selector')
  `;
  const CLASSIFIED = planKindColumns.length === 4;
  const planColumns = CLASSIFIED
    ? 'id, name, slug, provider_id, price, last_verified, source, plan_kind, plan_line, tier_rank, model_selector'
    : 'id, name, slug, provider_id, price, last_verified, source';

  const [modelsRes, providersRes, pricesRes, plansRes, mappingsRes, ratesRes] = await Promise.all([
    supabaseAdmin.from('models').select('id, name, slug, provider_ids, type'),
    supabaseAdmin.from('providers').select('id, name, slug, type'),
    supabaseAdmin.from('api_channel_prices').select('id, model_id, provider_id, input_price_per_1m, output_price_per_1m, is_available, last_verified, updated_at, currency'),
    supabaseAdmin.from('plans').select(planColumns),
    supabaseAdmin.from('model_plan_mapping').select('id, model_id, plan_id'),
    supabaseAdmin.from('exchange_rates').select('from_currency, to_currency, rate, valid_at').eq('is_active', true).order('valid_at', { ascending: false }),
  ]);
  for (const r of [modelsRes, providersRes, pricesRes, plansRes, mappingsRes, ratesRes]) {
    if (r.error) throw r.error;
  }
  const models = modelsRes.data ?? [];
  const providers = providersRes.data ?? [];
  const prices = pricesRes.data ?? [];
  const plans = plansRes.data ?? [];
  const mappings = mappingsRes.data ?? [];

  // Currency normalization to USD for cross-channel comparison.
  // Builds a lookup with the most recent active rate per currency.
  const FALLBACK_RATES: Record<string, number> = { CNY: 0.14, EUR: 1.10, GBP: 1.27, JPY: 0.0067, SGD: 1 / 1.35 };
  const ratesToUSD = new Map<string, number>([['USD', 1]]);
  for (const r of ratesRes.data ?? []) {
    if (r.to_currency === 'USD' && !ratesToUSD.has(r.from_currency)) {
      ratesToUSD.set(r.from_currency, Number(r.rate));
    }
  }
  for (const [cur, rate] of Object.entries(FALLBACK_RATES)) {
    if (!ratesToUSD.has(cur)) ratesToUSD.set(cur, rate);
  }
  const toUSD = (price: number | null | undefined, currency: string | null | undefined): number => {
    if (price == null) return 0;
    const cur = currency ?? 'USD';
    const rate = ratesToUSD.get(cur) ?? 1;
    return price * rate;
  };

  const modelById = new Map(models.map(m => [m.id, m]));
  const providerById = new Map(providers.map(p => [p.id, p]));
  const planById = new Map(plans.map(p => [p.id, p]));

  const refModel = (id: number | null | undefined) => {
    const m = id != null ? modelById.get(id) : undefined;
    return m ? `${m.slug}#${m.id}` : `model#${id}`;
  };
  const refProvider = (id: number | null | undefined) => {
    const p = id != null ? providerById.get(id) : undefined;
    return p ? `${p.slug}#${p.id}` : `provider#${id}`;
  };

  // Arena ELO, needed only so a selector's min_elo resolves the same way here
  // as it does in the materializer. Without it a min_elo selector would look
  // empty to the audit and report a critical that is not real.
  const eloRows = await databaseSql<{ model_id: number; elo: number | null }[]>`
    SELECT score.model_id, max(score.value) AS elo
      FROM model_benchmark_scores AS score
      JOIN benchmark_metrics AS metric ON metric.id = score.metric_id
     WHERE metric.name = 'ELO'
     GROUP BY score.model_id
  `;
  const eloByModel = new Map(eloRows.map(r => [r.model_id, r.elo]));

  const now = Date.now();
  const staleCutoff = now - STALE_DAYS * 24 * 3600 * 1000;

  log(`Loaded: ${models.length} models, ${providers.length} providers, ${prices.length} prices, ${plans.length} plans, ${mappings.length} mappings\n`);

  // Helper: should this row be skipped entirely (soft-disabled rows)?
  const isDisabled = (p: typeof prices[number]) => p.is_available === false;
  // Helper: free-tier models legitimately have zero prices
  const isFreeTier = (modelId: number | null | undefined) => {
    if (modelId == null) return false;
    const slug = modelById.get(modelId)?.slug ?? '';
    return slug.includes('(free)') || slug.endsWith('-free') || slug.includes(':free');
  };
  const isVerifiedFreePrice = (modelId: number | null | undefined, providerId: number | null | undefined) => {
    const modelSlug = modelId != null ? modelById.get(modelId)?.slug : undefined;
    const providerSlug = providerId != null ? providerById.get(providerId)?.slug : undefined;
    return providerSlug === 'zhipu-china'
      && (modelSlug === 'glm-4.7-flash' || modelSlug === 'glm-4.6v-flash');
  };
  // Helper: image/audio models priced per-call rather than per-token
  const isNonTokenPriced = (modelId: number | null | undefined) => {
    if (modelId == null) return false;
    const slug = modelById.get(modelId)?.slug ?? '';
    return slug.includes('imagine') || slug.includes('-image') || slug.includes('-tts')
      || slug.includes('-asr') || slug.includes('-whisper') || slug.includes('embedding')
      || slug.includes('reranker');
  };
  const isVerifiedUnifiedPrice = (modelId: number | null | undefined, providerId: number | null | undefined) => {
    const modelSlug = modelId != null ? modelById.get(modelId)?.slug : undefined;
    const providerSlug = providerId != null ? providerById.get(providerId)?.slug : undefined;
    return (modelSlug === 'qwen2.5-7b-instruct-turbo' && providerSlug === 'together-ai')
      || (modelSlug === 'gemma-2-27b' && providerSlug === 'openrouter')
      || (modelSlug === 'glm-4' && providerSlug === 'zhipu-china')
      || (['mistral', 'openrouter'].includes(providerSlug ?? '')
        && ['ministral-3b', 'ministral-8b', 'ministral-14b'].includes(modelSlug ?? ''));
  };

  // ---------- C1/C2/C3: row-level price sanity ----------
  for (const p of prices) {
    if (isDisabled(p)) continue;
    const ctx = { price_id: p.id, model: refModel(p.model_id), provider: refProvider(p.provider_id), in: p.input_price_per_1m, out: p.output_price_per_1m };
    const freeTier = isFreeTier(p.model_id) || isVerifiedFreePrice(p.model_id, p.provider_id);
    const nonToken = isNonTokenPriced(p.model_id);

    if (!freeTier && !nonToken) {
      if (p.input_price_per_1m == null || p.input_price_per_1m <= 0) {
        add('prices.zero_or_null', 'critical', `input_price_per_1m=${p.input_price_per_1m}`, ctx);
      }
      if (p.output_price_per_1m == null || p.output_price_per_1m <= 0) {
        add('prices.zero_or_null', 'critical', `output_price_per_1m=${p.output_price_per_1m}`, ctx);
      }
    }
    if (
      p.input_price_per_1m != null && p.output_price_per_1m != null &&
      p.input_price_per_1m > 0 && p.output_price_per_1m > 0 &&
      p.output_price_per_1m < p.input_price_per_1m
    ) {
      add('prices.output_lt_input', 'critical', `output ($${p.output_price_per_1m}) < input ($${p.input_price_per_1m})`, ctx);
    }
    if (
      !nonToken && !isVerifiedUnifiedPrice(p.model_id, p.provider_id) &&
      p.input_price_per_1m != null && p.output_price_per_1m != null &&
      p.input_price_per_1m > 0 && p.input_price_per_1m === p.output_price_per_1m
    ) {
      add('prices.input_eq_output', 'warning', `input == output == $${p.input_price_per_1m} (verify unified pricing)`, ctx);
    }
  }

  // ---------- C4/C5: staleness ----------
  for (const p of prices) {
    if (isDisabled(p)) continue;
    if (!p.last_verified) {
      add('prices.missing_verified', 'warning', 'last_verified is null', { price_id: p.id, model: refModel(p.model_id), provider: refProvider(p.provider_id) });
      continue;
    }
    const lv = new Date(p.last_verified).getTime();
    if (lv < staleCutoff) {
      const days = Math.floor((now - lv) / (86400 * 1000));
      add('prices.stale', 'warning', `last_verified ${days}d ago`, { price_id: p.id, model: refModel(p.model_id), provider: refProvider(p.provider_id), days });
    }
  }

  // ---------- C6: cross-channel outliers ----------
  const byModel = new Map<number, typeof prices>();
  for (const p of prices) {
    if (p.model_id == null) continue;
    if (isDisabled(p)) continue;
    if (isFreeTier(p.model_id) || isNonTokenPriced(p.model_id)) continue;
    if (!byModel.has(p.model_id)) byModel.set(p.model_id, []);
    byModel.get(p.model_id)!.push(p);
  }
  for (const [modelId, rows] of byModel) {
    if (rows.length < 3) continue;
    for (const field of ['input_price_per_1m', 'output_price_per_1m'] as const) {
      // Normalize to USD before comparing — siliconflow/qwen/etc store CNY,
      // mistral stores EUR. Without normalization we get many false positives.
      const usdValues = rows
        .map(r => toUSD(r[field], r.currency))
        .filter(v => v > 0);
      if (usdValues.length < 3) continue;
      const med = median(usdValues);
      if (med <= 0) continue;
      for (const r of rows) {
        const raw = r[field];
        if (typeof raw !== 'number' || raw <= 0) continue;
        const usd = toUSD(raw, r.currency);
        const ratio = usd / med;
        if (ratio >= OUTLIER_RATIO || ratio <= 1 / OUTLIER_RATIO) {
          add('prices.cross_channel_outlier', 'warning',
            `${field}=${raw} ${r.currency ?? 'USD'} (≈$${usd.toFixed(3)}) is ${ratio.toFixed(1)}x median ($${med.toFixed(3)}) for model ${refModel(modelId)}`,
            { price_id: r.id, model: refModel(modelId), provider: refProvider(r.provider_id), field, value: raw, currency: r.currency, usd, median_usd: med, ratio },
          );
        }
      }
    }
  }

  // ---------- C7/C8: model coverage ----------
  const pricedModelIds = new Set(prices.map(p => p.model_id).filter((x): x is number => x != null));
  for (const m of models) {
    if (m.type && m.type !== 'llm') continue;
    if (!pricedModelIds.has(m.id)) {
      add('models.no_channel_price', 'warning', `model has 0 api_channel_prices rows`, { model: `${m.slug}#${m.id}`, name: m.name });
    }
  }
  // producer coverage
  for (const [modelId, rows] of byModel) {
    const hasProducer = rows.some(r => {
      const prov = providerById.get(r.provider_id);
      return prov?.type === 'producer' || prov?.type === 'official';
    });
    if (!hasProducer) {
      add('models.no_producer_channel', 'warning', `model has prices but none from producer/official`, { model: refModel(modelId) });
    }
  }

  // ---------- C9/C10: mapping orphans ----------
  for (const m of mappings) {
    if (m.model_id != null && !modelById.has(m.model_id)) {
      add('mapping.orphan_model', 'critical', `model_plan_mapping.model_id=${m.model_id} not in models`, { mapping_id: m.id, plan: m.plan_id });
    }
    if (m.plan_id != null && !planById.has(m.plan_id)) {
      add('mapping.orphan_plan', 'critical', `model_plan_mapping.plan_id=${m.plan_id} not in plans`, { mapping_id: m.id, model: m.model_id });
    }
  }

  // ---------- C11: api_channel_prices unknown provider ----------
  for (const p of prices) {
    if (p.provider_id != null && !providerById.has(p.provider_id)) {
      add('providers.unknown_ref', 'critical', `api_channel_prices.provider_id=${p.provider_id} not in providers`, { price_id: p.id, model: refModel(p.model_id) });
    }
  }

  // ---------- C12: models.provider_ids unknown provider ----------
  for (const m of models) {
    for (const pid of m.provider_ids ?? []) {
      if (!providerById.has(pid)) {
        add('models.unknown_provider_id', 'warning', `models.provider_ids contains ${pid} not in providers`, { model: `${m.slug}#${m.id}`, provider_id: pid });
      }
    }
  }

  // ---------- C13: plan staleness ----------
  for (const pl of plans) {
    // Manual plans are curated ground truth and are intentionally outside the
    // scraper freshness contract. See cleanupOutdatedPlans().
    if (pl.source === 'manual') continue;
    if (!pl.last_verified) {
      add('plans.missing_verified', 'warning', 'plan.last_verified is null', { plan: `${pl.slug}#${pl.id}` });
      continue;
    }
    const lv = new Date(pl.last_verified).getTime();
    if (lv < staleCutoff) {
      const days = Math.floor((now - lv) / (86400 * 1000));
      add('plans.stale', 'warning', `plan.last_verified ${days}d ago`, { plan: `${pl.slug}#${pl.id}`, days });
    }
  }

  // ---------- C14-C17: plan classification and derived model links ----------
  // Every plan needs a plan_kind/plan_line/tier_rank so the UI can group it into
  // the right product ladder, and a model_selector so the materializer can
  // derive its model links. See scripts/config/plan-classifications.ts.
  // C15 (no_model_mapping) works on the pre-migration schema too, so it runs
  // unconditionally; C14/C16/C17 need the new columns.
  // providerById holds untyped shim rows, so narrow to what the selector needs.
  const providerSlugById = new Map<number, string>(
    providers.map((pr: { id: number; slug: string }) => [pr.id, pr.slug]),
  );
  const modelCatalog: SelectableModel[] = models.map(
    (m: { id: number; slug: string; provider_ids: number[] | null }) => ({
      id: m.id,
      slug: m.slug,
      providerSlugs: (m.provider_ids ?? [])
        .map((pid) => providerSlugById.get(pid))
        .filter((slug): slug is string => Boolean(slug)),
      elo: eloByModel.get(m.id) ?? null,
    }),
  );

  const mappingCountByPlan = new Map<number, number>();
  for (const mp of mappings) {
    mappingCountByPlan.set(mp.plan_id, (mappingCountByPlan.get(mp.plan_id) ?? 0) + 1);
  }

  for (const pl of plans) {
    if ((mappingCountByPlan.get(pl.id) ?? 0) === 0) {
      add('plans.no_model_mapping', 'warning', 'plan has no models in model_plan_mapping', {
        plan: `${pl.slug}#${pl.id}`,
        provider: refProvider(pl.provider_id),
      });
    }
  }

  if (!CLASSIFIED) {
    log('⏭  Skipping C14-C17: plans.plan_kind / model_selector not present. Run `npm run migrate`.\n');
  }

  for (const pl of CLASSIFIED ? plans : []) {
    const ref = { plan: `${pl.slug}#${pl.id}`, provider: refProvider(pl.provider_id) };

    const missing: string[] = [];
    if (!pl.plan_kind) missing.push('plan_kind');
    if (!pl.plan_line) missing.push('plan_line');
    if (pl.tier_rank == null) missing.push('tier_rank');
    if (!pl.model_selector) missing.push('model_selector');
    if (missing.length > 0) {
      add('plans.missing_kind', 'warning', `plan is unclassified (${missing.join(', ')} unset)`, ref);
    }

    if (!pl.model_selector) continue;

    const providerSlug = providerSlugById.get(pl.provider_id);
    const resolution = resolveSelector(
      pl.model_selector as ModelSelector,
      modelCatalog,
      providerSlug ? [providerSlug] : [],
    );

    // A selector that matches nothing is worse than no selector at all: the
    // materializer will keep the plan's links frozen and the plan quietly stops
    // tracking new models. This is the exact rot the selector system replaced.
    if (resolution.models.length === 0) {
      add('plans.selector_empty', 'critical', 'model_selector resolves to 0 models', {
        ...ref,
        selector: pl.model_selector,
      });
    }
    for (const slug of resolution.unknownExtra) {
      add('plans.selector_unknown_slug', 'critical', `selector.extra names unknown model '${slug}'`, ref);
    }
  }

  // ---------- report ----------
  if (JSON_OUT) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      config: { staleDays: STALE_DAYS, outlierRatio: OUTLIER_RATIO },
      counts: { models: models.length, providers: providers.length, prices: prices.length, plans: plans.length, mappings: mappings.length },
      findings,
    }, null, 2));
  } else {
    const grouped = new Map<string, Finding[]>();
    for (const f of findings) {
      if (!grouped.has(f.check)) grouped.set(f.check, []);
      grouped.get(f.check)!.push(f);
    }
    const critical = findings.filter(f => f.severity === 'critical').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;

    const order = [
      'prices.zero_or_null',
      'prices.output_lt_input',
      'providers.unknown_ref',
      'mapping.orphan_model',
      'mapping.orphan_plan',
      'plans.selector_empty',
      'plans.selector_unknown_slug',
      'prices.input_eq_output',
      'prices.cross_channel_outlier',
      'prices.stale',
      'prices.missing_verified',
      'models.no_channel_price',
      'models.no_producer_channel',
      'models.unknown_provider_id',
      'plans.stale',
      'plans.missing_verified',
      'plans.missing_kind',
      'plans.no_model_mapping',
    ];
    for (const check of order) {
      const list = grouped.get(check);
      if (!list || list.length === 0) continue;
      const sev = list[0].severity === 'critical' ? '🔴' : '🟡';
      log(`${sev} ${check}  (${list.length})`);
      const sample = VERBOSE ? list : list.slice(0, 8);
      for (const f of sample) {
        log(`   · ${f.message}  ${JSON.stringify(f.ref ?? {})}`);
      }
      if (!VERBOSE && list.length > sample.length) {
        log(`   … ${list.length - sample.length} more (use --verbose)`);
      }
      log('');
    }

    log(`────────────────────────────────────`);
    log(`Total: ${findings.length} findings  (🔴 ${critical} critical  🟡 ${warnings} warnings)`);
  }

  const hasCritical = findings.some(f => f.severity === 'critical');
  // Let Node flush large JSON reports before exiting. Calling process.exit()
  // here truncated stdout once the report exceeded the pipe buffer.
  process.exitCode = hasCritical ? 1 : findings.length > 0 ? 2 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
