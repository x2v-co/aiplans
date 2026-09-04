import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkKey, benchmarkValue, sortBenchmarks, type ModelBenchmarkScore } from './benchmarks';

const score = (overrides: Partial<ModelBenchmarkScore>): ModelBenchmarkScore => ({
  benchmark_slug: 'gpqa-diamond',
  benchmark_name: 'GPQA Diamond',
  benchmark_type: 'reasoning',
  official_url: 'https://example.com',
  version_label: 'current',
  task_name: 'Diamond',
  metric_name: 'ACCURACY',
  unit: 'percent',
  higher_better: true,
  value: 87.45,
  release_date: '2026-09-04',
  ...overrides,
});

test('benchmark identity includes version, task and metric', () => {
  assert.notEqual(benchmarkKey(score({})), benchmarkKey(score({ version_label: 'v2' })));
  assert.notEqual(benchmarkKey(score({})), benchmarkKey(score({ metric_name: 'PASS@1' })));
});

test('formats percentage and ELO metrics without mixing scales', () => {
  assert.equal(benchmarkValue(score({ value: 87.45 }), 'en'), '87.5%');
  assert.equal(benchmarkValue(score({ unit: 'ELO', value: 1477.7 }), 'en'), '1,478');
});

test('uses a stable task-oriented display order', () => {
  const sorted = sortBenchmarks([
    score({ benchmark_slug: 'mmmu-pro', benchmark_name: 'MMMU-Pro' }),
    score({ benchmark_slug: 'scicode', benchmark_name: 'SciCode' }),
    score({ benchmark_slug: 'gpqa-diamond' }),
  ]);
  assert.deepEqual(sorted.map((item) => item.benchmark_slug), ['gpqa-diamond', 'scicode', 'mmmu-pro']);
});
