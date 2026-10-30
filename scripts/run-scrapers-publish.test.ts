import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../deploy/production/run-scrapers.sh', import.meta.url));

function runScrapers(overrides: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), 'run-scrapers-publish-'));
  try {
    const envFile = join(directory, 'env');
    const docker = join(directory, 'docker');
    const log = join(directory, 'calls.log');
    writeFileSync(envFile, '');
    writeFileSync(log, '');
    writeFileSync(docker, String.raw`#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_LOG"
if [[ "$NPM_CONFIG_UPDATE_NOTIFIER" != "false" ]]; then
  echo 'npm update notifier must be disabled' >&2
  exit 99
fi
case " $* " in
  *" scraper npm run audit ")
    if [[ "$STUB_AUDIT_SUMMARY" == "1" ]]; then
      echo '🟡 plans.mapping_drift  (2)'
      echo '   · materialized mappings lag the selector (+1 not linked, −1 stale)'
      if [[ "$STUB_AUDIT_EXIT" != "0" && "$STUB_AUDIT_EXIT" != "2" ]]; then
        echo '🔴 prices.zero_or_null  (25)'
        echo 'Total: 30 findings  (🔴 25 critical  🟡 5 warnings)'
      else
        echo 'Total: 5 findings  (🔴 0 critical  🟡 5 warnings)'
      fi
    fi
    exit "$STUB_AUDIT_EXIT"
    ;;
  *" scraper npm run scrape ") exit "$STUB_API_EXIT" ;;
  *" scraper npm run scrape:plans ") exit "$STUB_PLANS_EXIT" ;;
  *" scraper npm run refresh:fx ") exit "$STUB_FX_EXIT" ;;
  *" scraper npm run mappings:materialize:dry-run ")
    echo '  ✓  provider/unchanged: 3 derived, unchanged'
    if [[ "$STUB_MAPPING_DRIFT" == "1" ]]; then
      echo '  🔧 provider/added [coding]: 2 → 3 derived'
      echo '      + new-model'
      echo '  🔧 provider/reordered [coding]: 3 → 3 derived'
      echo '      (same models, new priority order: model-a, model-b…)'
    fi
    exit "$STUB_MAPPINGS_EXIT"
    ;;
  *" scraper npm run publish:v1 ") exit "$STUB_PUBLISH_EXIT" ;;
esac
exit 0
`, { mode: 0o755 });

    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        ENV_FILE: envFile,
        LOCK_PATH: directory,
        COMPOSE_FILE: join(directory, 'compose.yml'),
        DOCKER_CMD: docker,
        SKIP_API: '0',
        SKIP_PLANS: '0',
        SKIP_PLAN_MAPPINGS: '0',
        SKIP_AUDIT: '0',
        SKIP_ARENA: '0',
        SKIP_BENCHMARKS: '0',
        SKIP_CODING_AGENTS: '0',
        PLAN_MAPPINGS_APPLY: '0',
        OPENAI_REVIEW_APPLY: '0',
        NPM_CONFIG_UPDATE_NOTIFIER: 'true', // The runner must override this.
        STUB_LOG: log,
        STUB_API_EXIT: '0',
        STUB_AUDIT_EXIT: '0',
        STUB_PUBLISH_EXIT: '0',
        STUB_PLANS_EXIT: '0',
        STUB_FX_EXIT: '0',
        STUB_AUDIT_SUMMARY: '1',
        STUB_MAPPING_DRIFT: '0',
        STUB_MAPPINGS_EXIT: '0',
        ...overrides,
      },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('scheduled scraper publication and audit failures', async (t) => {
  if (spawnSync('bash', ['-c', 'command -v flock'], { stdio: 'ignore' }).status !== 0) {
    t.skip('flock is not on PATH');
    return;
  }

  await t.test('publishes before reporting critical audit findings and preserves audit status', () => {
    const result = runScrapers({ STUB_AUDIT_EXIT: '1' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Publishing v1: api=0 plans=0 fx=0 openai_review=0 audit=1/);
    assert.match(result.stderr, /Data audit reported critical findings \(exit 1\): Total:.*25 critical/);
    assert.match(result.stderr, /^🔴 prices\.zero_or_null  \(25\)$/m);
    assert.doesNotMatch(result.stderr, /🔴 plans\.mapping_drift/);
    assert.match(result.stderr, /Exiting with audit status 1 \(critical findings; v1 publication was not blocked\)/);
    assert.match(result.stdout, /plans\.mapping_drift/);
    const audit = result.calls.findIndex((call) => call.endsWith('scraper npm run audit'));
    const publish = result.calls.findIndex((call) => call.endsWith('scraper npm run publish:v1'));
    assert.ok(audit >= 0 && publish > audit, 'audit must run before publication');
  });

  for (const audit of ['2', '0']) {
    await t.test(`publishes and succeeds with audit exit ${audit}`, () => {
      const result = runScrapers({ STUB_AUDIT_EXIT: audit });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
      assert.match(result.stderr, /Publishing v1:/);
      assert.doesNotMatch(result.stderr, /Data audit reported critical findings|Exiting with audit status/);
    });
  }

  await t.test('skips publication after an API failure and reports the audit before exiting', () => {
    const result = runScrapers({ STUB_API_EXIT: '1', STUB_AUDIT_EXIT: '1' });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(!result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.match(result.stderr, /Skipping v1 catalog publication: api=1 plans=0 fx=0 audit=1/);
    assert.match(result.stderr, /prices\.zero_or_null/);
    assert.match(result.stderr, /25 critical/);
    const summary = result.stderr.indexOf('Data audit reported critical findings');
    assert.ok(summary >= 0 && summary < result.stderr.indexOf('Scraper group failure'));
  });

  await t.test('publishes when the audit crashes without a summary and preserves its exit code', () => {
    const result = runScrapers({ STUB_AUDIT_EXIT: '7', STUB_AUDIT_SUMMARY: '0' });
    assert.equal(result.status, 7, result.stderr);
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.match(result.stderr, /audit exited 7 with no parsable summary/);
  });

  await t.test('reports critical findings before a publication failure exits with 1', () => {
    const result = runScrapers({ STUB_AUDIT_EXIT: '7', STUB_PUBLISH_EXIT: '3' });
    assert.equal(result.status, 1, result.stderr);
    const summary = result.stderr.indexOf('Data audit reported critical findings');
    assert.ok(summary >= 0 && summary < result.stderr.indexOf('v1 catalog publication failed (3)'));
  });

  await t.test('logs retained plans and FX when publishing despite those failures', () => {
    const result = runScrapers({ STUB_PLANS_EXIT: '1', STUB_FX_EXIT: '1' });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.match(result.stderr, /Publishing v1: api=0 plans=1 fx=1 openai_review=0 audit=0; previous plans\/FX data retained/);
  });

  await t.test('preserves SKIP_AUDIT behavior', () => {
    const result = runScrapers({ SKIP_AUDIT: '1', STUB_AUDIT_EXIT: '1' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.calls.some((call) => /scraper npm run audit$|scraper sh -c/.test(call)));
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.match(result.stdout, /SKIP_AUDIT=1/);
    assert.doesNotMatch(result.stderr, /Data audit reported critical findings/);
  });

  await t.test('mapping drift alone succeeds, publishes, and reports changed plans including priority changes', () => {
    const result = runScrapers({ STUB_MAPPING_DRIFT: '1' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^mapping drift: 2 plan\(s\) need PLAN_MAPPINGS_APPLY=1$/m);
    assert.match(result.stdout, /🟡 plans\.mapping_drift  \(2\)/);
    assert.match(result.stdout, /materialized mappings lag the selector/);
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run mappings:materialize:dry-run')));
    assert.ok(!result.calls.some((call) => call.endsWith('scraper npm run mappings:materialize:apply')));
    assert.doesNotMatch(result.stderr, /critical findings|Exiting with audit status/);
  });

  await t.test('other critical checks still fail when mapping drift is present', () => {
    const result = runScrapers({ STUB_MAPPING_DRIFT: '1', STUB_AUDIT_EXIT: '1' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /mapping drift: 2 plan\(s\)/);
    assert.match(result.stderr, /🔴 prices\.zero_or_null/);
    assert.match(result.stderr, /Exiting with audit status 1/);
  });

  await t.test('no materialization diff produces no drift summary', () => {
    const result = runScrapers({});
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /^mapping drift:/m);
  });

  for (const overrides of [{ SKIP_PLAN_MAPPINGS: '1' }, { PLAN_MAPPINGS_APPLY: '1' }]) {
    await t.test(`does not preview drift with ${Object.keys(overrides)[0]}=1`, () => {
      const result = runScrapers({ ...overrides, STUB_MAPPING_DRIFT: '1' });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!result.calls.some((call) => call.endsWith('scraper npm run mappings:materialize:dry-run')));
      assert.doesNotMatch(result.stdout, /^mapping drift:/m);
    });
  }

  await t.test('materializer failure survives output capture and still fails after publication', () => {
    const result = runScrapers({ STUB_MAPPINGS_EXIT: '3' });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.calls.some((call) => call.endsWith('scraper npm run publish:v1')));
    assert.match(result.stderr, /model_plan_mapping materialization failed \(3\)/);
  });
});

test('scraper Compose environment passes the npm notifier setting into the container', () => {
  const compose = readFileSync(new URL('../deploy/production/compose.yml', import.meta.url), 'utf8');
  assert.match(compose.slice(compose.indexOf('\n  scraper:')), /NPM_CONFIG_UPDATE_NOTIFIER: \$\{NPM_CONFIG_UPDATE_NOTIFIER:-false\}/);
});
