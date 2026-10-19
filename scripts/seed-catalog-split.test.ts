import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const codeLines = (source: string) => source.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');

const CATALOG_SEED = /seed:vertical-models|seed:vertical-pricing|seed:vertical-logos|seed:vertical-benchmarks|seed:verified-creative-plans|audit:verticals:db/;

test('app release does not run catalog seeds', () => {
  const rollout = codeLines(read('../deploy/production/rollout.sh'));
  const deploy = codeLines(read('../.github/workflows/deploy-production.yml'));
  assert.doesNotMatch(rollout, CATALOG_SEED);
  assert.doesNotMatch(deploy, CATALOG_SEED);
  assert.doesNotMatch(deploy, /seed-catalog\.sh/);
  assert.match(rollout, /npm run migrate|run --rm --no-deps migrate/);
  assert.match(rollout, /npm run refresh:fx/);
  assert.match(rollout, /npm run publish:v1/);
  assert.match(deploy, /\.github\/workflows\/seed-catalog\.yml/);
});

test('manual catalog seed is dispatch-only and backs up before apply', () => {
  const workflow = read('../.github/workflows/seed-catalog.yml');
  const onBlock = workflow.slice(workflow.indexOf('on:'), workflow.indexOf('permissions:'));
  assert.match(onBlock, /workflow_dispatch:/);
  assert.doesNotMatch(onBlock, /push:|schedule:|pull_request:/);
  assert.match(workflow, /runs-on: \[self-hosted, planprice-production\]/);
  assert.match(workflow, /SEED_APPLY" == "true"/);
  assert.doesNotMatch(workflow, /ubuntu-latest/);

  const script = read('../deploy/production/seed-catalog.sh');
  const dry = script.indexOf('# --- dry-run');
  const backup = script.indexOf('# --- backup');
  const apply = script.indexOf('# --- apply');
  assert.ok(dry > 0 && backup > dry && apply > backup);
  const dryBlock = script.slice(dry, backup);
  const backupBlock = script.slice(backup, apply);
  const applyBlock = script.slice(apply);
  assert.match(dryBlock, /diff\.txt/);
  assert.match(dryBlock, /seed:vertical-logos:dry-run/);
  assert.match(dryBlock, /seed:verified-creative-plans:dry-run/);
  assert.match(dryBlock, /seed:vertical-benchmarks:dry-run/);
  assert.doesNotMatch(dryBlock, /--apply/);
  assert.match(backupBlock, /pg_dump/);
  assert.match(backupBlock, /backup\.dump/);
  assert.match(backupBlock, /PGDMP/);
  assert.match(backupBlock, /backup\.sha256/);
  assert.match(applyBlock, /seed:vertical-models -- --apply/);
  assert.match(applyBlock, /seed:vertical-pricing -- --apply/);
  assert.match(applyBlock, /seed:vertical-logos -- --apply/);
  assert.match(applyBlock, /seed:verified-creative-plans -- --apply/);
  assert.match(applyBlock, /seed:vertical-benchmarks -- --apply/);
  assert.match(applyBlock, /audit:verticals:db/);
  assert.ok(applyBlock.indexOf('seed:vertical-models -- --apply') < applyBlock.indexOf('seed:vertical-logos -- --apply'));
  assert.ok(applyBlock.indexOf('seed:vertical-logos -- --apply') < applyBlock.indexOf('seed:vertical-pricing -- --apply'));
  assert.ok(applyBlock.indexOf('seed:vertical-pricing -- --apply') < applyBlock.indexOf('seed:verified-creative-plans -- --apply'));
  assert.ok(applyBlock.indexOf('seed:verified-creative-plans -- --apply') < applyBlock.indexOf('seed:vertical-benchmarks -- --apply'));
  assert.ok(applyBlock.indexOf('seed:vertical-benchmarks -- --apply') < applyBlock.indexOf('audit:verticals:db'));

  const checklist = read('../docs/launch-sample-checklist.md');
  assert.match(checklist, /PVTI_lADOCjTjeM4Bmp6-zhBoNQ4/);
  assert.match(checklist, /reczz28OutRhFfyW/);
  assert.match(checklist, /omnihuman-2-0/);
  assert.match(checklist, /backup\.dump/);
  assert.match(checklist, /diff\.txt/);
});

test('seed-catalog.sh rejects bad arguments before docker', () => {
  const script = new URL('../deploy/production/seed-catalog.sh', import.meta.url);
  const help = spawnSync('bash', [script.pathname, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /dry-run/);
  assert.match(help.stdout, /pg_dump/);

  const badFlag = spawnSync('bash', [script.pathname, '--apply=true'], { encoding: 'utf8' });
  assert.notEqual(badFlag.status, 0);
  assert.match(`${badFlag.stderr}`, /unknown argument/);

  const badSlug = spawnSync('bash', [script.pathname, '--slug', 'Omni Human'], { encoding: 'utf8' });
  assert.equal(badSlug.status, 2);
  assert.match(`${badSlug.stderr}`, /invalid --slug/);
  assert.doesNotMatch(`${badSlug.stdout}${badSlug.stderr}`, /backup\.dump/);
});
