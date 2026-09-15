import type { AiBenchmarkSummary } from '@/lib/ai-vertical-catalog';

const VBENCH_URL = 'https://vchitect-vbench-leaderboard.hf.space';

const SUMMARY_BY_SLUG: Record<string, AiBenchmarkSummary[]> = {
  vidu: [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 87.41, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Text-to-video holistic', metricName: 'TOTAL_SCORE', unit: 'percent', value: 62.70, officialUrl: VBENCH_URL },
  ],
  'wan-video': [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 86.22, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Image-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 88.80, officialUrl: VBENCH_URL },
  ],
  veo: [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 85.06, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Text-to-video holistic', metricName: 'TOTAL_SCORE', unit: 'percent', value: 66.72, officialUrl: VBENCH_URL },
  ],
  sora: [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 84.28, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Text-to-video holistic', metricName: 'TOTAL_SCORE', unit: 'percent', value: 58.38, officialUrl: VBENCH_URL },
  ],
  'luma-ray': [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 83.61, officialUrl: VBENCH_URL },
  ],
  kling: [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 83.40, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Text-to-video holistic', metricName: 'TOTAL_SCORE', unit: 'percent', value: 59.00, officialUrl: VBENCH_URL },
  ],
  pika: [
    { benchmarkSlug: 'vbench', benchmarkName: 'VBench', taskName: 'Text-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 80.69, officialUrl: VBENCH_URL },
  ],
  seedance: [
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Text-to-video holistic', metricName: 'TOTAL_SCORE', unit: 'percent', value: 59.81, officialUrl: VBENCH_URL },
  ],
  'runway-gen-4': [
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Image-to-video', metricName: 'TOTAL_SCORE', unit: 'percent', value: 88.27, officialUrl: VBENCH_URL },
    { benchmarkSlug: 'vbench-plus', benchmarkName: 'VBench++', taskName: 'Image-to-video', metricName: 'I2V_SCORE', unit: 'percent', value: 95.65, officialUrl: VBENCH_URL },
  ],
};

export function verticalBenchmarkSummaryFallback(slug: string): AiBenchmarkSummary[] {
  return SUMMARY_BY_SLUG[slug] ?? [];
}
