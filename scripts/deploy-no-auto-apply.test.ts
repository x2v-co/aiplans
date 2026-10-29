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

test('v1 publication is gated only on API scraper success', () => {
  const script = read('../deploy/production/run-scrapers.sh');
  assert.match(script, /if \[\[ "\$api_status" == "0" \]\]; then/);
  assert.doesNotMatch(script, /"\$(?:plans|fx)_status" == "0"/);
});

test('v1 publication precedes scraper group and mappings failure exits', () => {
  const script = read('../deploy/production/run-scrapers.sh');
  const publish = script.indexOf('npm run publish:v1');
  assert.ok(publish > 0);
  for (const message of ['Scraper group failure', 'model_plan_mapping materialization failed']) {
    const failure = script.indexOf(message);
    const exit = script.indexOf('\n  exit 1', failure);
    assert.ok(failure > publish && exit > failure, `${message} must exit after publication`);
  }
});

test('v1 publisher rejects empty offerings before writing any files', () => {
  const script = read('./publish-planprice-v1-snapshot.ts');
  const guard = script.match(/if \(offerings.length === 0\) \{([\s\S]*?)\n\}/);
  assert.ok(guard && guard.index !== undefined);
  assert.match(guard[1], /console\.error\(/);
  assert.match(guard[1], /process\.exitCode = 1;/);
  assert.match(guard[1], /return;/);
  assert.ok(guard.index < script.indexOf('await mkdir('));
  assert.ok(guard.index < script.indexOf('await atomicWrite('));
});

test('v1 publisher retains the FX file when fresh quotes are empty', () => {
  const script = read('./publish-planprice-v1-snapshot.ts');
  const branch = script.match(/if \(quotes.length === 0\) \{([\s\S]*?)\n\} else \{([\s\S]*?)\n\}/);
  assert.ok(branch && branch.index !== undefined);
  assert.match(branch[1], /console\.error\(/);
  assert.doesNotMatch(branch[1], /atomicWrite\(fxPath/);
  assert.match(branch[2], /await atomicWrite\(fxPath, fxSnapshot\);/);
  assert.equal((script.match(/atomicWrite\(fxPath/g) ?? []).length, 1);
  assert.ok(script.indexOf('await atomicWrite(snapshotPath, snapshot);') < branch.index);
  assert.match(script, /fxSnapshot: quotes.length === 0 \? 'retained' : 'written'/);
});
