#!/usr/bin/env tsx
/**
 * Seed source-backed benchmark scores for non-token vertical models.
 *
 * Current scope:
 * - Video: VBench / VBench++ public leaderboard scores that can be traced to
 *   the VBench Gradio leaderboard/config.
 * - Music / World: no comparable public leaderboard is seeded here yet. We do
 *   not invent scores where no standard public benchmark exists.
 */
import { db } from './db/queries';

const APPLY = process.argv.includes('--apply');
const VERIFIED_DATE = '2026-09-15';
const VBENCH_URL = 'https://vchitect-vbench-leaderboard.hf.space';

interface BenchmarkSeed {
  modelSlug: string;
  benchmark: {
    slug: string;
    name: string;
    type: string;
    officialUrl: string;
    versionLabel: string;
    notes: string;
  };
  task: string;
  releaseDate: string;
  sourceModelName: string;
  metrics: Array<{ name: string; unit: string; description: string; value: number }>;
}

interface ModelRow { id: number; slug: string; name: string }

const VBENCH = {
  slug: 'vbench',
  name: 'VBench',
  type: 'video',
  officialUrl: VBENCH_URL,
  versionLabel: `leaderboard-${VERIFIED_DATE}`,
  notes: 'Scores copied from the public VBench leaderboard. Values are percentages and must not be mixed with token/text benchmarks.',
};

const VBENCH_PLUS = {
  slug: 'vbench-plus',
  name: 'VBench++',
  type: 'video',
  officialUrl: VBENCH_URL,
  versionLabel: `leaderboard-${VERIFIED_DATE}`,
  notes: 'Scores copied from the public VBench++ leaderboard. Values are percentages and must not be mixed with token/text benchmarks.',
};

const SCORE_SEEDS: BenchmarkSeed[] = [
  // VBench text-to-video leaderboard rows, public Gradio config component 20.
  { modelSlug: 'vidu', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-04-21', sourceModelName: 'Vidu Q1 (2025-04-17)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 87.41 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 87.28 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 87.94 },
  ] },
  { modelSlug: 'wan-video', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-02-24', sourceModelName: 'Wan2.1 (2025-02-24)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 86.22 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 86.67 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 84.44 },
  ] },
  { modelSlug: 'veo', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-08-06', sourceModelName: 'Veo 3', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 85.06 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 85.70 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 82.49 },
  ] },
  { modelSlug: 'sora', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-01-14', sourceModelName: 'Sora', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 84.28 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 85.51 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 79.35 },
  ] },
  { modelSlug: 'luma-ray', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-01-14', sourceModelName: 'Luma', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 83.61 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 83.47 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 84.17 },
  ] },
  { modelSlug: 'kling', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2025-05-08', sourceModelName: 'Kling 1.6', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 83.40 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 85.00 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 76.99 },
  ] },
  { modelSlug: 'pika', benchmark: VBENCH, task: 'Text-to-video', releaseDate: '2024-07-29', sourceModelName: 'Pika-1.0 (2024-06)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench Total Score', value: 80.69 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench Quality Score', value: 82.92 },
    { name: 'SEMANTIC_SCORE', unit: 'percent', description: 'VBench Semantic Score', value: 71.77 },
  ] },
  // VBench++ text-to-video holistic leaderboard rows, public config component 41.
  { modelSlug: 'veo', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-09-04', sourceModelName: 'Veo 3', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 66.72 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 60.85 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 69.48 },
  ] },
  { modelSlug: 'vidu', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-04-21', sourceModelName: 'Vidu Q1 (2025-04-17)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 62.70 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 56.54 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 65.98 },
  ] },
  { modelSlug: 'wan-video', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-03-28', sourceModelName: 'Wan2.1', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 60.20 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 55.25 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 63.98 },
  ] },
  { modelSlug: 'seedance', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-06-26', sourceModelName: 'Seedance 1.0 Pro (2025-05-28)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 59.81 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 53.04 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 64.31 },
  ] },
  { modelSlug: 'kling', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-03-28', sourceModelName: 'Kling 1.6', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 59.00 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 48.58 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 65.45 },
  ] },
  { modelSlug: 'sora', benchmark: VBENCH_PLUS, task: 'Text-to-video holistic', releaseDate: '2025-03-28', sourceModelName: 'Sora-480p', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ Total Score', value: 58.38 },
    { name: 'CREATIVITY_SCORE', unit: 'percent', description: 'VBench++ Creativity Score', value: 60.57 },
    { name: 'COMMONSENSE_SCORE', unit: 'percent', description: 'VBench++ Commonsense Score', value: 64.32 },
  ] },

  // VBench++ image-to-video leaderboard, public config component 69.
  { modelSlug: 'wan-video', benchmark: VBENCH_PLUS, task: 'Image-to-video', releaseDate: '2026-02-12', sourceModelName: 'Wan2.2-TI2V-5B (Qwen prompt-optimized)', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ I2V Total Score', value: 88.80 },
    { name: 'I2V_SCORE', unit: 'percent', description: 'VBench++ I2V Score', value: 96.30 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench++ Quality Score', value: 81.30 },
  ] },
  { modelSlug: 'runway-gen-4', benchmark: VBENCH_PLUS, task: 'Image-to-video', releaseDate: '2025-05-20', sourceModelName: 'Gen-4-I2V', metrics: [
    { name: 'TOTAL_SCORE', unit: 'percent', description: 'VBench++ I2V Total Score', value: 88.27 },
    { name: 'I2V_SCORE', unit: 'percent', description: 'VBench++ I2V Score', value: 95.65 },
    { name: 'QUALITY_SCORE', unit: 'percent', description: 'VBench++ Quality Score', value: 80.89 },
  ] },
];

async function loadModels(): Promise<Map<string, ModelRow>> {
  const slugs = [...new Set(SCORE_SEEDS.map((seed) => seed.modelSlug))];
  const { data, error } = await db.from('models').select('id, slug, name').in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

async function ensureBenchmark(seed: BenchmarkSeed['benchmark']): Promise<number> {
  const { data, error } = await db.from('benchmarks').select('id').eq('slug', seed.slug).maybeSingle();
  if (error) throw error;
  if (data) return data.id as number;
  console.log(`  ➕ benchmark ${seed.slug}`);
  if (!APPLY) return -Math.floor(Math.random() * 1_000_000);
  const res = await db.from('benchmarks').insert({ name: seed.name, slug: seed.slug, type: seed.type, offical_url: seed.officialUrl }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as number;
}

async function ensureVersion(benchmarkId: number, seed: BenchmarkSeed['benchmark']): Promise<number> {
  const existing = benchmarkId > 0
    ? await db.from('benchmark_versions').select('id').eq('benchmark_id', benchmarkId).eq('version_label', seed.versionLabel).maybeSingle()
    : { data: null, error: null };
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as number;
  console.log(`    ➕ version ${seed.slug}/${seed.versionLabel}`);
  if (!APPLY) return -Math.floor(Math.random() * 1_000_000);
  await db.from('benchmark_versions').update({ is_current: false }).eq('benchmark_id', benchmarkId);
  const res = await db.from('benchmark_versions').insert({
    benchmark_id: benchmarkId,
    version_label: seed.versionLabel,
    release_date: VERIFIED_DATE,
    notes: seed.notes,
    is_current: true,
  }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as number;
}

async function ensureTask(versionId: number, taskName: string): Promise<number> {
  const existing = versionId > 0
    ? await db.from('benchmark_tasks').select('id').eq('benchmark_version_id', versionId).eq('name', taskName).maybeSingle()
    : { data: null, error: null };
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as number;
  console.log(`      ➕ task ${taskName}`);
  if (!APPLY) return -Math.floor(Math.random() * 1_000_000);
  const res = await db.from('benchmark_tasks').insert({ benchmark_version_id: versionId, name: taskName }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as number;
}

async function ensureMetric(metric: BenchmarkSeed['metrics'][number]): Promise<number> {
  const { data, error } = await db.from('benchmark_metrics').select('id').eq('name', metric.name).eq('unit', metric.unit).maybeSingle();
  if (error) throw error;
  if (data) return data.id as number;
  console.log(`      ➕ metric ${metric.name}/${metric.unit}`);
  if (!APPLY) return -Math.floor(Math.random() * 1_000_000);
  const res = await db.from('benchmark_metrics').insert({ name: metric.name, unit: metric.unit, description: metric.description, higher_better: true }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as number;
}

async function upsertScore(modelId: number, taskId: number, metricId: number, value: number, releaseDate: string) {
  if (taskId < 0 || metricId < 0) {
    console.log(`        ↳ score ${value}`);
    return;
  }
  const existing = await db
    .from('model_benchmark_scores')
    .select('id, value, release_date')
    .eq('model_id', modelId)
    .eq('benchmark_task_id', taskId)
    .eq('metric_id', metricId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    console.log(`        ↻ score ${value}`);
    if (APPLY) {
      const { error } = await db.from('model_benchmark_scores').update({ value, release_date: releaseDate }).eq('id', existing.data.id);
      if (error) throw error;
    }
    return;
  }
  console.log(`        ➕ score ${value}`);
  if (APPLY) {
    const { error } = await db.from('model_benchmark_scores').insert({ model_id: modelId, benchmark_task_id: taskId, metric_id: metricId, value, release_date: releaseDate });
    if (error) throw error;
  }
}

async function main() {
  console.log(`\n📊 seed-vertical-benchmarks ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (${SCORE_SEEDS.length} source rows)\n`);
  const models = await loadModels();
  const chainCache = new Map<string, { taskId: number; metrics: Map<string, number> }>();
  let processed = 0;
  let skipped = 0;

  for (const seed of SCORE_SEEDS) {
    const model = models.get(seed.modelSlug);
    if (!model) {
      console.log(`  ⚠ ${seed.modelSlug}: model missing; run seed:vertical-models first`);
      skipped++;
      continue;
    }
    const key = `${seed.benchmark.slug}:${seed.task}`;
    let chain = chainCache.get(key);
    if (!chain) {
      const benchmarkId = await ensureBenchmark(seed.benchmark);
      const versionId = await ensureVersion(benchmarkId, seed.benchmark);
      const taskId = await ensureTask(versionId, seed.task);
      chain = { taskId, metrics: new Map() };
      chainCache.set(key, chain);
    }
    console.log(`  ${model.slug} ← ${seed.benchmark.name} / ${seed.task} (${seed.sourceModelName})`);
    for (const metric of seed.metrics) {
      let metricId = chain.metrics.get(`${metric.name}:${metric.unit}`);
      if (!metricId) {
        metricId = await ensureMetric(metric);
        chain.metrics.set(`${metric.name}:${metric.unit}`, metricId);
      }
      await upsertScore(model.id, chain.taskId, metricId, metric.value, seed.releaseDate);
    }
    processed++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Processed source rows: ${processed}`);
  console.log(`Skipped: ${skipped}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply or npm run seed:vertical-benchmarks to write.');
  if (skipped > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
