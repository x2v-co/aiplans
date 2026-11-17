// No runtime postgres import, environment lookup, or client construction in this module.
import type { Sql } from 'postgres';
import { businessKey, normalizeOffer, type Offer, type OfferIdentity } from './contract';
import type { OfferStore, OfferTransaction, StoredOffer } from './writer';
import type { OfferReader } from './read';

export const identityColumns = ['plan_id', 'entitlement_group', 'entitlement_version', 'market_scope', 'market_country',
  'merchant', 'channel', 'storefront_country', 'billing_period', 'billing_count', 'commitment_period', 'commitment_count',
  'unit', 'unit_count', 'promotion', 'promotion_id', 'eligibility_class'] as const;
export function identityValues(i: OfferIdentity): (string | number)[] {
  return [i.planId, i.entitlementGroup ?? '', i.entitlementVersion ?? '', i.market.scope, i.market.country ?? '',
    i.merchant ?? '', i.channel, i.storefrontCountry ?? '', i.billing.period, i.billing.count ?? 0,
    i.commitment.period, i.commitment.count ?? 0, i.unit, i.unitCount ?? 0, i.promotion, i.promotionId ?? '', i.eligibilityClass ?? ''];
}

export function createPostgresOfferStore(sql: Sql): OfferStore {
  return {
    async transaction<T>(work: (tx: OfferTransaction) => Promise<T>): Promise<T> {
      // No nested/background transactions. Locks cover absent rows; unique constraint is the final backstop.
      const result = await sql.begin(async tx => work({
        async lock(id, identity) {
          for (const key of [`offer-id:${id}`, `offer-identity:${businessKey(identity)}`].sort())
            await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        },
        async find(id, identity) {
          const values = identityValues(identity);
          const predicates = identityColumns.map((column, index) => `${column} = $${index + 2}`).join(' AND ');
          const rows = await tx.unsafe<{ snapshot: Offer; revision: number }[]>(
            `SELECT snapshot, revision FROM public.plan_price_offers WHERE id = $1 OR (${predicates}) FOR UPDATE`, [id, ...values]);
          return rows.map(row => ({ offer: normalizeOffer(row.snapshot), revision: row.revision }));
        },
        async save(offer, expectedRevision, newSources) {
          const revision = expectedRevision + 1;
          // postgres.js serializes JSONB parameters itself. Pass the normalized object to
          // this transaction's explicit carrier; a pre-stringified value is encoded twice.
          if (expectedRevision === 0) {
            const columns = ['id', ...identityColumns, 'amount', 'currency', 'renewal_offer_id', 'snapshot', 'revision', 'observed_at'];
            const values = [offer.id, ...identityValues(offer.identity), offer.price.amount, offer.price.currency, offer.renewalOfferId,
              tx.json(offer), revision, offer.observedAt];
            await tx.unsafe(`INSERT INTO public.plan_price_offers (${columns.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')})`, values);
          } else {
            const rows = await tx.unsafe<{ id: string }[]>(`UPDATE public.plan_price_offers
              SET amount=$1, currency=$2, snapshot=$3::jsonb, revision=$4, observed_at=$5::timestamptz, renewal_offer_id=$6
              WHERE id=$7 AND revision=$8 RETURNING id`,
            [offer.price.amount, offer.price.currency, tx.json(offer), revision, offer.observedAt, offer.renewalOfferId, offer.id, expectedRevision]);
            if (rows.length !== 1) throw new Error('Offer compare-and-swap failed');
          }
          await tx.unsafe('INSERT INTO public.plan_price_offer_revisions (offer_id, revision, snapshot) VALUES ($1,$2,$3::jsonb)',
            [offer.id, revision, tx.json(offer)]);
          for (const source of newSources)
            await tx.unsafe('INSERT INTO public.plan_price_offer_sources (offer_id, revision, id, evidence) VALUES ($1,$2,$3,$4::jsonb)',
              [offer.id, revision, source.id, tx.json(source)]);
        },
      }));
      return result as T;
    },
  };
}

export function createPostgresOfferReader(sql: Sql): OfferReader {
  return {
    async read(planIds) {
      // Exact relation probe, not a catch-all 42P01 fallback (which could hide broken joins).
      const [relation] = await sql.unsafe<{ present: boolean }[]>("SELECT to_regclass('public.plan_price_offers') IS NOT NULL AS present");
      if (!relation.present) return { status: 'missing-table', rows: [] };
      if (!planIds.length) return { status: 'available', rows: [] };
      const rows = await sql.unsafe<{ snapshot: Offer; revision: number }[]>(
        `SELECT snapshot, revision FROM public.plan_price_offers WHERE plan_id IN (${planIds.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY id`,
        [...planIds]);
      return { status: 'available', rows: rows.map(row => ({ offer: normalizeOffer(row.snapshot), revision: row.revision } satisfies StoredOffer)) };
    },
  };
}
