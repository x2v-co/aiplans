import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { quotaEstimates, quotaEvidence, quotaTextSnapshots, usageMixes } from './index';

const sql = readFileSync(new URL('../../../drizzle/0005_quota_estimates.sql', import.meta.url), 'utf8');
// Keep quoted literals together: the descriptions contain semicolons.
const statements = [...sql.replace(/--[^\n]*/g, '').matchAll(/(?:'(?:''|[^'])*'|[^;'])+/g)]
  .map(([statement]) => statement.trim()).filter(Boolean);
const tables = new Map(statements.flatMap((statement) => {
  const match = statement.match(/^CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*)\)$/);
  return match ? [[match[1], match[2]] as const] : [];
}));

test('migration creates only the four new tables, new indexes and idempotent mix seeds', () => {
  assert.deepEqual([...tables.keys()], ['usage_mixes', 'quota_estimates', 'quota_evidence', 'quota_text_snapshots']);
  for (const statement of statements) {
    assert.match(statement, /^(CREATE TABLE IF NOT EXISTS|CREATE (?:UNIQUE )?INDEX IF NOT EXISTS|INSERT INTO usage_mixes)/);
  }
  assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(sql, /\b(?:ALTER|DROP|DELETE|TRUNCATE|UPDATE)\b/i);
});

test('mix seed values are our assumptions and are nonnegative percentages summing to 100', () => {
  const seeds = [...sql.matchAll(/\('(coding-high-cache|chat)', '[^']+', ([\d.]+), ([\d.]+), ([\d.]+),/g)]
    .map((match) => [match[1], ...match.slice(2).map(Number)]);
  assert.deepEqual(seeds, [['coding-high-cache', 97, 2.5, 0.5], ['chat', 0, 75, 25]]);
  assert.match(sql, /Our own assumption for typical chat/);
  assert.match(tables.get('usage_mixes')!, /cache_read_pct \+ input_pct \+ output_pct = 100/);
  for (const column of ['cache_read_pct', 'input_pct', 'output_pct']) {
    assert.match(tables.get('usage_mixes')!, new RegExp(`${column} numeric NOT NULL`));
    assert.match(tables.get('usage_mixes')!, new RegExp(`${column} >= 0`));
  }
});

test('estimates preserve versions and enforce ranges, windows, confidence and foreign keys', () => {
  const table = tables.get('quota_estimates')!;
  assert.match(table, /plan_id integer REFERENCES plans\(id\)/);
  assert.match(table, /plan_slug text NOT NULL/);
  assert.match(table, /served_model text,/);
  assert.match(table, /"window" IN \('5h', 'daily', 'weekly', 'monthly'\)/);
  assert.match(table, /est_tokens_low bigint NOT NULL/);
  assert.match(table, /est_tokens_high bigint NOT NULL/);
  assert.match(table, /est_tokens_low >= 0 AND est_tokens_low <= est_tokens_high/);
  assert.match(table, /usage_mix_id text NOT NULL REFERENCES usage_mixes\(id\)/);
  assert.match(table, /confidence IN \('high', 'medium', 'low'\)/);
  assert.match(table, /superseded_by integer REFERENCES quota_estimates\(id\)/);
  assert.match(table, /is_current boolean NOT NULL DEFAULT true/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS quota_estimates_current_idx[\s\S]*?WHERE is_current/);
});

test('evidence supports pending source-level review; snapshots uniquely dedupe by source and hash', () => {
  assert.match(tables.get('quota_evidence')!, /quota_estimate_id integer REFERENCES quota_estimates\(id\)/);
  assert.match(tables.get('quota_evidence')!, /evidence_type IN \('self_measured', 'official_absolute', 'official_text', 'community', 'derived'\)/);
  assert.match(tables.get('quota_evidence')!, /captured_at date NOT NULL/);
  assert.match(tables.get('quota_text_snapshots')!, /UNIQUE \(source_id, content_hash\)/);
  assert.match(tables.get('quota_text_snapshots')!, /alerted_at timestamptz/);
  assert.match(tables.get('quota_text_snapshots')!, /fetched_at timestamptz NOT NULL/);
});

test('exported Drizzle tables match migration names, constraint and index names', () => {
  for (const table of [usageMixes, quotaEstimates, quotaEvidence, quotaTextSnapshots]) {
    const config = getTableConfig(table);
    const body = tables.get(config.name);
    assert.ok(body);
    for (const column of config.columns) assert.match(body, new RegExp(`\\b${column.name}\\b`));
    for (const constraint of [...config.checks, ...config.uniqueConstraints]) assert.ok(sql.includes(constraint.name!));
    for (const index of config.indexes) assert.ok(sql.includes(index.config.name!));
    // Resolve lazy references as well, catching broken/circular schema exports.
    for (const fk of config.foreignKeys) assert.ok(fk.reference().foreignColumns.length > 0);
  }
});
