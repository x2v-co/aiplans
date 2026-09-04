import { BarChart3, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { benchmarkValue, sortBenchmarks, type ModelBenchmarkScore } from '@/lib/benchmarks';

export default function ModelBenchmarkPanel({ scores, locale }: { scores: ModelBenchmarkScore[]; locale: string }) {
  const isZh = locale === 'zh';
  if (scores.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="benchmark-heading">
      <div className="mb-4">
        <h2 id="benchmark-heading" className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          {isZh ? '模型效果 Benchmark' : 'Model performance benchmarks'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {isZh
            ? '各分数保留原始评测、版本和指标口径，不合成为站内总分。不同版本的结果不应直接比较。'
            : 'Scores retain their original benchmark, version and metric. We do not combine them into a site-wide score; results from different versions are not directly comparable.'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sortBenchmarks(scores).map((score) => (
          <Card key={`${score.benchmark_slug}-${score.task_name}-${score.metric_name}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm leading-5">
                {score.official_url ? (
                  <a href={score.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-blue-600">
                    {score.benchmark_name}<ExternalLink className="h-3 w-3" />
                  </a>
                ) : score.benchmark_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{benchmarkValue(score, locale)}</div>
              <div className="mt-2 text-xs leading-5 text-zinc-500">
                <span className="block">{score.task_name}</span>
                <span className="block">{score.version_label} · {score.metric_name}</span>
                {score.release_date && <span className="block">{isZh ? '数据日期' : 'As of'} {score.release_date}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
