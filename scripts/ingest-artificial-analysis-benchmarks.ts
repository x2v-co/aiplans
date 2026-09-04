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

function extractBalancedArray(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('Artificial Analysis model array was truncated');
}

function parseModelsFromNextHtml(html: string): AaModel[] {
  const chunks: string[] = [];
  const scriptPattern = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  for (const match of html.matchAll(scriptPattern)) {
    const payload = JSON.parse(match[1]) as [number, unknown];
    if (typeof payload[1] === 'string') chunks.push(payload[1]);
  }
  const flight = chunks.join('');
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

function slugCandidates(value: string): string[] {
  const base = value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  const candidates = new Set([base]);
  candidates.add(base.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2'));
  const suffixes = [/-reasoning$/, /-non-reasoning$/, /-thinking$/, /-preview$/, /-latest$/, /-\d{8}$/, /-\d{4}-\d{2}-\d{2}$/];
  for (let pass = 0; pass < 3; pass += 1) {
    for (const candidate of [...candidates]) {
      for (const suffix of suffixes) {
        const stripped = candidate.replace(suffix, '');
        if (stripped) candidates.add(stripped);
      }
      candidates.add(candidate.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2'));
    }
  }
  return [...candidates];
}

async function fetchModels(): Promise<AaModel[]> {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': 'aiplans.dev benchmark importer (+https://aiplans.dev/methodology)' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}`);
  return parseModelsFromNextHtml(await response.text());
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
  console.log(`Parsed ${aaModels.length} models; ${withScores.length} have at least one selected benchmark.`);
  if (DRY_RUN) {
    console.log(withScores.slice(0, 12).map((model) => `${model.slug}: ${METRICS.filter((metric) => model[metric.field] != null).length} scores`).join('\n'));
    return;
  }

  const localModels = await databaseSql<Array<{ id: number; slug: string }>>`SELECT id, slug FROM models WHERE type ILIKE '%llm%'`;
  const bySlug = new Map(localModels.map((model) => [model.slug, model]));
  const chosen = new Map<number, AaModel>();
  const unmatched: string[] = [];
  for (const aaModel of withScores) {
    const local = slugCandidates(aaModel.slug).map((slug) => bySlug.get(slug)).find(Boolean);
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
  console.log(`Matched ${chosen.size} local models and processed ${written} benchmark scores.`);
  console.log(`Unmatched source models: ${unmatched.length}${unmatched.length ? ` (first 30: ${unmatched.slice(0, 30).join(', ')})` : ''}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => databaseSql.end());
