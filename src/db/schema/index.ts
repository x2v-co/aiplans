import { pgTable, serial, text, timestamp, boolean, integer, real, jsonb, bigint, varchar, numeric, date } from 'drizzle-orm/pg-core';

// Providers - AI service vendors
export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  logoUrl: text('logo_url'), // Alternative logo URL field
  website: text('website'),
  inviteUrl: text('invite_url'),
  description: text('description'),
  region: text('region').default('global'),
  currency: varchar('currency').default('USD'),
  pricingUrl: text('pricing_url'),
  apiDocsUrl: text('api_docs_url'),
  paymentMethods: jsonb('payment_methods').default([]),
  priority: integer('priority').default(2),
  type: text('type').default('official'), // 'official', 'cloud', 'aggregator', 'reseller'
  accessFromChina: boolean('access_from_china').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Models - AI models/products catalog (the actual products table)
export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type').notNull(), // 'llm', 'subscription', 'coding_tool'
  description: text('description'),
  contextWindow: integer('context_window'), // in tokens
  maxOutputTokens: bigint('max_output_tokens', { mode: 'number' }),
  openSource: boolean('open_source'),
  features: text('features').array(),
  officalLink: text('offical_link'),
  inputType: text('input_type').array(),
  outputType: text('output_type').array(),
  parameters: text('parameters'),
  activeParameters: text('active parameters'),
  providerIds: integer('provider_ids').array(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Plans - Subscription plans
export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  pricingModel: text('pricing_model').notNull(), // 'subscription', 'token_pack', 'pay_as_you_go'
  price: real('price'),
  priceUnit: text('price_unit'), // 'per_month', 'per_year', 'per_1m_tokens'
  annualPrice: real('annual_price'),
  tier: text('tier'), // 'free', 'basic', 'pro', 'team', 'enterprise'
  providerId: integer('provider_id').references(() => providers.id),
  productId: integer('product_id').references(() => providers.id), // References provider for plan ownership

  // Message limits
  dailyMessageLimit: integer('daily_message_limit'),
  weeklyMessageLimit: integer('weekly_message_limit'),
  monthlyMessageLimit: integer('monthly_message_limit'),
  fiveHoursMessageLimit: integer('5_hours_message_limit'),

  // Request limits
  rateLimit: integer('rate_limit'), // requests per minute
  requestsPerMinute: integer('requests_per_minute'), // RPM
  requestsPerDay: integer('requests_per_day'),
  requestsPerMonth: integer('requests_per_month'),

  // QPS / Concurrency
  qps: integer('qps'), // Queries per second
  concurrentRequests: integer('concurrent_requests'),

  // Token quota
  tokensPerMinute: integer('tokens_per_minute'), // TPM
  tokensPerDay: bigint('tokens_per_day', { mode: 'number' }),
  tokensPerMonth: bigint('tokens_per_month', { mode: 'number' }),
  maxTokensPerRequest: integer('max_tokens_per_request'),
  contextWindow: integer('context_window'),

  // Yearly pricing
  priceYearlyMonthly: real('price_yearly_monthly'), // Annual price divided by 12

  // Plan metadata
  isOfficial: boolean('is_official').default(false),
  planTier: text('plan_tier'), // "free" | "tier1" | "tier2" | "tier3" | "enterprise" | "pay_as_you_go"
  billingGranularity: text('billing_granularity'), // "per_token" | "per_request" | "flat_monthly" | "flat_yearly" | "prepaid_pack"

  // Overage pricing
  hasOveragePricing: boolean('has_overage_pricing').default(false),
  overageInputPricePer1m: real('overage_input_price_per_1m'),
  overageOutputPricePer1m: real('overage_output_price_per_1m'),

  // Regional & payment
  region: text('region').default('global'),
  accessFromChina: boolean('access_from_china').default(true),
  paymentMethods: jsonb('payment_methods'),
  features: jsonb('features'),
  currency: varchar('currency').default('USD'),
  lastVerified: timestamp('last_verified'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// API Channel Prices - Token prices per provider for each model
export const apiChannelPrices = pgTable('api_channel_prices', {
  id: serial('id').primaryKey(),
  modelId: integer('model_id').references(() => models.id), // References models table
  providerId: integer('provider_id').references(() => providers.id),
  inputPricePer1m: real('input_price_per_1m'),
  outputPricePer1m: real('output_price_per_1m'),
  cachedInputPricePer1m: real('cached_input_price_per_1m'),
  rateLimit: integer('rate_limit'),
  isAvailable: boolean('is_available').default(true),
  lastVerified: timestamp('last_verified', { withTimezone: true }),
  notes: text('notes'),
  currency: varchar('currency').default('USD'),
  priceUnit: varchar('price_unit').default('per_1m_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Model-Plan Mapping - Junction table between models and plans
// Schema verified: only has id, model_id, plan_id, priority, created_at
export const modelPlanMapping = pgTable('model_plan_mapping', {
  id: serial('id').primaryKey(),
  modelId: integer('model_id').references(() => models.id),
  planId: integer('plan_id').references(() => plans.id),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Model Official - Maps models to their official producers
export const modelOfficial = pgTable('model_offical', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  modelId: integer('model_id').references(() => models.id),
  producerId: integer('producer_id').references(() => providers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Benchmarks - Benchmark definitions
export const benchmarks = pgTable('benchmarks', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').unique(),
  slug: text('slug').unique(),
  type: text('type'),
  officalUrl: text('offical_url'),
  family: bigint('family', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Benchmark Versions - Different versions of benchmarks
export const benchmarkVersions = pgTable('benchmark_versions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  benchmarkId: bigint('benchmark_id', { mode: 'number' }).references(() => benchmarks.id),
  versionLabel: text('version_label').default('default'),
  releaseDate: date('release_date'),
  notes: text('notes'),
  isCurrent: boolean('is_current'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Benchmark Tasks - Actual benchmark tasks
export const benchmarkTasks = pgTable('benchmark_tasks', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  benchmarkVersionId: bigint('benchmark_version_id', { mode: 'number' }).references(() => benchmarkVersions.id),
  name: text('name').default('default'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Benchmark Metrics - Metrics for benchmarks
export const benchmarkMetrics = pgTable('benchmark_metrics', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name'),
  unit: text('unit'),
  description: text('description'),
  higherBetter: boolean('higher_better').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Model Benchmark Scores - Scores for models on benchmark tasks
export const modelBenchmarkScores = pgTable('model_benchmark_scores', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  modelId: integer('model_id').references(() => models.id),
  benchmarkTaskId: bigint('benchmark_task_id', { mode: 'number' }).references(() => benchmarkTasks.id),
  metricId: bigint('metric_id', { mode: 'number' }).references(() => benchmarkMetrics.id),
  value: real('value'),
  releaseDate: date('release_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Evaluation Run - Records of evaluation runs
export const evaluationRun = pgTable('evaluation_run', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  modelId: integer('model_id').references(() => models.id),
  benchmarkTaskId: bigint('benchmark_task_id', { mode: 'number' }).references(() => benchmarkTasks.id),
  providerId: integer('provider_id').references(() => providers.id),
  runDate: timestamp('run_date', { withTimezone: true }),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Coupons - Discount codes
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  providerId: integer('provider_id').references(() => providers.id),
  description: text('description'),
  discountType: text('discount_type'), // 'percentage', 'fixed', 'trial'
  discountValue: real('discount_value'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Exchange Rates - Currency conversion data
export const exchangeRates = pgTable('exchange_rates', {
  id: serial('id').primaryKey(),
  fromCurrency: varchar('from_currency').notNull(),
  toCurrency: varchar('to_currency').notNull(),
  rate: numeric('rate').notNull(),
  source: varchar('source').notNull(),
  isActive: boolean('is_active').default(true),
  validAt: timestamp('valid_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Scrape Logs - Track scraper runs
export const scrapeLogs = pgTable('scrape_logs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  status: text('status').notNull(), // 'success', 'partial', 'failed'
  modelsFound: integer('models_found'),
  pricesUpdated: integer('prices_updated'),
  errors: text('errors'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports for TypeScript
export type Provider = typeof providers.$inferSelect;
export type Model = typeof models.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type ApiChannelPrice = typeof apiChannelPrices.$inferSelect;
export type ModelPlanMapping = typeof modelPlanMapping.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type ScrapeLog = typeof scrapeLogs.$inferSelect;
export type Benchmark = typeof benchmarks.$inferSelect;
export type BenchmarkVersion = typeof benchmarkVersions.$inferSelect;
export type BenchmarkTask = typeof benchmarkTasks.$inferSelect;
export type BenchmarkMetric = typeof benchmarkMetrics.$inferSelect;
export type ModelBenchmarkScore = typeof modelBenchmarkScores.$inferSelect;
export type EvaluationRun = typeof evaluationRun.$inferSelect;

// Legacy aliases for backward compatibility
export const products = models; // Alias for backward compatibility
export const channelPrices = apiChannelPrices; // Alias for backward compatibility
export type Product = Model;
export type ChannelPrice = ApiChannelPrice;