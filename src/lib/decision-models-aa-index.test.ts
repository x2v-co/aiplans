import assert from 'node:assert/strict';
import test from 'node:test';
import { AA_DECISION_INDEX, PERPLEXITY_DECIDER_V13_CATALOG } from './decision-models-2026-11-13';
import { catalogBenchmarks } from './vertical-model-detail';

test('Decider v1.3 carries the AA Decision Index v2.1 scores (70 / 64)', () => {
  const [pro, flash] = PERPLEXITY_DECIDER_V13_CATALOG;
  assert.equal(pro.benchmarkSummaries![0].value, 70);
  assert.equal(flash.benchmarkSummaries![0].value, 64);
  for (const item of [pro, flash]) {
    assert.equal(item.benchmarkSummaries![0].benchmarkName, 'Artificial Analysis Decision Index v2.1');
    assert.equal(item.benchmarkSummaries![0].officialUrl, AA_DECISION_INDEX);
  }
  const scores = catalogBenchmarks('decision-model', pro);
  assert.equal(scores.length, 1);
  assert.equal(scores[0].version_label, 'v2.1');
  assert.equal(scores[0].value, 70);
  assert.deepEqual(catalogBenchmarks('world-model', pro), []);
});
