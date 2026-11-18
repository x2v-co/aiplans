import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import archiveJson from './minimax-candidates.json';
import { bundleSchema, dryRunMinimax, type CurationBundle, type PlanMapping } from './minimax';
import { businessKey, normalizeOffer, type Offer } from '../contract';
import { syntheticContext, syntheticOffer } from '../synthetic-fixture';
import { rankOffers } from '../compare';
import { offerDTO } from '../read';

// Limited OFFLINE tests. No DB, driver, HTTP, real review or current price proof.
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const archive = bundleSchema.parse(archiveJson);
const assets = Object.fromEntries(archive.documents.map(d => [d.assetPath, readFileSync(resolve(__dirname, '../../../..', d.assetPath), 'utf8')]));
const catalog: PlanMapping = archive.candidates.map((c, i) => ({ providerSlug: c.providerSlug, planSlug: c.planSlug, planId: 900 + i }));
function syntheticBundle(): { bundle: CurationBundle; assets: Record<string, string>; catalog: PlanMapping } {
  const bundle: CurationBundle = copy(archive);
  bundle.candidates = [bundle.candidates[0]];
  bundle.documents = [bundle.documents[0]];
  const doc = bundle.documents[0];
  doc.id = 'synthetic-source-cn'; doc.kind = 'public-observation';
  doc.sourceUrl = doc.finalUrl = 'https://platform.minimaxi.com/synthetic-pr2-test-only';
  doc.observedAt = '2026-11-17T10:00:00Z'; doc.inspectedAt = '2026-11-17T10:01:00Z'; doc.sourceUpdatedAt = null;
  doc.assetPath = 'fixtures/synthetic-cn.md'; doc.archiveDateClaim = null;
  const text = 'SYNTHETIC OFFLINE TEST ONLY: regular monthly CNY 10.01; first and renewal facts unreviewed.';
  doc.sha256 = createHash('sha256').update(text).digest('hex');
  doc.excerpts = [{ locator: 'L1-L1', text }];
  const c = bundle.candidates[0]; c.historicalListing = null; c.quarantineReasons = [];
  c.draft.id = 'synthetic-candidate-cn'; c.draft.sourceIds = [doc.id];
  c.draft.observedAt = doc.observedAt; c.draft.price = { kind: 'priced', amount: '10.01', currency: 'CNY' };
  return { bundle, assets: { [doc.assetPath]: text }, catalog: [catalog[0]] };
}
function report(f = syntheticBundle(), existing: Offer[] = []) { return dryRunMinimax(f.bundle, f.assets, f.catalog, existing, syntheticContext()); }
function rejected(f: ReturnType<typeof syntheticBundle>, reason: string, existing: Offer[] = []) {
  const r = report(f, existing).results[0]; assert.equal(r.status, 'rejected'); assert.equal(r.offer, null);
  assert.ok(r.reasons.some(s => s.includes(reason)), JSON.stringify(r.reasons));
}

test('archive inventory: six existing M Plan mappings, original exact historical rows; no executable current offers', () => {
  const result = dryRunMinimax(archive, assets, catalog, [], syntheticContext());
  assert.equal(result.results.length, 6); assert.equal(result.approvedOffers, 0); assert.equal(result.applySupported, false);
  assert.deepEqual(result.comparison?.cheapest, []);
  assert.deepEqual(result.results.map(r => r.historicalListing?.amount), ['49.00', '119.00', '469.00', '22.00', '55.00', '132.00']);
  for (const row of result.results) {
    assert.equal(row.status, 'quarantined'); assert.equal(row.offer, null); assert.equal(row.businessKey, null);
    assert.ok(row.logicalBusinessKey); assert.ok(row.reasons.includes('original_observation_time_unknown'));
    assert.ok(row.reasons.includes('archive_not_fresh_official_evidence'));
  }
  assert.ok(result.results.filter(r => r.planSlug.endsWith('build')).every(r => r.reasons.includes('local_build_cn_12x_global_7.5x_not_equivalent')));
});
test('missing plan mapping stays unresolved, never assumes IDs or creates plans', () => {
  const f = syntheticBundle(); f.catalog = [];
  const r = report(f).results[0]; assert.equal(r.status, 'quarantined'); assert.equal(r.offer, null); assert.equal(r.businessKey, null);
  assert.ok(r.reasons.includes('existing_plan_mapping_required'));
});
test('SYNTHETIC explicit logical mapping creates only an unverified PR1 contract; exact original string, source hash, no FX/rank', () => {
  const r = report(); const row = r.results[0];
  assert.equal(row.status, 'validated-unverified'); assert.equal(row.offer?.identity.planId, 900);
  assert.equal(row.offer?.price.amount, '10.01'); assert.equal(row.offer?.authority, 'scraper');
  assert.deepEqual(normalizeOffer(row.offer), row.offer); assert.equal(row.businessKey, businessKey(row.offer!.identity));
  assert.match(row.offer!.sources[0].note, /SHA256 [a-f0-9]{64}/);
  assert.equal(row.offer!.sources[0].reviewedAt, null); assert.equal(row.offer!.sources[0].reviewedBy, null);
  assert.deepEqual(r.comparison?.cheapest, []);
  assert.ok(r.comparison!.excluded[0].reasons.includes('tax_not_comparable'));
  assert.ok(r.comparison!.excluded[0].reasons.includes('purchase_qualification_unknown_or_different'));
});
test('SYNTHETIC deterministic report leaves all supplied structures unchanged', () => {
  const f = syntheticBundle(), before = copy(f); const a = report(f), b = report(f);
  assert.deepEqual(a, b); assert.deepEqual(f, before);
});
test('ambiguous logical rows or reused numeric IDs refuse globally', () => {
  const f = syntheticBundle(); f.catalog.push(copy(f.catalog[0]));
  assert.throws(() => report(f), /ambiguous_plan_mapping/);
  f.catalog[1].planSlug = 'another-plan'; assert.throws(() => report(f), /ambiguous_plan_mapping/);
});
const invalidEvidence: [string, (f: ReturnType<typeof syntheticBundle>) => void, string][] = [
  ['changed bytes', f => { f.assets['fixtures/synthetic-cn.md'] += ' altered'; }, 'evidence_hash_mismatch'],
  ['missing asset', f => { f.assets = {}; }, 'missing_evidence_asset'],
  ['third-party URL', f => { f.bundle.documents[0].sourceUrl = 'https://example.com/prices'; }, 'non_official_or_wrong_site_source'],
  ['cross-site redirect', f => { f.bundle.documents[0].finalUrl = 'https://platform.minimax.io/prices'; }, 'non_official_or_wrong_site_source'],
  ['unseen excerpt', f => { f.bundle.documents[0].excerpts[0].text = 'not in the evidence'; }, 'excerpt_locator_mismatch'],
  ['wrong locator', f => { f.bundle.documents[0].excerpts[0].locator = 'L2-L2'; }, 'excerpt_locator_mismatch'],
  ['duplicate source ID', f => { f.bundle.documents.push(copy(f.bundle.documents[0])); }, 'duplicate_document_id'],
  ['missing final URL', f => { f.bundle.documents[0].finalUrl = null; }, 'public_observation_missing_time_or_final_url'],
  ['no original time', f => { f.bundle.documents[0].observedAt = null; }, 'public_observation_missing_time_or_final_url'],
  ['inspection before observation', f => { f.bundle.documents[0].inspectedAt = '2026-11-16T00:00:00Z'; }, 'observation_after_inspection'],
  ['source update after observation', f => { f.bundle.documents[0].sourceUpdatedAt = '2027-01-01T00:00:00Z'; }, 'source_update_after_observation'],
  ['archive relabelled fresh', f => { f.bundle.documents[0].archiveDateClaim = 'historical local claim'; }, 'archive_claim_cannot_be_relabelled_fresh'],
];
for (const [name, change, reason] of invalidEvidence) test(`SYNTHETIC evidence refusal: ${name}`, () => {
  const f = syntheticBundle(); change(f); assert.throws(() => report(f), new RegExp(reason));
});
const badCandidates: [string, (c: CurationBundle['candidates'][number], f: ReturnType<typeof syntheticBundle>) => void, string][] = [
  ['not M Plan', c => { c.planSlug = 'minimax-build'; }, 'unrecognized_logical_plan_not_m_plan'],
  ['manual self-approval', c => { c.draft.authority = 'manual'; }, 'manual_review_not_authorized_by_dry_run'],
  ['scoped approval', c => { c.draft.reviews.price = 'reviewed'; }, 'manual_review_not_authorized_by_dry_run'],
  ['guessed equivalence', c => { c.draft.identity.entitlementGroup = 'made-up'; c.draft.identity.entitlementVersion = 'v1'; }, 'entitlement_equivalence_requires_separate_review'],
  ['invented country', c => { c.draft.identity.market = { scope: 'country', country: 'CN' }; }, 'unreviewed_market_or_merchant_assertion'],
  ['storefront', c => { c.draft.identity.channel = 'app_store'; c.draft.identity.storefrontCountry = 'US'; }, 'website_scope_only'],
  ['missing source', c => { c.draft.sourceIds = ['missing']; }, 'missing_source'],
  ['duplicate scoped source', c => { c.draft.sourceIds.push(c.draft.sourceIds[0]); }, 'duplicate_offer_source_id'],
  ['wrong offer ownership', (c, f) => {
    const d = copy(f.bundle.documents[0]); d.id = 'synthetic-other-site'; d.site = 'international-website';
    d.sourceUrl = d.finalUrl = 'https://platform.minimax.io/synthetic-pr2-test-only';
    f.bundle.documents.push(d); c.draft.sourceIds = [d.id];
  }, 'wrong_offer_source_ownership'],
  ['time mismatch', c => { c.draft.observedAt = '2026-11-17T09:00:00Z'; }, 'source_observation_mismatch'],
  ['excess precision', c => { c.draft.price.amount = '10.001'; }, 'Invalid money precision/range'],
  ['excess range', c => { c.draft.price.amount = '1000000000000'; }, 'Invalid money precision/range'],
  ['negative amount', c => { c.draft.price.amount = '-1'; }, 'Invalid money precision/range'],
  ['NaN', c => { c.draft.price.amount = 'NaN'; }, 'Invalid money precision/range'],
  ['unknown with amount', c => { c.draft.price.kind = 'unknown'; }, 'Sales/unknown cannot supply a price'],
  ['sales with amount', c => { c.draft.price.kind = 'sales'; }, 'Sales/unknown cannot supply a price'],
  ['free positive', c => { c.draft.price.kind = 'free'; }, 'Free requires explicit zero'],
  ['no price scope', (_c, f) => { f.bundle.documents[0].scopes = ['promotion']; }, 'price_scope_missing'],
  ['unsupported tax fact', c => { c.draft.tax.status = 'included'; }, 'tax_fact_scope_missing'],
  ['unsupported payment restriction', c => { c.draft.qualification.payment.description = 'Synthetic restricted card'; }, 'purchase_condition_scope_missing'],
  ['unsupported validity fact', c => { c.draft.validity.startsAt = '2026-11-01T00:00:00Z'; }, 'validity_scope_missing'],
  ['invalid first/renewal bounds', (c, f) => {
    f.bundle.documents[0].scopes.push('validity');
    c.draft.validity = { status: 'unverified', startsAt: '2026-11-18T00:00:00Z', endsAt: '2026-11-17T00:00:00Z', openEnded: false };
  }, 'Invalid validity window'],
  ['self renewal', c => { c.draft.renewalOfferId = c.draft.id; }, 'Renewal cannot reference itself'],
];
for (const [name, change, reason] of badCandidates) test(`SYNTHETIC candidate refusal: ${name}`, () => {
  const f = syntheticBundle(); change(f.bundle.candidates[0], f); rejected(f, reason);
});
test('PR1 structural currency/number/period and secret-URL errors reject input, never default', () => {
  for (const change of [
    (f: ReturnType<typeof syntheticBundle>) => { f.bundle.candidates[0].draft.price.currency = 'XYZ' as never; },
    (f: ReturnType<typeof syntheticBundle>) => { f.bundle.candidates[0].draft.price.amount = 10 as never; },
    (f: ReturnType<typeof syntheticBundle>) => { f.bundle.candidates[0].draft.identity.billing.period = 'quarter' as never; },
    (f: ReturnType<typeof syntheticBundle>) => { f.bundle.documents[0].sourceUrl += '?token=synthetic'; },
    (f: ReturnType<typeof syntheticBundle>) => { f.bundle.documents[0].assetPath = '../.env'; },
  ]) { const f = syntheticBundle(); change(f); assert.throws(() => report(f)); }
});
test('archive rows cannot be relabeled current, guessed annual, wrong amount or wrong original currency', () => {
  for (const change of [
    (b: CurationBundle) => { b.candidates[0].draft.price = { kind: 'priced', amount: '49', currency: 'CNY' }; },
    (b: CurationBundle) => { b.candidates[0].historicalListing!.billing = { period: 'year', count: 1 }; },
    (b: CurationBundle) => { b.candidates[0].historicalListing!.amount = '24.50'; },
    (b: CurationBundle) => { b.candidates[0].historicalListing!.currency = 'USD'; },
  ]) { const b: CurationBundle = copy(archive); change(b); assert.equal(dryRunMinimax(b, assets).results[0].status, 'rejected'); }
});
test('SYNTHETIC same full-key new ID and duplicate ID refuse both rows, even archives without plan IDs', () => {
  for (const newId of [true, false]) {
    const f = syntheticBundle(); const c = copy(f.bundle.candidates[0]);
    if (newId) c.draft.id += '-other'; else c.draft.identity.billing.count = 3;
    f.bundle.candidates.push(c);
    assert.ok(report(f).results.every(r => r.status === 'rejected' && r.offer === null));
  }
  const b: CurationBundle = copy(archive); const c = copy(b.candidates[0]); c.draft.id += '-duplicate'; b.candidates.push(c);
  assert.equal(dryRunMinimax(b, assets).results[0].status, 'rejected');
});
test('SYNTHETIC price/time stay outside complete 17-dimensional key; actual billing, commitment, seats, campaign stay inside', () => {
  const f = syntheticBundle(); const a = report(f).results[0];
  f.bundle.candidates[0].draft.price.amount = '999999999999.99';
  f.bundle.candidates[0].draft.observedAt = f.bundle.documents[0].observedAt = '2026-11-17T10:00:01Z';
  assert.equal(report(f).results[0].businessKey, a.businessKey);
  assert.equal(JSON.parse(a.businessKey!).length, 17);
  for (const change of [
    (o: Offer) => { o.identity.billing = { period: 'month', count: 3 }; },
    (o: Offer) => { o.identity.billing = { period: 'year', count: 1 }; },
    (o: Offer) => { o.identity.commitment = { period: 'year', count: 1 }; },
    (o: Offer) => { o.identity.unit = 'seat'; o.identity.unitCount = 2; },
    (o: Offer) => { o.identity.promotion = 'intro'; o.identity.promotionId = 'synthetic-first'; },
  ]) { const o = copy(a.offer!); change(o); assert.notEqual(businessKey(o.identity), a.businessKey); }
});
test('SYNTHETIC occupied keys, immutable IDs, per-offer source ledger never overwrite existing inputs', () => {
  const f = syntheticBundle(), old = report(f).results[0].offer!, before = copy(old);
  rejected(f, 'existing_offer_requires_separate_review_no_overwrite', [old]);
  const different = copy(old); different.identity.billing.count = 3;
  rejected(f, 'stable_id_identity_mismatch', [different]);
  const changedSource = copy(old); changedSource.sources[0].note += ' previous';
  rejected(f, 'immutable_source_changed', [changedSource]);
  const other = copy(old); other.id = 'synthetic-other-offer'; other.identity.planId = 901;
  assert.equal(report(f, [other]).results[0].status, 'validated-unverified');
  assert.deepEqual(old, before);
});
test('SYNTHETIC explicit free vs unknown/sales remain distinct; no zero fallback', () => {
  const f = syntheticBundle(), c = f.bundle.candidates[0];
  for (const kind of ['unknown', 'sales'] as const) {
    c.draft.price = { kind, amount: null, currency: null };
    assert.deepEqual(report(f).results[0].offer!.price, c.draft.price);
  }
  c.draft.price = { kind: 'free', amount: '0', currency: 'CNY' };
  assert.equal(report(f).results[0].offer!.price.amount, '0.00');
});
test('SYNTHETIC intro/renewal facts and zoned bounds survive without inferred discount or renewal approval', () => {
  const f = syntheticBundle(), c = f.bundle.candidates[0];
  f.bundle.documents[0].scopes.push('validity');
  c.draft.identity.promotion = 'intro'; c.draft.identity.promotionId = 'synthetic-explicit-first';
  c.draft.identity.eligibilityClass = 'synthetic-new-purchase'; c.draft.renewalOfferId = 'synthetic-renewal-not-reviewed';
  c.draft.validity = { status: 'unverified', startsAt: '2026-11-01T08:00:00+08:00', endsAt: '2026-11-18T08:00:00+08:00', openEnded: false };
  const r = report(f); assert.equal(r.results[0].offer!.price.amount, '10.01');
  assert.equal(r.results[0].offer!.renewalOfferId, c.draft.renewalOfferId);
  assert.equal(r.results[0].offer!.validity.endsAt, '2026-11-18T00:00:00.000Z');
  assert.ok(r.results[0].reasons.includes('renewal_semantics_unreviewed')); assert.deepEqual(r.comparison?.cheapest, []);
  c.draft.identity.promotion = 'renewal'; assert.equal(report(f).results[0].offer!.identity.promotion, 'renewal');
});
test('SYNTHETIC known restricted terms stay visible and unverified; invalid bounds still refuse with the right scope', () => {
  const f = syntheticBundle(), c = f.bundle.candidates[0];
  f.bundle.documents[0].scopes.push('tax', 'eligibility', 'validity');
  c.draft.tax = { status: 'excluded', review: 'unverified', description: 'SYNTHETIC tax excluded statement' };
  c.draft.qualification.payment = { status: 'unverified', description: 'SYNTHETIC restricted card condition' };
  const r = report(f); assert.equal(r.results[0].offer!.tax.status, 'excluded');
  assert.equal(r.results[0].offer!.qualification.payment.description, c.draft.qualification.payment.description);
  assert.equal(r.results[0].offer!.qualification.account.status, 'unknown'); assert.deepEqual(r.comparison!.cheapest, []);
  c.draft.validity = { status: 'unverified', startsAt: '2026-11-18T00:00:00Z', endsAt: '2026-11-17T00:00:00Z', openEnded: false };
  rejected(f, 'Invalid validity window');
});
test('SYNTHETIC inherited PR1 safeguards: Kimi monthly, GLM conflict, Build difference, tax/payment and incoherent FX', () => {
  const monthly = syntheticOffer(), annual = syntheticOffer(); annual.id = 'synthetic-kimi-annual';
  annual.identity.billing = { period: 'year', count: 1 }; annual.price.amount = '12';
  assert.equal(offerDTO({ offer: annual, revision: 1 }).monthlyEquivalent!.label, 'annual_monthly_equivalent');
  assert.deepEqual(rankOffers([monthly, annual], syntheticContext()).cheapest, [monthly.id]);
  const quarter = copy(monthly); quarter.id = 'synthetic-glm-quarter'; quarter.identity.billing.count = 3; quarter.state = 'conflict';
  annual.state = 'conflict'; assert.deepEqual(rankOffers([quarter, annual], syntheticContext()).cheapest, []);
  const build = copy(monthly); build.identity.entitlementGroup = 'synthetic-build-global-7.5x';
  assert.ok(rankOffers([build], syntheticContext()).excluded[0].reasons.includes('entitlement_not_equivalent'));
  for (const change of [(o: Offer) => { o.tax.status = 'unknown'; }, (o: Offer) => { o.qualification.payment.status = 'unknown'; }]) {
    const o = copy(monthly); change(o); assert.deepEqual(rankOffers([o], syntheticContext()).cheapest, []);
  }
  const usd = copy(monthly); usd.id = 'synthetic-usd'; usd.price.currency = 'USD';
  assert.deepEqual(rankOffers([monthly, usd], syntheticContext()).cheapest, []);
  const fx = { target: 'CNY' as const, source: 'https://example.com/synthetic-fx', validAt: '2026-11-16T00:00:00Z', basis: 'synthetic', quotes: [
    { base: 'CNY' as const, quote: 'CNY' as const, rate: '1', source: 'https://example.com/synthetic-fx', validAt: '2026-11-16T00:00:00Z', observedAt: '2026-11-16T01:00:00Z', basis: 'synthetic', status: 'reviewed' as const },
    { base: 'USD' as const, quote: 'CNY' as const, rate: '7.000000000001', source: 'https://example.com/synthetic-fx', validAt: '2026-11-15T00:00:00Z', observedAt: '2026-11-16T01:00:00Z', basis: 'synthetic', status: 'reviewed' as const },
  ] };
  assert.deepEqual(rankOffers([monthly, usd], { ...syntheticContext(), fx }).cheapest, []);
});
