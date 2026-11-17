import { sql } from 'drizzle-orm';
import { type AnyPgColumn, pgTable, text, integer, jsonb, numeric, timestamp, unique, check, foreignKey } from 'drizzle-orm/pg-core';
import { plans } from './index';
import type { Offer } from '../../lib/price-offers/contract';

// All identity columns are NOT NULL. Empty string/zero are explicit unknown/not-applicable
// sentinels and are validated against the structured identity by the writer.
export const planPriceOffers = pgTable('plan_price_offers', {
  id: text('id').primaryKey(), planId: integer('plan_id').notNull().references(() => plans.id),
  entitlementGroup: text('entitlement_group').notNull(), entitlementVersion: text('entitlement_version').notNull(),
  marketScope: text('market_scope').notNull(), marketCountry: text('market_country').notNull(),
  merchant: text('merchant').notNull(), channel: text('channel').notNull(), storefrontCountry: text('storefront_country').notNull(),
  billingPeriod: text('billing_period').notNull(), billingCount: integer('billing_count').notNull(),
  commitmentPeriod: text('commitment_period').notNull(), commitmentCount: integer('commitment_count').notNull(),
  unit: text('unit').notNull(), unitCount: integer('unit_count').notNull(),
  promotion: text('promotion').notNull(), promotionId: text('promotion_id').notNull(), eligibilityClass: text('eligibility_class').notNull(),
  // Unbounded numeric + scale/range CHECK avoids PostgreSQL typmod rounding intake.
  amount: numeric('amount'), currency: text('currency'),
  renewalOfferId: text('renewal_offer_id').references((): AnyPgColumn => planPriceOffers.id),
  snapshot: jsonb('snapshot').$type<Offer>().notNull(), revision: integer('revision').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
}, t => [
  unique('plan_price_offers_identity_unique').on(t.planId, t.entitlementGroup, t.entitlementVersion,
    t.marketScope, t.marketCountry, t.merchant, t.channel, t.storefrontCountry, t.billingPeriod, t.billingCount,
    t.commitmentPeriod, t.commitmentCount, t.unit, t.unitCount, t.promotion, t.promotionId, t.eligibilityClass),
  check('plan_price_offers_identity_check', sql.raw(`(
    plan_id > 0 AND plan_id <= 2147483647
    AND (entitlement_group = '') = (entitlement_version = '')
    AND market_scope IN ('country','international','unknown')
    AND ((market_scope = 'country' AND market_country ~ '^[A-Z]{2}$') OR (market_scope <> 'country' AND market_country = ''))
    AND channel IN ('website','app_store','google_play','reseller','unknown')
    AND (storefront_country = '' OR (channel IN ('app_store','google_play') AND storefront_country ~ '^[A-Z]{2}$'))
    AND billing_period IN ('month','year','day','one_time','unknown')
    AND ((billing_period = 'unknown' AND billing_count = 0) OR (billing_period <> 'unknown' AND billing_count BETWEEN 1 AND 1000000))
    AND (billing_period <> 'one_time' OR billing_count = 1)
    AND commitment_period IN ('month','year','day','none','unknown')
    AND ((commitment_period IN ('none','unknown') AND commitment_count = 0) OR (commitment_period NOT IN ('none','unknown') AND commitment_count BETWEEN 1 AND 1000000))
    AND unit IN ('account','seat','credit','unknown')
    AND ((unit = 'unknown' AND unit_count = 0) OR (unit <> 'unknown' AND unit_count BETWEEN 1 AND 1000000))
    AND promotion IN ('standard','intro','renewal','unknown')
    AND ((promotion IN ('standard','unknown') AND promotion_id = '') OR (promotion IN ('intro','renewal') AND promotion_id <> ''))
  ) IS TRUE`)),
  check('plan_price_offers_currency_check', sql.raw(`currency IS NULL OR currency IN ('CNY','USD','EUR','GBP','JPY','HKD','SGD','CAD','AUD','INR','KRW')`)),
  check('plan_price_offers_snapshot_check', sql.raw(`(
    jsonb_typeof(snapshot) = 'object' AND snapshot->>'id' = id
    AND snapshot->'identity' = jsonb_build_object(
      'planId', plan_id,
      'entitlementGroup', NULLIF(entitlement_group, ''),
      'entitlementVersion', NULLIF(entitlement_version, ''),
      'market', jsonb_build_object('scope', market_scope, 'country', NULLIF(market_country, '')),
      'merchant', NULLIF(merchant, ''),
      'channel', channel,
      'storefrontCountry', NULLIF(storefront_country, ''),
      'billing', jsonb_build_object('period', billing_period, 'count', NULLIF(billing_count, 0)),
      'commitment', jsonb_build_object('period', commitment_period, 'count', NULLIF(commitment_count, 0)),
      'unit', unit,
      'unitCount', NULLIF(unit_count, 0),
      'promotion', promotion,
      'promotionId', NULLIF(promotion_id, ''),
      'eligibilityClass', NULLIF(eligibility_class, '')
    )
    AND snapshot->>'renewalOfferId' IS NOT DISTINCT FROM renewal_offer_id
    AND (snapshot->'price'->>'amount')::numeric IS NOT DISTINCT FROM amount
    AND snapshot->'price'->>'currency' IS NOT DISTINCT FROM currency
    AND (snapshot->>'observedAt')::timestamptz = observed_at
    AND ((snapshot->'price'->>'kind' = 'priced' AND amount > 0)
      OR (snapshot->'price'->>'kind' = 'free' AND amount = 0)
      OR (snapshot->'price'->>'kind' IN ('sales','unknown') AND amount IS NULL))
  ) IS TRUE`)),
  check('plan_price_offers_revision_check', sql`${t.revision} > 0`),
  check('plan_price_offers_money_check', sql`(${t.amount} IS NULL OR (${t.amount} >= 0 AND ${t.amount} < 1000000000000
    AND ${t.currency} IN ('CNY','USD','EUR','GBP','JPY','HKD','SGD','CAD','AUD','INR','KRW')
    AND scale(${t.amount}) <= CASE WHEN ${t.currency} IN ('JPY','KRW') THEN 0 ELSE 2 END)) IS TRUE`),
]);

export const planPriceOfferRevisions = pgTable('plan_price_offer_revisions', {
  offerId: text('offer_id').notNull().references(() => planPriceOffers.id), revision: integer('revision').notNull(),
  snapshot: jsonb('snapshot').$type<Offer>().notNull(), recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('plan_price_offer_revisions_unique').on(t.offerId, t.revision),
  check('plan_price_offer_revisions_revision_check', sql`${t.revision} > 0`)]);

export const planPriceOfferSources = pgTable('plan_price_offer_sources', {
  offerId: text('offer_id').notNull(), revision: integer('revision').notNull(), id: text('id').notNull(),
  evidence: jsonb('evidence').$type<Offer['sources'][number]>().notNull(),
}, t => [
  unique('plan_price_offer_sources_unique').on(t.offerId, t.id),
  check('plan_price_offer_sources_id_check', sql`(${t.evidence}->>'id' = ${t.id}) IS TRUE`),
  foreignKey({ name: 'plan_price_offer_sources_revision_fk', columns: [t.offerId, t.revision],
    foreignColumns: [planPriceOfferRevisions.offerId, planPriceOfferRevisions.revision] }),
]);
