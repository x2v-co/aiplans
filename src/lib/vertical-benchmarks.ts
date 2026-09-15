import { sql } from '@/lib/db';
import type { AiBenchmarkSummary } from '@/lib/ai-vertical-catalog';
import type { ModelBenchmarkScore } from '@/lib/benchmarks';

export async function getVerticalBenchmarkScores(modelId: number): Promise<ModelBenchmarkScore[]> {
  return sql<ModelBenchmarkScore[]>`
    SELECT
      b.slug AS benchmark_slug,
      b.name AS benchmark_name,
      b.type AS benchmark_type,
      b.offical_url AS official_url,
      bv.version_label,
      bt.name AS task_name,
      bm.name AS metric_name,
      bm.unit,
      bm.higher_better,
      s.value,
      s.release_date::text AS release_date,
      s.model_id AS source_model_id,
      m.slug AS source_model_slug
    FROM model_benchmark_scores s
    JOIN models m ON m.id = s.model_id
    JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
    JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id AND bv.is_current = true
    JOIN benchmarks b ON b.id = bv.benchmark_id
    JOIN benchmark_metrics bm ON bm.id = s.metric_id
    WHERE s.model_id = ${modelId} AND s.value IS NOT NULL
    ORDER BY b.name ASC, bt.name ASC, bm.name ASC
  `;
}

export async function getVerticalBenchmarkSummary(modelId: number): Promise<AiBenchmarkSummary[]> {
  const scores = await getVerticalBenchmarkScores(modelId);
  return scores
    .filter((score) => score.metric_name === 'TOTAL_SCORE' || score.metric_name === 'I2V_SCORE')
    .sort((a, b) => {
      const aMetricOrder = a.metric_name === 'TOTAL_SCORE' ? 0 : a.metric_name === 'I2V_SCORE' ? 1 : 2;
      const bMetricOrder = b.metric_name === 'TOTAL_SCORE' ? 0 : b.metric_name === 'I2V_SCORE' ? 1 : 2;
      return aMetricOrder - bMetricOrder || a.benchmark_name.localeCompare(b.benchmark_name) || a.task_name.localeCompare(b.task_name);
    })
    .slice(0, 2)
    .map((score) => ({
      benchmarkSlug: score.benchmark_slug,
      benchmarkName: score.benchmark_name,
      taskName: score.task_name,
      metricName: score.metric_name,
      unit: score.unit,
      value: score.value,
      officialUrl: score.official_url,
    }));
}
