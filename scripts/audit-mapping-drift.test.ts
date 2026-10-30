import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { auditExitCode } from './utils/audit-plan-policy';

// Run the actual C18 block with in-memory rows, avoiding audit-data.ts's
// top-level database/network work. This block contains no TypeScript syntax.
const audit = readFileSync(new URL('./audit-data.ts', import.meta.url), 'utf8');
const start = audit.indexOf('    if (MAPPING_SOURCES) {');
const end = audit.indexOf('\n  }\n\n  // ---------- C20:', start);
assert.ok(start >= 0 && end > start, 'C18 audit block must exist');
const check = audit.slice(start, end);

type Finding = {
  check: string;
  severity: string;
  message: string;
  ref: { missing: string[]; stale: string[] };
};

function auditMappings(rows: { model_id: number; source: string }[]): Finding[] {
  const findings: Finding[] = [];
  runInNewContext(check, {
    MAPPING_SOURCES: true,
    resolution: { models: [{ id: 1, slug: 'current-model' }] },
    mappingsByPlan: new Map([[10, rows]]),
    modelById: new Map([[2, { slug: 'stale-model' }]]),
    pl: { id: 10 },
    ref: { plan: 'coding-plan#10', provider: 'provider' },
    add: (check: string, severity: string, message: string, ref: Finding['ref']) => {
      findings.push({ check, severity, message, ref });
    },
  });
  return findings;
}

test('C18 retains drift counts and examples as warnings that pass the scheduled audit', () => {
  const findings = auditMappings([
    { model_id: 2, source: 'derived' },
    { model_id: 3, source: 'manual' },
  ]);
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.equal(finding.check, 'plans.mapping_drift');
  assert.equal(finding.severity, 'warning');
  assert.match(finding.message, /\+1 not linked, −1 stale/);
  assert.deepEqual(Array.from(finding.ref.missing), ['current-model']);
  assert.deepEqual(Array.from(finding.ref.stale), ['stale-model']);
  const hasCritical = findings.some(f => f.severity === 'critical');
  assert.equal(auditExitCode(hasCritical, findings.length, false), 0);
  assert.equal(auditExitCode(hasCritical, findings.length, true), 2);
  assert.equal(auditExitCode(true, findings.length + 1, false), 1);
});

test('C18 accepts a matching manual link and leaves curated exceptions out of stale examples', () => {
  assert.deepEqual(auditMappings([
    { model_id: 1, source: 'manual' },
    { model_id: 2, source: 'manual' },
  ]), []);
});
