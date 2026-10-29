import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeRowShape, extractScoredModelsFromFlight, normalizeAaRow, parseScoredModelsFromHtml } from './aa-leaderboard-models';

// Trimmed from https://artificialanalysis.ai/leaderboards/models on 2026-10-20:
// scored rows now ride under "initialModels", split across two flight chunks,
// followed by a slug/name-only "models" array that has no scores.
const fixture = readFileSync(join(__dirname, 'fixtures', 'aa-leaderboard-models-2026-10-20.html'), 'utf8');

test('parses scored rows from the 2026-10-20 "initialModels" layout and ignores the unscored "models" array', () => {
  const { models, key } = parseScoredModelsFromHtml(fixture, { minModels: 1 });
  assert.equal(key, 'initialModels');
  assert.deepEqual(models.map((m) => m.slug), ['qwen3-5-omni-plus', 'qwen3-5-122b-a10b-non-reasoning', 'gemma-4-12b-non-reasoning']);
  assert.equal(typeof models[0].gpqa, 'number');
  assert.equal(typeof models[0].price1mInputTokens, 'number');
});

test('still parses the legacy "models" layout', () => {
  const rows = [{ slug: 'a', name: 'A', gpqa: 0.5 }, { slug: 'b', name: 'B', hle: 0.1 }];
  const flight = `{"models":[{"slug":"x","name":"X"}]}\n20:{"models":${JSON.stringify(rows)}}`;
  const { models, key } = extractScoredModelsFromFlight(flight, { minModels: 1 });
  assert.equal(key, 'models');
  assert.equal(models.length, 2);
});

test('falls back to any "<key>":[{"slug" array when the prop is renamed again', () => {
  const rows = [{ slug: 'a', name: 'A', ifbench: 0.4 }];
  const { models, key } = extractScoredModelsFromFlight(`{"leaderboardRows":${JSON.stringify(rows)}}`, { minModels: 1 });
  assert.equal(key, 'leaderboardRows');
  assert.equal(models[0].slug, 'a');
});

test('prefers the candidate with the most scored rows', () => {
  const few = [{ slug: 'a', gpqa: 0.1 }];
  const many = [{ slug: 'a', gpqa: 0.1 }, { slug: 'b', hle: 0.2 }, { slug: 'c' }];
  const { models } = extractScoredModelsFromFlight(`{"models":${JSON.stringify(few)},"initialModels":${JSON.stringify(many)}}`, { minModels: 1 });
  assert.equal(models.length, 3);
});

test('error lists every candidate tried when nothing has scores', () => {
  assert.throws(
    () => extractScoredModelsFromFlight('{"models":[{"slug":"x","name":"X"}],"initialModels":[]}'),
    (error: Error) => /Could not find scored models payload/.test(error.message)
      && /initialModels@\d+\(rows=0, scored=0\)/.test(error.message)
      && /models@\d+\(rows=1, scored=0\)/.test(error.message),
  );
});

test('refuses a partial import below the minimum row count', () => {
  assert.throws(() => parseScoredModelsFromHtml(fixture), /Only 3 models parsed from "initialModels"; refusing a partial import/);
});

// Trimmed from the live page on 2026-10-29: scores moved into a nested
// "scores" object keyed by eval slug; the flat gpqa/hle/... fields are gone.
const nestedFixture = readFileSync(join(__dirname, 'fixtures', 'aa-leaderboard-models-2026-10-29.html'), 'utf8');

test('parses the 2026-10-29 layout with scores nested under "scores" by eval slug', () => {
  const { models, key } = parseScoredModelsFromHtml(nestedFixture, { minModels: 1 });
  assert.equal(key, 'initialModels');
  assert.deepEqual(models.map((m) => m.slug), ['jt-35b-flash', 'gpt-5-3-codex', 'exaone-4-5-33b-non-reasoning']);
  const codex = models[1];
  assert.equal(codex.gpqa, 0.915151515151515);
  assert.equal(codex.hle, 0.424930491195551);
  assert.equal(codex.terminalbenchHard, 0.53030303030303);
  assert.equal(codex.ifbench, 0.753741496598639);
  assert.equal(codex.mmmuPro, 0.784971098265896);
  assert.equal(codex.scicode, undefined);
  assert.equal(codex.price1mInputTokens, 1.75);
});

test('normalizeAaRow keeps flat fields, ignores non-numeric and hle-diamond', () => {
  const row = normalizeAaRow({ slug: 'a', gpqa: 0.5, scores: { 'gpqa-diamond': 0.9, 'hle-diamond': 0.3, scicode: null, ifbench: 'x' } });
  assert.equal(row.gpqa, 0.5);
  assert.equal((row as { hle?: unknown }).hle, undefined);
  assert.equal((row as { scicode?: unknown }).scicode, undefined);
  assert.equal((row as { ifbench?: unknown }).ifbench, undefined);
  assert.equal(normalizeAaRow(null), null);
});

test('zero scored rows: error shows the sample row keys and nested object keys', () => {
  const rows = [{ slug: 'a', name: 'A', evals: { 'gpqa-v2': 0.5 } }];
  assert.throws(
    () => extractScoredModelsFromFlight(`{"models":[{"slug":"x","name":"X"},{"slug":"y"}],"initialModels":${JSON.stringify(rows)}}`),
    (error: Error) => /Sample row initialModels\[0\]: keys=slug,name,evals; nested evals\{gpqa-v2\}/.test(error.message)
      && /nested "scores" object/.test(error.message),
  );
  assert.equal(describeRowShape(null), 'non-object row (null)');
});
