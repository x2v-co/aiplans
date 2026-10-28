import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('deploy paths never write plan kinds or mappings', () => {
  for (const file of ['../deploy/production/rollout.sh', '../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(read(file), /mappings:materialize:apply|materialize-model-plan-mappings\.ts --apply|npm run fix:kinds(?!:dry-run)/);
  }
});

test('scheduled scrapers only apply mappings behind PLAN_MAPPINGS_APPLY=1', () => {
  const script = read('../deploy/production/run-scrapers.sh');
  const applyBranch = script.indexOf('elif [[ "${PLAN_MAPPINGS_APPLY:-0}" == "1" ]]; then');
  const dryBranch = script.indexOf('\nelse\n', applyBranch);
  assert.ok(applyBranch > 0 && dryBranch > applyBranch);
  const outside = script.slice(0, applyBranch) + script.slice(dryBranch);
  assert.doesNotMatch(outside, /mappings:materialize:apply|npm run fix:kinds(?!:dry-run)/);
  for (const unit of ['planprice-scraper.service', 'planprice-api-scraper.service']) {
    assert.doesNotMatch(read(`../deploy/production/${unit}`), /PLAN_MAPPINGS_APPLY/);
  }
});

test('reviewed OpenAI writes require their own explicit opt-in, independently of paused legacy scrapers', () => {
  const script = read('../deploy/production/run-scrapers.sh');
  const start = script.indexOf('if [[ "${OPENAI_REVIEW_APPLY:-0}" == "1" ]]; then');
  const end = script.indexOf('\nfi', start);
  assert.ok(start > 0 && end > start);
  assert.match(script.slice(start, end), /refresh-openai-plans\.ts --apply/);
  assert.doesNotMatch(script.slice(0, start) + script.slice(end), /refresh-openai-plans\.ts --apply/);
  assert.match(script, /"\$openai_review_status" != "0"/);
});
