-- PR1 DEFINITION ONLY. Explicit coordinator migration review/execution required.
-- Not added to an automatic runner/journal. No backfill, legacy price mutation or API price_history use.
-- NOT NULL identity sentinels: '' = unknown/not applicable text; 0 = unknown/not applicable count.
-- Application validates evidence and state; SQL protects complete identity, amount and snapshot coherence.
CREATE TABLE plan_price_offers (
  id text PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES plans(id),
  entitlement_group text NOT NULL,
  entitlement_version text NOT NULL,
  market_scope text NOT NULL,
  market_country text NOT NULL,
  merchant text NOT NULL,
  channel text NOT NULL,
  storefront_country text NOT NULL,
  billing_period text NOT NULL,
  billing_count integer NOT NULL,
  commitment_period text NOT NULL,
  commitment_count integer NOT NULL,
  unit text NOT NULL,
  unit_count integer NOT NULL,
  promotion text NOT NULL,
  promotion_id text NOT NULL,
  eligibility_class text NOT NULL,
  amount numeric,
  currency text,
  renewal_offer_id text REFERENCES plan_price_offers(id),
  snapshot jsonb NOT NULL,
  revision integer NOT NULL,
  observed_at timestamptz NOT NULL,
  CONSTRAINT plan_price_offers_revision_check CHECK (revision > 0),
  CONSTRAINT plan_price_offers_identity_unique UNIQUE (plan_id, entitlement_group, entitlement_version, market_scope, market_country, merchant, channel, storefront_country, billing_period, billing_count, commitment_period, commitment_count, unit, unit_count, promotion, promotion_id, eligibility_class),
  CONSTRAINT plan_price_offers_identity_check CHECK ((
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
  ) IS TRUE),
  CONSTRAINT plan_price_offers_money_check CHECK ((amount IS NULL OR (amount >= 0 AND amount < 1000000000000
    AND currency IN ('CNY','USD','EUR','GBP','JPY','HKD','SGD','CAD','AUD','INR','KRW')
    AND scale(amount) <= CASE WHEN currency IN ('JPY','KRW') THEN 0 ELSE 2 END)) IS TRUE),
  CONSTRAINT plan_price_offers_currency_check CHECK (currency IS NULL OR currency IN ('CNY','USD','EUR','GBP','JPY','HKD','SGD','CAD','AUD','INR','KRW')),
  CONSTRAINT plan_price_offers_snapshot_check CHECK ((
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
  ) IS TRUE)
);

CREATE TABLE plan_price_offer_revisions (
  offer_id text NOT NULL REFERENCES plan_price_offers(id),
  revision integer NOT NULL CONSTRAINT plan_price_offer_revisions_revision_check CHECK (revision > 0),
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_price_offer_revisions_unique UNIQUE (offer_id, revision)
);

CREATE TABLE plan_price_offer_sources (
  offer_id text NOT NULL,
  revision integer NOT NULL,
  id text NOT NULL,
  evidence jsonb NOT NULL,
  CONSTRAINT plan_price_offer_sources_unique UNIQUE (offer_id, id),
  CONSTRAINT plan_price_offer_sources_revision_fk FOREIGN KEY (offer_id, revision)
    REFERENCES plan_price_offer_revisions(offer_id, revision),
  CONSTRAINT plan_price_offer_sources_id_check CHECK ((evidence->>'id' = id) IS TRUE)
);
-- Append-only revision/source policy is enforced by the writer. Production role privileges and
-- any independent SQL writers must be reviewed separately before migration/use (no production grant here).
