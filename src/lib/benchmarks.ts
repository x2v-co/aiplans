export interface ModelBenchmarkScore {
  benchmark_slug: string;
  benchmark_name: string;
  benchmark_type: string | null;
  official_url: string | null;
  version_label: string;
  task_name: string;
  metric_name: string;
  unit: string | null;
  higher_better: boolean;
  value: number;
  release_date: string | null;
  source_model_id?: number;
  source_model_slug?: string;
}

const DISPLAY_ORDER = [
  'arena-agent',
  'gpqa-diamond',
  'humanitys-last-exam',
  'scicode',
  'terminal-bench-hard',
  'ifbench',
  'mmmu-pro',
];

export function benchmarkKey(score: ModelBenchmarkScore): string {
  return [score.benchmark_slug, score.version_label, score.task_name, score.metric_name].join('::');
}

export function sortBenchmarks(scores: ModelBenchmarkScore[]): ModelBenchmarkScore[] {
  return [...scores].sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a.benchmark_slug);
    const bi = DISPLAY_ORDER.indexOf(b.benchmark_slug);
    const aOrder = ai === -1 ? DISPLAY_ORDER.length : ai;
    const bOrder = bi === -1 ? DISPLAY_ORDER.length : bi;
    return aOrder - bOrder || a.benchmark_name.localeCompare(b.benchmark_name);
  });
}

export function benchmarkValue(score: ModelBenchmarkScore, locale = 'en'): string {
  const value = Number(score.value);
  if (!Number.isFinite(value)) return '—';
  if (score.unit === 'percent' || score.unit === '%') {
    return `${value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 1 })}%`;
  }
  if (score.unit?.toLowerCase() === 'elo') return Math.round(value).toLocaleString();
  return value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 });
}

export function isArenaBenchmark(score: ModelBenchmarkScore): boolean {
  return score.benchmark_slug.startsWith('arena-');
}
