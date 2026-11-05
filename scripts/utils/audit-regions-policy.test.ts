import assert from 'node:assert/strict';
import test from 'node:test';
import { regionSourceWarning, isRegionAdvisory } from './audit-regions-policy';
import { auditExitCode } from './audit-plan-policy';

test('country values (including empty) and legacy China claims without sources warn', () => {
  for (const supported_regions of [[], ['CN'], ['US']]) {
    assert.match(regionSourceWarning({ supported_regions })!, /regions_source_url/);
    assert.equal(regionSourceWarning({ supported_regions, regions_source_url: 'https://example.com/countries' }), null);
  }
  assert.match(regionSourceWarning({ access_from_china: true })!, /legacy China value/);
  assert.equal(regionSourceWarning({ access_from_china: false }), null);
  assert.equal(regionSourceWarning({}), null);
});

test('region source warnings stay advisory even in the strict gate', () => {
  const findings = [{ check: 'regions.missing_source', severity: 'warning' }];
  assert.equal(auditExitCode(false, findings.filter(f => !isRegionAdvisory(f)).length, true), 0);
  assert.equal(isRegionAdvisory({ check: 'plans.stale' }), false);
});
