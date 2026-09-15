#!/usr/bin/env tsx
/**
 * Seed source-backed benchmark scores for non-token vertical models.
 *
 * Current scope:
 * - Video: VBench / VBench++ public leaderboard scores that can be traced to
 *   the VBench Gradio leaderboard/config, plus Arena AI public video ranks.
 * - Music / World: no comparable public leaderboard is seeded here yet. Arena AI
 *   currently exposes video/image/search/chat/webdev ranks, not audio/music.
 */
import { db } from './db/queries';
import { ARENA_TEXT_TO_VIDEO_LEADERBOARD, ARENA_TEXT_TO_VIDEO_URL, arenaVideoSlug } from '../src/lib/arena-video-leaderboard';

const APPLY = process.argv.includes('--apply');
const VERIFIED_DATE = '2026-09-15';
const VBENCH_URL = 'https://vchitect-vbench-leaderboard.hf.space';
const ARENA_URL = ARENA_TEXT_TO_VIDEO_URL;

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
  metrics: Array<{ name: string; unit: string; description: string; value: number; higherBetter?: boolean }>;
}

interface ModelRow { id: number; slug: string; name: string }

const ORG_PROVIDER: Record<string, { slug: string; name: string; website?: string }> = {
  Google: { slug: 'google', name: 'Google', website: 'https://deepmind.google/' },
  Alibaba: { slug: 'qwen', name: 'Alibaba / Qwen', website: 'https://tongyi.aliyun.com/' },
  Bytedance: { slug: 'volcengine', name: 'ByteDance / Volcano Engine', website: 'https://www.volcengine.com/' },
  OpenAI: { slug: 'openai', name: 'OpenAI', website: 'https://openai.com/' },
  Runway: { slug: 'runway', name: 'Runway', website: 'https://runwayml.com/' },
  KlingAI: { slug: 'kuaishou', name: 'Kuaishou / Kling', website: 'https://klingai.com/' },
  'Luma AI': { slug: 'luma-ai', name: 'Luma AI', website: 'https://lumalabs.ai/' },
  MiniMax: { slug: 'minimax-china', name: 'MiniMax', website: 'https://www.minimaxi.com/' },
  Pika: { slug: 'pika', name: 'Pika', website: 'https://pika.art/' },
  Meta: { slug: 'meta', name: 'Meta', website: 'https://ai.meta.com/' },
  'Black Forest Labs': { slug: 'bfl', name: 'Black Forest Labs', website: 'https://blackforestlabs.ai/' },
  SpaceXAI: { slug: 'xai', name: 'xAI', website: 'https://x.ai/' },
  'Genmo AI': { slug: 'genmo', name: 'Genmo', website: 'https://www.genmo.ai/' },
};

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

const ARENA_AI_TEXT_TO_VIDEO = {
  slug: 'arena-ai-text-to-video',
  name: 'Arena AI Text-to-Video',
  type: 'video',
  officialUrl: ARENA_URL,
  versionLabel: `leaderboard-${VERIFIED_DATE}`,
  notes: 'Ranks and Elo ratings copied from the public Arena AI text-to-video leaderboard.entries payload. Entries are version-level rows; lower rank is better. Do not collapse them into family-level catalog rows.',
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

  ...ARENA_TEXT_TO_VIDEO_LEADERBOARD.map((entry): BenchmarkSeed => ({
    modelSlug: arenaVideoSlug(entry.modelDisplayName),
    benchmark: ARENA_AI_TEXT_TO_VIDEO,
    task: 'Text-to-video leaderboard',
    releaseDate: VERIFIED_DATE,
    sourceModelName: entry.modelDisplayName,
    metrics: [
      { name: 'ARENA_RANK', unit: 'rank', description: 'Arena AI text-to-video leaderboard rank', value: entry.rank, higherBetter: false },
      { name: 'ARENA_ELO', unit: 'elo', description: 'Arena AI text-to-video Elo rating', value: entry.rating },
      { name: 'VOTES', unit: 'count', description: 'Arena AI text-to-video vote count', value: entry.votes },
    ],
  })),
];

async function ensureProvider(slug: string, name: string, website?: string): Promise<number> {
  const { data, error } = await db.from('providers').select('id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data) return data.id as number;
  console.log(`  ➕ provider ${slug}`);
  if (!APPLY) return -Math.floor(Math.random() * 1_000_000);
  const res = await db.from('providers').insert({ slug, name, website, type: 'official', region: 'global', access_from_china: true }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as number;
}

async function ensureArenaLeaderboardModels() {
  for (const entry of ARENA_TEXT_TO_VIDEO_LEADERBOARD) {
    const provider = ORG_PROVIDER[entry.modelOrganization] ?? { slug: arenaVideoSlug(entry.modelOrganization || 'unknown'), name: entry.modelOrganization || 'Unknown' };
    const providerId = await ensureProvider(provider.slug, provider.name, provider.website);
    const slug = arenaVideoSlug(entry.modelDisplayName);
    const description = `Version-level text-to-video leaderboard entry from Arena AI. Status: available. Pricing confidence: unknown. Last verified: ${VERIFIED_DATE}. Notes: Arena AI rank #${entry.rank}; Elo ${entry.rating.toFixed(1)}; votes ${entry.votes}. This is not collapsed into a family-level model. Sources: Arena AI: ${ARENA_URL}${entry.modelUrl ? ` | ${entry.modelOrganization}: ${entry.modelUrl}` : ''}`;
    const existing = await db.from('models').select('id').eq('slug', slug).maybeSingle();
    if (existing.error) throw existing.error;
    const payload = {
      name: entry.modelDisplayName,
      type: 'video',
      model_category: 'video',
      description,
      offical_link: entry.modelUrl ?? ARENA_URL,
      input_modalities: ['text'],
      output_modalities: ['video'],
      capabilities: ['leaderboard-version', 'text-to-video'],
      pricing_unit: 'unknown',
      open_source: entry.license ? /apache|mit|open/i.test(entry.license) : false,
      provider_ids: [providerId],
    };
    if (existing.data) {
      console.log(`  ↻ arena model ${slug}`);
      if (APPLY) {
        const { error } = await db.from('models').update(payload).eq('id', existing.data.id);
        if (error) throw error;
      }
    } else {
      console.log(`  ➕ arena model ${slug}`);
      if (APPLY) {
        const { error } = await db.from('models').insert({ slug, ...payload });
        if (error) throw error;
      }
    }
  }
}

async function disableLegacyArenaFamilyBenchmark() {
  const { data, error } = await db.from('benchmarks').select('id').eq('slug', 'arena-ai-video').maybeSingle();
  if (error) throw error;
  if (!data) return;
  console.log('  ↻ disabling legacy series-level arena-ai-video benchmark versions');
  if (APPLY) {
    const { error: updateError } = await db.from('benchmark_versions').update({ is_current: false }).eq('benchmark_id', data.id);
    if (updateError) throw updateError;
  }
}

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
  const res = await db.from('benchmark_metrics').insert({ name: metric.name, unit: metric.unit, description: metric.description, higher_better: metric.higherBetter ?? true }).select('id').single();
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
  await disableLegacyArenaFamilyBenchmark();
  await ensureArenaLeaderboardModels();
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
