/** PR2: pure offline curation. No DB, writer, environment, fetch or apply path. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { businessKey, currency, identitySchema, instant, moneyUnits, normalizeOffer, offerSchema, publicUrl, type Offer } from '../contract';
import { rankOffers, type ComparisonContext } from '../compare';

const token = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const scopes = z.array(z.enum(['price', 'entitlement', 'market', 'channel', 'promotion', 'tax', 'eligibility', 'validity'])).min(1);
const sites = ['mainland-website', 'international-website'] as const;
export const minimaxTargets = sites.flatMap(site => ['go', 'explore', 'build'].map(tier => ({
  site, tier, providerSlug: site === 'mainland-website' ? 'minimax-china' : 'minimax-global',
  planSlug: `minimax-${site === 'mainland-website' ? '' : 'global-'}mplan-${tier}`,
  host: site === 'mainland-website' ? 'platform.minimaxi.com' : 'platform.minimax.io',
})));

export const documentSchema = z.strictObject({
  id: token, site: z.enum(sites), kind: z.enum(['archive', 'public-observation']),
  sourceUrl: publicUrl, finalUrl: publicUrl.nullable(),
  observedAt: instant.nullable(), inspectedAt: instant, sourceUpdatedAt: instant.nullable(),
  // SHA covers the exact UTF-8 asset, not a normalized or translated excerpt.
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  assetPath: z.string().regex(/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/),
  scopes,
  excerpts: z.array(z.strictObject({ locator: z.string().regex(/^L[1-9]\d*-L[1-9]\d*$/), text: z.string().min(1).max(600) })).min(1).max(8),
  archiveDateClaim: z.string().max(200).nullable(),
});
// Only the DB plan ID, unavailable observation instant and source objects are deferred.
// All remaining fields are derived directly from PR1's exact schema, not a second offer contract.
// Rebuild the deferred shape because Zod forbids omit() on refined objects.
// normalizeOffer below still runs ALL original cross-field refinements.
export const draftSchema = z.strictObject(offerSchema.shape).omit({ identity: true, observedAt: true, sources: true }).extend({
  identity: z.strictObject(identitySchema.shape).omit({ planId: true }), observedAt: instant.nullable(),
  sourceIds: z.array(token).min(1).max(1000),
});
export const candidateSchema = z.strictObject({
  productFamily: z.literal('m-plan'), site: z.enum(sites), providerSlug: token, planSlug: token,
  draft: draftSchema,
  historicalListing: z.strictObject({ amount: z.string(), currency, billing: identitySchema.shape.billing, evidenceId: token }).nullable(),
  quarantineReasons: z.array(z.string().min(1).max(300)),
});
export const bundleSchema = z.strictObject({ version: z.literal(1), documents: z.array(documentSchema).min(1).max(30), candidates: z.array(candidateSchema).max(30) });
export type CurationBundle = z.input<typeof bundleSchema>;
export type Candidate = z.input<typeof candidateSchema>;
export const catalogSchema = z.array(z.strictObject({ providerSlug: token, planSlug: token, planId: z.number().int().min(1).max(2147483647) }));
export type PlanMapping = z.input<typeof catalogSchema>;
export type CandidateResult = {
  id: string; providerSlug: string; planSlug: string;
  status: 'rejected' | 'quarantined' | 'validated-unverified'; reasons: string[];
  businessKey: string | null; logicalBusinessKey: string | null; offer: Offer | null;
  historicalListing: Candidate['historicalListing'];
};
export type DryRunReport = {
  mode: 'offline-dry-run-only'; applySupported: false;
  results: CandidateResult[];
  comparison: ReturnType<typeof rankOffers> | null;
  // Always zero: validation is neither manual approval nor production authorization.
  approvedOffers: 0;
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const requireThat = (condition: unknown, reason: string): void => { if (!condition) throw new Error(reason); };

/** assets and catalog are explicit caller inputs. Unknown IDs are never guessed or created. */
export function dryRunMinimax(input: unknown, assets: Readonly<Record<string, string>>, mapping: unknown = [],
  existing: readonly unknown[] = [], context?: ComparisonContext): DryRunReport {
  const bundle = bundleSchema.parse(input);
  const catalog = catalogSchema.parse(mapping);
  const catalogKeys = new Set<string>(), planIds = new Set<number>();
  for (const row of catalog) {
    const key = `${row.providerSlug}/${row.planSlug}`;
    requireThat(!catalogKeys.has(key) && !planIds.has(row.planId), 'ambiguous_plan_mapping');
    catalogKeys.add(key); planIds.add(row.planId);
  }
  const documents = new Map<string, z.output<typeof documentSchema>>();
  for (const doc of bundle.documents) {
    requireThat(!documents.has(doc.id), 'duplicate_document_id');
    const host = minimaxTargets.find(t => t.site === doc.site)!.host;
    requireThat(new URL(doc.sourceUrl).hostname === host && (!doc.finalUrl || new URL(doc.finalUrl).hostname === host), 'non_official_or_wrong_site_source');
    const text = assets[doc.assetPath];
    requireThat(typeof text === 'string', 'missing_evidence_asset');
    requireThat(createHash('sha256').update(text).digest('hex') === doc.sha256, 'evidence_hash_mismatch');
    requireThat(new Set(doc.scopes).size === doc.scopes.length, 'duplicate_evidence_scope');
    for (const excerpt of doc.excerpts) {
      const [start, end] = excerpt.locator.slice(1).split('-L').map(Number);
      const lines = text.split('\n');
      requireThat(end >= start && end <= lines.length && lines.slice(start - 1, end).join('\n').includes(excerpt.text), 'excerpt_locator_mismatch');
    }
    requireThat(!doc.observedAt || doc.observedAt <= doc.inspectedAt, 'observation_after_inspection');
    requireThat(!doc.sourceUpdatedAt || !doc.observedAt || doc.sourceUpdatedAt <= doc.observedAt, 'source_update_after_observation');
    requireThat(doc.kind !== 'public-observation' || (doc.observedAt && doc.finalUrl), 'public_observation_missing_time_or_final_url');
    requireThat(doc.kind !== 'public-observation' || doc.archiveDateClaim === null, 'archive_claim_cannot_be_relabelled_fresh');
    documents.set(doc.id, doc);
  }
  const occupied = existing.map(normalizeOffer);
  const results: CandidateResult[] = bundle.candidates.map(candidate => {
    const result: CandidateResult = { id: candidate.draft.id, providerSlug: candidate.providerSlug, planSlug: candidate.planSlug,
      status: 'quarantined', reasons: [...candidate.quarantineReasons], businessKey: null, logicalBusinessKey: null, offer: null,
      historicalListing: candidate.historicalListing };
    try {
      const target = minimaxTargets.find(t => t.site === candidate.site && t.providerSlug === candidate.providerSlug && t.planSlug === candidate.planSlug);
      requireThat(target, 'unrecognized_logical_plan_not_m_plan');
      const draft = candidate.draft;
      requireThat(draft.authority === 'scraper' && draft.state === 'unverified' && draft.reviewedAt === null
        && Object.values(draft.reviews).every(s => s !== 'reviewed') && draft.tax.review !== 'reviewed'
        && Object.values(draft.qualification).every(c => c.status !== 'reviewed') && draft.validity.status !== 'reviewed', 'manual_review_not_authorized_by_dry_run');
      requireThat(draft.identity.entitlementGroup === null && draft.identity.entitlementVersion === null, 'entitlement_equivalence_requires_separate_review');
      requireThat(draft.identity.channel === 'website' && draft.identity.storefrontCountry === null, 'website_scope_only');
      // These commercial site labels are never country lists, service availability or eligibility.
      requireThat(draft.identity.market.scope === (candidate.site === 'international-website' ? 'international' : 'unknown')
        && draft.identity.market.country === null && draft.identity.merchant === null, 'unreviewed_market_or_merchant_assertion');
      requireThat(new Set(draft.sourceIds).size === draft.sourceIds.length, 'duplicate_offer_source_id');
      const docs = draft.sourceIds.map(id => { const d = documents.get(id); requireThat(d, 'missing_source'); return d!; });
      requireThat(docs.every(d => d.site === candidate.site), 'wrong_offer_source_ownership');
      const hasScope = (scope: Offer['sources'][number]['scopes'][number]) => docs.some(d => d.scopes.includes(scope));
      requireThat((draft.tax.status === 'unknown' && draft.tax.description === null) || hasScope('tax'), 'tax_fact_scope_missing');
      requireThat(Object.values(draft.qualification).every(c => c.description === null) || hasScope('eligibility'), 'purchase_condition_scope_missing');
      requireThat(draft.identity.promotion === 'unknown' || hasScope('promotion'), 'promotion_scope_missing');
      requireThat((!draft.validity.startsAt && !draft.validity.endsAt && !draft.validity.openEnded) || hasScope('validity'), 'validity_scope_missing');
      if (candidate.historicalListing) {
        const h = candidate.historicalListing;
        moneyUnits(h.amount, h.currency);
        requireThat(docs.some(d => d.id === h.evidenceId && d.kind === 'archive' && d.scopes.includes('price')), 'historical_listing_missing_archive_source');
        requireThat(h.billing.period === 'month' && h.billing.count === 1
          && h.currency === (candidate.site === 'mainland-website' ? 'CNY' : 'USD'), 'archive_listing_period_or_currency_mismatch');
        const doc = documents.get(h.evidenceId)!;
        const tier = target!.tier;
        const rows = assets[doc.assetPath].split('\n').filter(line => new RegExp(`^\\|\\s*${tier}\\s*\\|`, 'i').test(line));
        const amounts = rows.flatMap(line => {
          const match = line.match(h.currency === 'CNY' ? /[¥￥]\s*([0-9.]+)\/月/ : /\$\s*([0-9.]+)\/month/);
          return match ? [match[1]] : [];
        });
        requireThat(amounts.length === 1 && moneyUnits(amounts[0], h.currency) === moneyUnits(h.amount, h.currency)
          && /原价|Regular price/.test(assets[doc.assetPath]), 'archive_listing_not_supported_by_regular_price_row');
        // Archive figures are reference material, never current executable prices.
        requireThat(draft.price.kind === 'unknown' && draft.price.amount === null && draft.price.currency === null, 'archive_price_promoted_to_current');
      }
      if (docs.some(d => d.kind === 'archive')) result.reasons.push('archive_not_fresh_official_evidence');
      if (docs.some(d => !d.observedAt) || !draft.observedAt) result.reasons.push('original_observation_time_unknown');
      const row = catalog.find(r => r.providerSlug === candidate.providerSlug && r.planSlug === candidate.planSlug);
      if (!row) result.reasons.push('existing_plan_mapping_required');
      // Validate every contract field even while a real plan/time prerequisite is absent.
      // Placeholder is private validation only, NEVER returned as a resolved offer/key.
      const { sourceIds: _sourceIds, ...fields } = draft;
      void _sourceIds;
      const sources = docs.map(d => ({ id: d.id, url: d.finalUrl ?? d.sourceUrl, scopes: d.scopes, status: 'unverified',
        observedAt: d.observedAt ?? '2000-01-01T00:00:00Z', reviewedAt: null, reviewedBy: null,
        note: `${d.kind}; SHA256 ${d.sha256}; ${d.excerpts[0].locator}: ${d.excerpts[0].text}` }));
      const validated = normalizeOffer({ ...fields, identity: { ...draft.identity, planId: row?.planId ?? 1 },
        observedAt: draft.observedAt ?? '2000-01-01T00:00:00Z', sources });
      result.logicalBusinessKey = JSON.stringify([`${candidate.providerSlug}/${candidate.planSlug}`,
        ...JSON.parse(businessKey(validated.identity)).slice(1)]);
      if (docs.every(d => d.kind === 'public-observation' && d.observedAt) && draft.observedAt && row) {
        requireThat(docs.every(d => d.observedAt === validated.observedAt), 'source_observation_mismatch');
        requireThat(docs.some(d => d.scopes.includes('price')) || validated.price.kind === 'unknown', 'price_scope_missing');
        const key = businessKey(validated.identity);
        result.businessKey = key;
        for (const previous of occupied) {
          requireThat(previous.id !== validated.id || businessKey(previous.identity) === key, 'stable_id_identity_mismatch');
          for (const old of previous.sources) {
            const next = validated.sources.find(s => s.id === old.id);
            if (previous.id === validated.id && next) requireThat(equal(old, next), 'immutable_source_changed');
          }
          requireThat(previous.id !== validated.id && businessKey(previous.identity) !== key, 'existing_offer_requires_separate_review_no_overwrite');
        }
        result.offer = validated;
        // No fabricated DB revision: DTO construction is left to a real stored read.
        result.status = result.reasons.length ? 'quarantined' : 'validated-unverified';
      }
      result.reasons.push('not_manually_reviewed', 'entitlement_equivalence_unreviewed');
      if (validated.tax.status === 'unknown') result.reasons.push('tax_unknown');
      if (Object.values(validated.qualification).some(c => c.status !== 'reviewed')) result.reasons.push('purchase_qualification_unreviewed');
      if (validated.renewalOfferId) result.reasons.push('renewal_semantics_unreviewed');
    } catch (error) {
      result.status = 'rejected'; result.offer = null;
      result.reasons.push(error instanceof Error ? error.message : 'invalid_candidate');
    }
    result.reasons = [...new Set(result.reasons)];
    return result;
  });
  // Refuse BOTH sides of a batch collision. Never choose the first row by order.
  for (const row of results) {
    if (results.some(other => other !== row && (other.id === row.id || (row.businessKey && other.businessKey === row.businessKey)
      || (row.logicalBusinessKey && other.logicalBusinessKey === row.logicalBusinessKey)))) {
      row.status = 'rejected'; row.offer = null; row.reasons.push('duplicate_batch_offer_id_or_business_key');
    }
  }
  // PR1 ranker remains the only ranking authority; quarantine never participates.
  const offers = results.filter(r => r.status === 'validated-unverified').flatMap(r => r.offer ? [r.offer] : []);
  return { mode: 'offline-dry-run-only', applySupported: false, results, approvedOffers: 0,
    comparison: context ? rankOffers(offers, context) : null };
}
