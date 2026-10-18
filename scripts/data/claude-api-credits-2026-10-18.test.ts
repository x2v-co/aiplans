import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { MAX_API_CREDIT_NOTE } from './catalog-audit-2026-10-15';
import { claudeCreditNotes, claudeCreditSeedOptions, seedClaudeApiCredits } from './claude-api-credits-2026-10-18';

function fixture(plans: Array<Record<string, unknown>>) {
  const updates: unknown[][] = [];
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith("SELECT id FROM providers WHERE slug = 'anthropic'")) return Promise.resolve([{ id: 2 }]);
    if (q.startsWith('SELECT id, slug, notes')) return Promise.resolve(structuredClone(plans));
    if (q.startsWith('UPDATE plans SET')) { updates.push(values); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql;
  return { tx, updates };
}

const rows = [
  { id: 1, slug: 'claude-max-5x', notes: `Existing fact\n${MAX_API_CREDIT_NOTE}`, monthly_api_credit_usd: null, monthly_api_credit_status: 'needs-verification' },
  { id: 2, slug: 'claude-max-20x', notes: MAX_API_CREDIT_NOTE, monthly_api_credit_usd: null, monthly_api_credit_status: 'needs-verification' },
  { id: 3, slug: 'claude-team', notes: null, monthly_api_credit_usd: null, monthly_api_credit_status: null },
  { id: 4, slug: 'claude-team-premium', notes: null, monthly_api_credit_usd: null, monthly_api_credit_status: null },
];

test('dry-run reports verified amounts and writes nothing', async () => {
  const f = fixture(rows);
  const steps = await seedClaudeApiCredits(f.tx, false);
  assert.equal(f.updates.length, 0);
  assert.deepEqual(steps.map(s => [s.target, s.changes.monthly_api_credit_usd?.to]), [
    ['anthropic/claude-max-5x', 100], ['anthropic/claude-max-20x', 200], ['anthropic/claude-team', 20], ['anthropic/claude-team-premium', 100]]);
  assert.equal(steps[0].changes.monthly_api_credit_status.to, null);
});

test('apply drops needs-verification, keeps other notes, and is idempotent', async () => {
  const f = fixture(rows);
  await seedClaudeApiCredits(f.tx, true);
  assert.equal(f.updates.length, 4);
  const note = String(f.updates[0][2]);
  assert.match(note, /^Existing fact\n\[api-credit\] Includes \$100/);
  assert.doesNotMatch(note, /needs-verification/);
  assert.match(String(f.updates[2][2]), /capped at \$500/);
  assert.match(String(f.updates[2][2]), /excludes Claude Code/);
  const applied = rows.map((r, i) => ({ ...r, monthly_api_credit_usd: f.updates[i][0], monthly_api_credit_status: null, notes: f.updates[i][2] }));
  assert.deepEqual(await seedClaudeApiCredits(fixture(applied).tx, true), []);
  assert.equal(claudeCreditNotes(applied[0].notes, 'claude-max-5x'), applied[0].notes);
});

test('options reject unknown flags', () => {
  assert.equal(claudeCreditSeedOptions([]).apply, false);
  assert.throws(() => claudeCreditSeedOptions(['--force']));
});
