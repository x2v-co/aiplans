import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { quotaUsageSamples } from './index';

const migration = readFileSync(new URL('../../../drizzle/0013_quota_usage_samples.sql', import.meta.url), 'utf8');

test('0013 is manual, additive, isolated from 0012 and the migration runner', () => {
  const statements = migration.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /^CREATE TABLE IF NOT EXISTS quota_usage_samples/);
  assert.match(statements[1], /^CREATE INDEX IF NOT EXISTS quota_usage_samples_plan_observed_idx/);
  assert.doesNotMatch(migration, /\b(?:ALTER|DROP|UPDATE|DELETE|TRUNCATE|INSERT)\b/i);
  const runner = readFileSync(new URL('../../../scripts/migrate-data-accuracy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(runner, /0013_quota_usage_samples|CREATE TABLE.*quota_usage_samples/);
  const journal = readFileSync(new URL('../../../drizzle/meta/_journal.json', import.meta.url), 'utf8');
  assert.doesNotMatch(journal, /0013_quota_usage_samples/);
});

test('sample schema matches SQL columns, constraints, defaults and identity', () => {
  const config = getTableConfig(quotaUsageSamples);
  assert.equal(config.name, 'quota_usage_samples');
  for (const column of config.columns) assert.match(migration, new RegExp(`\\b${column.name}\\b`));
  for (const constraint of [...config.checks, ...config.uniqueConstraints]) assert.ok(migration.includes(constraint.name!));
  for (const index of config.indexes) assert.ok(migration.includes(index.config.name!));
  assert.match(migration, /UNIQUE \(collector, account_label, observed_at, "window"\)/);
  assert.match(migration, /used_pct >= 0 AND used_pct <= 100/);
  assert.match(migration, /confidence text NOT NULL DEFAULT 'high'/);
  assert.match(migration, /confidence IN \('high', 'medium', 'low'\)/);
  assert.match(migration, /'codex-log', 'ccusage', 'cursor-dashboard', 'grok-bot', 'claude-usage'/);
  assert.match(migration, /"window" IN \('5h', 'daily', 'weekly', 'monthly'\)/);
  assert.match(migration, /account_label ~ '\^\[A-Za-z0-9\]/);
  for (const name of ['input', 'cached', 'cache_write', 'output', 'reasoning']) {
    assert.match(migration, new RegExp(`tokens_${name} bigint`));
    assert.match(migration, new RegExp(`tokens_${name} >= 0`));
  }
});
