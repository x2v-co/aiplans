import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn, bigint, boolean, check, date, index, integer, jsonb, numeric,
  pgTable, serial, text, timestamp, unique, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { plans } from './index';

export const usageMixes = pgTable('usage_mixes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cacheReadPct: numeric('cache_read_pct').notNull(),
  inputPct: numeric('input_pct').notNull(),
  outputPct: numeric('output_pct').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('usage_mixes_percentages', sql`${table.cacheReadPct} >= 0 AND ${table.inputPct} >= 0 AND ${table.outputPct} >= 0 AND ${table.cacheReadPct} + ${table.inputPct} + ${table.outputPct} = 100`),
]);

export const quotaEstimates = pgTable('quota_estimates', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').references(() => plans.id),
  planSlug: text('plan_slug').notNull(),
  servedModel: text('served_model'),
  window: text('window').notNull(),
  estTokensLow: bigint('est_tokens_low', { mode: 'bigint' }).notNull(),
  estTokensHigh: bigint('est_tokens_high', { mode: 'bigint' }).notNull(),
  usageMixId: text('usage_mix_id').notNull().references(() => usageMixes.id),
  confidence: text('confidence').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  notes: text('notes'),
  isCurrent: boolean('is_current').notNull().default(true),
  supersededBy: integer('superseded_by').references((): AnyPgColumn => quotaEstimates.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('quota_estimates_window', sql`${table.window} IN ('5h', 'daily', 'weekly', 'monthly')`),
  check('quota_estimates_tokens', sql`${table.estTokensLow} >= 0 AND ${table.estTokensLow} <= ${table.estTokensHigh}`),
  check('quota_estimates_confidence', sql`${table.confidence} IN ('high', 'medium', 'low')`),
  check('quota_estimates_supersession', sql`${table.supersededBy} IS NULL OR (${table.supersededBy} <> ${table.id} AND NOT ${table.isCurrent})`),
  uniqueIndex('quota_estimates_current_idx').on(table.planSlug, sql`COALESCE(${table.servedModel}, '')`, table.window, table.usageMixId).where(sql`${table.isCurrent}`),
  index('quota_estimates_history_idx').on(table.planSlug, table.createdAt.desc()),
]);

export const quotaEvidence = pgTable('quota_evidence', {
  id: serial('id').primaryKey(),
  quotaEstimateId: integer('quota_estimate_id').references(() => quotaEstimates.id),
  // Source-level pending evidence may cover several plans; assign during review.
  planSlug: text('plan_slug'),
  evidenceType: text('evidence_type').notNull(),
  url: text('url'),
  capturedAt: date('captured_at').notNull().default(sql`CURRENT_DATE`),
  rawValue: text('raw_value'),
  screenshotUrl: text('screenshot_url'),
  notes: text('notes'),
}, (table) => [
  check('quota_evidence_type', sql`${table.evidenceType} IN ('self_measured', 'official_absolute', 'official_text', 'community', 'derived')`),
  index('quota_evidence_estimate_idx').on(table.quotaEstimateId),
]);

export const quotaTextSnapshots = pgTable('quota_text_snapshots', {
  id: serial('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  url: text('url').notNull(),
  contentHash: text('content_hash').notNull(),
  extractedText: text('extracted_text').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  changed: boolean('changed').notNull().default(false),
  alertedAt: timestamp('alerted_at', { withTimezone: true }),
}, (table) => [
  unique('quota_text_snapshots_source_hash_unique').on(table.sourceId, table.contentHash),
  index('quota_text_snapshots_latest_idx').on(table.sourceId, table.fetchedAt.desc(), table.id.desc()),
]);

export type UsageMix = typeof usageMixes.$inferSelect;
export type QuotaEstimate = typeof quotaEstimates.$inferSelect;
export type QuotaEvidence = typeof quotaEvidence.$inferSelect;
export type QuotaTextSnapshot = typeof quotaTextSnapshots.$inferSelect;

export const quotaUsageSamples = pgTable('quota_usage_samples', {
  id: serial('id').primaryKey(),
  planSlug: text('plan_slug').notNull(),
  collector: text('collector').notNull(),
  // Opaque local alias only; never copy an email or account identifier from logs.
  accountLabel: text('account_label').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  window: text('window').notNull(),
  windowMinutes: integer('window_minutes'),
  resetsAt: timestamp('resets_at', { withTimezone: true }),
  usedPct: numeric('used_pct'),
  tokensInput: bigint('tokens_input', { mode: 'bigint' }),
  tokensCached: bigint('tokens_cached', { mode: 'bigint' }),
  tokensCacheWrite: bigint('tokens_cache_write', { mode: 'bigint' }),
  tokensOutput: bigint('tokens_output', { mode: 'bigint' }),
  tokensReasoning: bigint('tokens_reasoning', { mode: 'bigint' }),
  model: text('model'),
  raw: jsonb('raw'),
  confidence: text('confidence').notNull().default('high'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('quota_usage_samples_collector', sql`${table.collector} IN ('codex-log', 'ccusage', 'cursor-dashboard', 'grok-bot', 'claude-usage')`),
  check('quota_usage_samples_account_label', sql`${table.accountLabel} ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'`),
  check('quota_usage_samples_window', sql`${table.window} IN ('5h', 'daily', 'weekly', 'monthly')`),
  check('quota_usage_samples_window_minutes', sql`${table.windowMinutes} > 0`),
  check('quota_usage_samples_used_pct', sql`${table.usedPct} >= 0 AND ${table.usedPct} <= 100`),
  check('quota_usage_samples_tokens', sql`${table.tokensInput} >= 0 AND ${table.tokensCached} >= 0 AND ${table.tokensCacheWrite} >= 0 AND ${table.tokensOutput} >= 0 AND ${table.tokensReasoning} >= 0`),
  check('quota_usage_samples_confidence', sql`${table.confidence} IN ('high', 'medium', 'low')`),
  unique('quota_usage_samples_observation_unique').on(table.collector, table.accountLabel, table.observedAt, table.window),
  index('quota_usage_samples_plan_observed_idx').on(table.planSlug, table.observedAt.desc()),
]);

export type QuotaUsageSample = typeof quotaUsageSamples.$inferSelect;
