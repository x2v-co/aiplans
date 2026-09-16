#!/usr/bin/env tsx
/**
 * Import task-level benchmark results from the public Artificial Analysis model
 * leaderboard into the normalized benchmark tables.
 *
 * Values are stored as percentages and remain separate benchmarks. We do not
 * import the provider's composite Intelligence Index because mixing tasks into
 * a second opaque score is less useful than exposing the underlying results.
 *
 * Usage:
 *   npm run ingest:benchmarks -- --dry-run
 *   npm run ingest:benchmarks
 */
import { databaseSql } from './db/postgres-admin';
import { upsertBenchmarkScore } from './db/queries';
import { AA_USER_AGENT, extractBalancedArray, parseNextFlight, resolveLocalModelId } from './utils/artificial-analysis';

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE_URL = 'https://artificialanalysis.ai/leaderboards/models';
const VERSION_LABEL = 'Artificial Analysis current suite';

interface AaModel {
  name: string;
  shortName?: string;
  slug: string;
  releaseDate?: string | null;
  deprecated?: boolean;
  intelligenceIndex?: number | null;
  gpqa?: number | null;
  hle?: number | null;
  scicode?: number | null;
  terminalbenchHard?: number | null;
  ifbench?: number | null;
  mmmuPro?: number | null;
  price1mInputTokens?: number | null;
  price1mOutputTokens?: number | null;
  cacheHitPrice?: number | null;
  cacheWritePrice?: number | null;
}

interface MetricSpec {
  field: keyof AaModel;
  slug: string;
  name: string;
  type: string;
  task: string;
  metric: string;
}

const METRICS: MetricSpec[] = [
  { field: 'gpqa', slug: 'gpqa-diamond', name: 'GPQA Diamond', type: 'reasoning', task: 'Diamond', metric: 'ACCURACY' },
  { field: 'hle', slug: 'humanitys-last-exam', name: "Humanity's Last Exam", type: 'knowledge', task: 'Text only', metric: 'ACCURACY' },
  { field: 'scicode', slug: 'scicode', name: 'SciCode', type: 'coding', task: 'Main', metric: 'PASS_RATE' },
  { field: 'terminalbenchHard', slug: 'terminal-bench-hard', name: 'Terminal-Bench Hard', type: 'agentic-coding', task: 'Hard', metric: 'SUCCESS_RATE' },
  { field: 'ifbench', slug: 'ifbench', name: 'IFBench', type: 'instruction-following', task: 'Main', metric: 'ACCURACY' },
  { field: 'mmmuPro', slug: 'mmmu-pro', name: 'MMMU-Pro', type: 'multimodal', task: 'Main', metric: 'ACCURACY' },
];

function parseModelsFromNextHtml(html: string): AaModel[] {
  const flight = parseNextFlight(html);
  const marker = '"models":[';
  let markerIndex = -1;
  let models: AaModel[] = [];
  do {
    markerIndex = flight.indexOf(marker, markerIndex + 1);
    if (markerIndex === -1) break;
    const arrayStart = markerIndex + marker.length - 1;
    const candidate = JSON.parse(extractBalancedArray(flight, arrayStart)) as AaModel[];
    const candidateCoverage = candidate.filter((model) =>
      METRICS.some((metric) => typeof model[metric.field] === 'number'),
    ).length;
    const currentCoverage = models.filter((model) =>
      METRICS.some((metric) => typeof model[metric.field] === 'number'),
    ).length;
    if (candidateCoverage > currentCoverage) models = candidate;
  } while (markerIndex !== -1);
  if (models.length === 0) throw new Error('Could not find scored models payload in Artificial Analysis page');
  if (models.length < 50) throw new Error(`Only ${models.length} models parsed; refusing a partial import`);
  return models;
}

async function fetchModels(): Promise<AaModel[]> {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': AA_USER_AGENT },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}`);
  return parseModelsFromNextHtml(await response.text());
}

/**
 * Collapse AA's per-effort-variant rows (e.g. `gpt-5`, `gpt-5-high`,
 * `gpt-5-xhigh`) into one official list-price reference per local model.
 * Variants share a price in nearly every case; when they do not, the minimum
 * non-null value wins so a premium reasoning tag can never masquerade as the
 * model's list price in the divergence audit.
 */
interface PriceReference {
  modelId: number;
  sourceModelSlug: string;
  inputPricePer1m: number | null;
  outputPricePer1m: number | null;
  cachedInputPricePer1m: number | null;
  raw: AaModel;
}

/**
 * AA slugs that must resolve to a differently-named local model. Verify
 * against the vendor pricing page before adding anything here.
 */
const PRICE_SLUG_ALIASES = new Map<string, string>([
  // The legacy deepseek-v4-flash model is retired and served by V4.1-Flash
  // (verified 2026-09-15, api-docs.deepseek.com/quick_start/pricing); AA still
  // carries both slugs, the legacy one at the retired $0.44/$1.32 rate.
  ['deepseek-v4-1-flash', 'deepseek-v4-flash'],
]);

/**
 * AA rows whose prices are known-stale snapshots that must not seed the
 * reference table, even though they map to a model we price.
 */
const PRICE_SLUG_IGNORE = new Set<string>([
  // Retired model kept at the old rate in AA; the V4.1 alias above supplies
  // the current list price.
  'deepseek-v4-flash',
]);

function buildPriceReferences(
  aaModels: AaModel[],
  bySlug: ReadonlyMap<string, { id: number }>,
): { references: PriceReference[]; unmatched: string[] } {
  const byModel = new Map<number, PriceReference>();
  const unmatched: string[] = [];
  for (const aaModel of aaModels) {
    if (aaModel.deprecated) continue;
    if (PRICE_SLUG_IGNORE.has(aaModel.slug)) continue;
    // MMDD snapshots (deepseek-v4-pro-0424) are older dated model versions with
    // their own prices, and non-reasoning is a separate SKU: either could
    // understate the current list price after min-merging, so never use them
    // as the official-price reference even when they map to a local model.
    if (/-(?:0[1-9]|1[0-2])\d{2}(?:-non-reasoning)?$/.test(aaModel.slug)) continue;
    if (/-non-reasoning$/.test(aaModel.slug)) continue;
    const input = typeof aaModel.price1mInputTokens === 'number' ? aaModel.price1mInputTokens : null;
    const output = typeof aaModel.price1mOutputTokens === 'number' ? aaModel.price1mOutputTokens : null;
    const cacheHit = typeof aaModel.cacheHitPrice === 'number' ? aaModel.cacheHitPrice : null;
    if (input === null && output === null) continue;
    const local = resolveLocalModelId(aaModel.slug, bySlug, PRICE_SLUG_ALIASES);
    if (!local) {
      unmatched.push(aaModel.slug);
      continue;
    }
    const existing = byModel.get(local.id);
    const mergeMin = (a: number | null, b: number | null) =>
      a === null ? b : b === null ? a : Math.min(a, b);
    if (!existing) {
      byModel.set(local.id, {
        modelId: local.id,
        sourceModelSlug: aaModel.slug,
        inputPricePer1m: input,
        outputPricePer1m: output,
        cachedInputPricePer1m: cacheHit,
        raw: aaModel,
      });
    } else {
      existing.inputPricePer1m = mergeMin(existing.inputPricePer1m, input);
      existing.outputPricePer1m = mergeMin(existing.outputPricePer1m, output);
      existing.cachedInputPricePer1m = mergeMin(existing.cachedInputPricePer1m, cacheHit);
    }
  }
  return { references: [...byModel.values()], unmatched };
}

async function upsertPriceReferences(references: PriceReference[], asOf: string): Promise<void> {
  if (references.length < 20) {
    throw new Error(`Only ${references.length} AA price references resolved; refusing a partial snapshot`);
  }
  await databaseSql.begin(async (transaction) => {
    // postgres@3 types TransactionSql as Omit<Sql, …>, which drops the
    // tagged-template call signature. Cast it back.
    const tx = transaction as unknown as typeof databaseSql;
    // Full-snapshot replacement: the representative AA variant per model can
    // change between runs, and a model can leave the leaderboard. Upserting
    // would leave stale rows behind in either case.
    await tx`DELETE FROM external_price_references WHERE source = 'artificial-analysis'`;
    const insertRows = references.map((ref) => ({
      source: 'artificial-analysis' as const,
      source_model_slug: ref.sourceModelSlug,
      model_id: ref.modelId,
      input_price_per_1m: ref.inputPricePer1m,
      output_price_per_1m: ref.outputPricePer1m,
      cached_input_price_per_1m: ref.cachedInputPricePer1m,
      currency: 'USD' as const,
      observed_date: asOf,
      raw: databaseSql.json(ref.raw as unknown as Record<string, unknown>),
    }));
    await tx`
      INSERT INTO external_price_references ${
        tx(insertRows,
          'source', 'source_model_slug', 'model_id', 'input_price_per_1m', 'output_price_per_1m',
          'cached_input_price_per_1m', 'currency', 'observed_date', 'raw')
      }
    `;
  });
}

async function ensureChain(spec: MetricSpec): Promise<{ taskId: number; metricId: number }> {
  const [benchmark] = await databaseSql<Array<{ id: number }>>`
    INSERT INTO benchmarks (name, slug, type, offical_url)
    VALUES (${spec.name}, ${spec.slug}, ${spec.type}, ${SOURCE_URL})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, offical_url = EXCLUDED.offical_url
    RETURNING id
  `;
  const [version] = await databaseSql<Array<{ id: number }>>`
    INSERT INTO benchmark_versions (benchmark_id, version_label, is_current, notes)
    SELECT ${benchmark.id}, ${VERSION_LABEL}, true, 'Results published in the Artificial Analysis model leaderboard'
    WHERE NOT EXISTS (
      SELECT 1 FROM benchmark_versions WHERE benchmark_id = ${benchmark.id} AND version_label = ${VERSION_LABEL}
    )
    RETURNING id
  `;
  const currentVersion = version || (await databaseSql<Array<{ id: number }>>`
    UPDATE benchmark_versions SET is_current = true
    WHERE benchmark_id = ${benchmark.id} AND version_label = ${VERSION_LABEL}
    RETURNING id
  `)[0];
  await databaseSql`UPDATE benchmark_versions SET is_current = false WHERE benchmark_id = ${benchmark.id} AND id <> ${currentVersion.id}`;

  const [task] = await databaseSql<Array<{ id: number }>>`
    INSERT INTO benchmark_tasks (benchmark_version_id, name)
    SELECT ${currentVersion.id}, ${spec.task}
    WHERE NOT EXISTS (
      SELECT 1 FROM benchmark_tasks WHERE benchmark_version_id = ${currentVersion.id} AND name = ${spec.task}
    )
    RETURNING id
  `;
  const taskId = task?.id || (await databaseSql<Array<{ id: number }>>`
    SELECT id FROM benchmark_tasks WHERE benchmark_version_id = ${currentVersion.id} AND name = ${spec.task} LIMIT 1
  `)[0].id;

  const [metric] = await databaseSql<Array<{ id: number }>>`
    INSERT INTO benchmark_metrics (name, unit, description, higher_better)
    SELECT ${spec.metric}, 'percent', ${`${spec.name} ${spec.metric} as reported by Artificial Analysis`}, true
    WHERE NOT EXISTS (SELECT 1 FROM benchmark_metrics WHERE name = ${spec.metric} AND unit = 'percent')
    RETURNING id
  `;
  const metricId = metric?.id || (await databaseSql<Array<{ id: number }>>`
    SELECT id FROM benchmark_metrics WHERE name = ${spec.metric} AND unit = 'percent' LIMIT 1
  `)[0].id;
  return { taskId, metricId };
}

async function main() {
  console.log(`\nArtificial Analysis benchmark import ${DRY_RUN ? '[DRY RUN]' : '[APPLY]'}\n`);
  const aaModels = await fetchModels();
  const withScores = aaModels.filter((model) => METRICS.some((metric) => typeof model[metric.field] === 'number'));
  const localModels = await databaseSql<Array<{ id: number; slug: string }>>`SELECT id, slug FROM models WHERE type ILIKE '%llm%'`;
  const bySlug = new Map(localModels.map((model) => [model.slug, model]));
  const { references: priceRefs, unmatched: unmatchedPriceSlugs } = buildPriceReferences(aaModels, bySlug);
  console.log(`Parsed ${aaModels.length} models; ${withScores.length} have at least one selected benchmark.`);
  console.log(`Official list-price references: ${priceRefs.length} mapped models, ${unmatchedPriceSlugs.length} priced AA rows unmatched.`);
  if (DRY_RUN) {
    console.log(withScores.slice(0, 12).map((model) => `${model.slug}: ${METRICS.filter((metric) => model[metric.field] != null).length} scores`).join('\n'));
    console.log(priceRefs.slice(0, 12).map((ref) => `${ref.sourceModelSlug}: in=$${ref.inputPricePer1m} out=$${ref.outputPricePer1m}`).join('\n'));
    return;
  }

  const chosen = new Map<number, AaModel>();
  const unmatched: string[] = [];
  for (const aaModel of withScores) {
    const local = resolveLocalModelId(aaModel.slug, bySlug);
    if (!local) {
      unmatched.push(aaModel.slug);
      continue;
    }
    const existing = chosen.get(local.id);
    if (!existing || (aaModel.intelligenceIndex ?? -Infinity) > (existing.intelligenceIndex ?? -Infinity)) {
      chosen.set(local.id, aaModel);
    }
  }

  const chains = new Map<string, { taskId: number; metricId: number }>();
  for (const spec of METRICS) chains.set(spec.slug, await ensureChain(spec));
  const asOf = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const [modelId, aaModel] of chosen) {
    for (const spec of METRICS) {
      const raw = aaModel[spec.field];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      const chain = chains.get(spec.slug)!;
      await upsertBenchmarkScore({
        model_id: modelId,
        benchmark_task_id: chain.taskId,
        metric_id: chain.metricId,
        value: raw * 100,
        release_date: asOf,
      });
      written += 1;
    }
  }
  await upsertPriceReferences(priceRefs, asOf);
  console.log(`Matched ${chosen.size} local models and processed ${written} benchmark scores.`);
  console.log(`Upserted ${priceRefs.length} official list-price references for the divergence audit.`);
  console.log(`Unmatched source models: ${unmatched.length}${unmatched.length ? ` (first 30: ${unmatched.slice(0, 30).join(', ')})` : ''}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => databaseSql.end());
