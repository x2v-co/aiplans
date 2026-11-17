import { businessKey, normalizeOffer, type EvidenceScope, type Offer, type OfferIdentity } from './contract';

export type StoredOffer = { offer: Offer; revision: number };
export interface OfferTransaction {
  /** Serialize BOTH id and business identity, including absent rows, before reading. */
  lock(id: string, identity: OfferIdentity): Promise<void>;
  find(id: string, identity: OfferIdentity): Promise<StoredOffer[]>;
  /** Must atomically persist current, immutable revision and every NEW source, with CAS. */
  save(offer: Offer, expectedRevision: number, newSources: Offer['sources']): Promise<void>;
}
export interface OfferStore { transaction<T>(work: (tx: OfferTransaction) => Promise<T>): Promise<T> }
export class OfferWriteError extends Error {}
const refuse = (reason: string): never => { throw new OfferWriteError(reason); };

/** Same-identity enrichment only; known terms cannot be replaced by new review metadata. */
function checkEnrichment(previous: Offer, next: Offer, newSources: Offer['sources']): void {
  const conflict = (field: string): never => refuse(`Conflicting conditions cannot overwrite a current offer: ${field}`);
  const reviewed = (scope: EvidenceScope): void => {
    if (next.authority !== 'manual' || !next.reviewedAt || next.reviews[scope] !== 'reviewed'
      || !newSources.some(s => s.status === 'reviewed' && s.scopes.includes(scope)
        && s.observedAt === next.observedAt && s.reviewedAt === next.reviewedAt))
      refuse(`Enrichment requires new current manual reviewed ${scope} evidence`);
  };
  const complete = <T>(old: T, value: T, unknown: T, scope: EvidenceScope, field: string, fieldReviewed: boolean): void => {
    if (old === value) return;
    if (old !== unknown || value === unknown || !fieldReviewed) conflict(field);
    reviewed(scope);
  };
  const reviewField = (old: Offer['tax']['review'], value: Offer['tax']['review'], scope: EvidenceScope): void => {
    if (old === value) return;
    if (old === 'reviewed' || value !== 'reviewed') refuse(`Review cannot be downgraded or changed without review: ${scope}`);
    reviewed(scope);
  };
  const level = { unknown: 0, unverified: 1, reviewed: 2 };
  for (const scope of Object.keys(previous.reviews) as EvidenceScope[]) {
    if (level[next.reviews[scope]] < level[previous.reviews[scope]]) refuse(`Review ${scope} cannot be downgraded`);
    if (previous.reviews[scope] !== 'reviewed' && next.reviews[scope] === 'reviewed') reviewed(scope);
  }

  const charged = (p: Offer['price']) => p.kind === 'priced' || p.kind === 'free';
  complete(previous.price.currency, next.price.currency, null, 'price', 'original currency',
    previous.price.kind === 'unknown' && charged(next.price));
  if (previous.price.kind !== next.price.kind && !(charged(previous.price) && charged(next.price))) {
    if (previous.price.kind !== 'unknown' || !charged(next.price)) conflict('price kind');
    reviewed('price');
  }
  if (previous.price.amount !== null && next.price.amount === null) conflict('known charge');

  complete(previous.tax.status, next.tax.status, 'unknown', 'tax', 'tax inclusion', next.tax.review === 'reviewed');
  complete(previous.tax.description, next.tax.description, null, 'tax', 'tax description', next.tax.review === 'reviewed');
  reviewField(previous.tax.review, next.tax.review, 'tax');
  for (const field of ['account', 'payment', 'seat'] as const) {
    const old = previous.qualification[field], value = next.qualification[field];
    complete(old.description, value.description, null, 'eligibility', `${field} description`, value.status === 'reviewed');
    reviewField(old.status, value.status, 'eligibility');
  }

  const old = previous.validity, value = next.validity;
  complete(old.startsAt, value.startsAt, null, 'validity', 'validity start', value.status === 'reviewed');
  if (old.openEnded && value.endsAt !== null) conflict('explicit no-end validity');
  complete(old.endsAt, value.endsAt, null, 'validity', 'validity end', value.status === 'reviewed');
  if (old.openEnded !== value.openEnded) {
    if (old.openEnded || old.endsAt !== null || old.status === 'reviewed' || !value.openEnded || value.status !== 'reviewed')
      conflict('validity no-end assertion');
    reviewed('validity');
  }
  reviewField(old.status, value.status, 'validity');
  if (previous.renewalOfferId !== next.renewalOfferId) conflict('renewal association');
}

/** Intake only. No collection, legacy-price mutation, implicit retry or DB/client construction. */
export async function writeOffer(store: OfferStore, input: unknown, expectedRevision: number): Promise<StoredOffer> {
  const next = normalizeOffer(input);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) refuse('Invalid expected revision');
  return store.transaction(async tx => {
    await tx.lock(next.id, next.identity);
    const rows = await tx.find(next.id, next.identity);
    if (rows.length > 1) refuse('Duplicate identity or offer id');
    const current = rows[0];
    if (current && (current.offer.id !== next.id || businessKey(current.offer.identity) !== businessKey(next.identity)))
      refuse('Stable id/business identity mismatch; create a distinct offer after review');
    if ((current?.revision ?? 0) !== expectedRevision) refuse('Revision conflict');
    let newSources = next.sources;
    if (current) {
      const previous = normalizeOffer(current.offer);
      if (next.observedAt <= previous.observedAt) refuse('Duplicate or older observation');
      if (previous.reviewedAt && (!next.reviewedAt || next.reviewedAt < previous.reviewedAt)) refuse('Older or erased review');
      if (previous.authority === 'manual' && next.authority !== 'manual') refuse('Manual source is protected');
      for (const scope of Object.keys(previous.reviews) as (keyof Offer['reviews'])[]) {
        if (previous.reviews[scope] === 'reviewed' && next.reviews[scope] !== 'reviewed') refuse(`Reviewed ${scope} cannot be downgraded`);
      }
      const oldSources = new Map(previous.sources.map(s => [s.id, s]));
      for (const source of next.sources) {
        const old = oldSources.get(source.id);
        if (old && JSON.stringify(old) !== JSON.stringify(source)) refuse('Immutable source id reused');
      }
      newSources = next.sources.filter(s => !oldSources.has(s.id));
      if (!newSources.length) refuse('New observation requires new evidence');
      checkEnrichment(previous, next, newSources);
      // Keep all historical sources visible; new reviewed assertions already passed current-scope validation.
      next.sources = [...previous.sources, ...newSources];
      normalizeOffer(next); // Enforce the bounded immutable ledger; never prune sources to make room.
    }
    await tx.save(next, expectedRevision, newSources);
    return { offer: next, revision: expectedRevision + 1 };
  });
}
