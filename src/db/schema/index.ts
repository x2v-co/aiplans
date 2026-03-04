import { pgTable, serial, text, timestamp, boolean, integer, real, jsonb } from 'drizzle-orm/pg-core';

// Providers - AI service vendors
export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  website: text('website'),
  inviteUrl: text('invite_url'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Products - AI models/products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  providerId: integer('provider_id').references(() => providers.id),
  type: text('type').notNull(), // 'llm', 'subscription', 'coding_tool'
  description: text('description'),
  contextWindow: integer('context_window'), // in tokens
  benchmarkMmlu: real('benchmark_mmlu'),
  benchmarkHumanEval: real('benchmark_human_eval'),
  benchmarkArenaElo: real('benchmark_arena_elo'),
  releasedAt: timestamp('released_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Plans - Subscription plans
export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  pricingModel: text('pricing_model').notNull(), // 'subscription', 'token_pack', 'pay_as_you_go'
  price: real('price'),
  priceUnit: text('price_unit'), // 'month', 'year', '1m_tokens'
  tier: text('tier'), // 'free', 'basic', 'pro', 'team', 'enterprise'
  dailyMessageLimit: integer('daily_message_limit'),
  weeklyMessageLimit: integer('weekly_message_limit'),
  monthlyMessageLimit: integer('monthly_message_limit'),
  rateLimit: integer('rate_limit'), // requests per minute
  contextWindow: integer('context_window'),
  accessFromChina: boolean('access_from_china').default(true),
  paymentMethods: jsonb('payment_methods'), // ['alipay', 'wechat', 'credit_card']
  features: jsonb('features'),

  // Request limits
  requestsPerMinute: integer('requests_per_minute'), // RPM
  requestsPerDay: integer('requests_per_day'), // Daily request limit
  requestsPerMonth: integer('requests_per_month'), // Monthly request limit

  // QPS / Concurrency
  qps: integer('qps'), // Queries per second
  concurrentRequests: integer('concurrent_requests'), // Max concurrent requests

  // Token quota
  tokensPerMinute: integer('tokens_per_minute'), // TPM
  tokensPerDay: integer('tokens_per_day'),
  tokensPerMonth: integer('tokens_per_month'),
  maxTokensPerRequest: integer('max_tokens_per_request'), // Single request max tokens
  maxInputTokens: integer('max_input_tokens'),
  maxOutputTokens: integer('max_output_tokens'),

  // Yearly pricing
  priceYearlyMonthly: real('price_yearly_monthly'), // Annual price divided by 12
  yearlyDiscountPercent: real('yearly_discount_percent'), // Discount vs monthly

  // Plan metadata
  isOfficial: boolean('is_official').default(false), // Is this an official plan
  planTier: text('plan_tier'), // "free" | "tier1" | "tier2" | "tier3" | "enterprise" | "pay_as_you_go"
  billingGranularity: text('billing_granularity'), // "per_token" | "per_request" | "flat_monthly" | "flat_yearly" | "prepaid_pack"

  // Overage pricing
  hasOveragePricing: boolean('has_overage_pricing').default(false),
  overageInputPricePer1m: real('overage_input_price_per_1m'),
  overageOutputPricePer1m: real('overage_output_price_per_1m'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Channels - Third-party vendors/aggregators
export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  providerId: integer('provider_id').references(() => providers.id),
  type: text('type').notNull(), // 'official', 'cloud', 'aggregator', 'reseller'
  logo: text('logo'),
  website: text('website'),
  region: text('region'), // 'global', 'china'
  accessFromChina: boolean('access_from_china').default(true),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Channel Prices - Token prices per channel for each model
export const channelPrices = pgTable('channel_prices', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  channelId: integer('channel_id').references(() => channels.id),
  inputPricePer1m: real('input_price_per_1m'),
  outputPricePer1m: real('output_price_per_1m'),
  cachedInputPricePer1m: real('cached_input_price_per_1m'),
  rateLimit: integer('rate_limit'),
  isAvailable: boolean('is_available').default(true),
  lastVerified: timestamp('last_verified'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Models - Plan-model relationship table with override configurations
export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  providerId: integer('provider_id').references(() => providers.id),

  // Model-specific configuration
  isAvailable: boolean('is_available').default(true),
  isDefault: boolean('is_default').default(false),

  // Rate limit overrides
  overrideRpm: integer('override_rpm'),
  overrideQps: integer('override_qps'),
  overrideTpm: integer('override_tpm'),
  concurrentRequests: integer('concurrent_requests'),

  // Price overrides
  overrideInputPricePer1m: real('override_input_price_per_1m'),
  overrideOutputPricePer1m: real('override_output_price_per_1m'),
  cachedInputPricePer1m: real('cached_input_price_per_1m'),

  // Token limits
  maxInputTokens: integer('max_input_tokens'),
  maxOutputTokens: integer('max_output_tokens'),
  maxTokensPerRequest: integer('max_tokens_per_request'),

  // Metadata
  note: text('note'),
  displayOrder: integer('display_order'),
  displayName: text('display_name'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Price History - Price change tracking
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  channelPriceId: integer('channel_price_id').references(() => channelPrices.id),
  inputPricePer1m: real('input_price_per_1m'),
  outputPricePer1m: real('output_price_per_1m'),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Coupons - Discount codes
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  providerId: integer('provider_id').references(() => providers.id),
  description: text('description'),
  discountType: text('discount_type'), // 'percentage', 'fixed', 'trial'
  discountValue: real('discount_value'),
  expiresAt: timestamp('expires_at'),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Coupon Votes
export const couponVotes = pgTable('coupon_votes', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id').references(() => coupons.id),
  isUpvote: boolean('is_upvote').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Model-Plan Mapping - DEPRECATED: Use 'models' table instead
// Kept for backward compatibility during transition
export const modelPlanMapping = pgTable('old_model_plan_mapping', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  planId: integer('plan_id').references(() => plans.id).notNull(),
  overrideRpm: integer('override_rpm'),
  overrideQps: integer('override_qps'),
  overrideInputPricePer1m: real('override_input_price_per_1m'),
  overrideOutputPricePer1m: real('override_output_price_per_1m'),
  overrideMaxOutputTokens: integer('override_max_output_tokens'),
  isAvailable: boolean('is_available').default(true),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
