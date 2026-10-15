import assert from 'node:assert/strict';
import test from 'node:test';
import { effectivePrice } from '../../src/lib/effective-price';
import { auditedPromoSources, planPromoSync, promoModelKey, retainMatchingPromo, type PromoChannel } from './promo-sync';

// Synthetic matching rows use only audit #6's Argon rates; no DB or network.
const source: PromoChannel = {
  id: 1, model_id: 10, model_slug: 'gemini-4-argon', provider_slug: 'google', provider_type: 'producer',
  input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: null,
  promo_ends_at: '2026-12-01T08:00:00.000Z', regular_input_price_per_1m: 4, regular_output_price_per_1m: 20,
  regular_cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens', notes: null,
};
const reseller = (patch: Partial<PromoChannel> = {}): PromoChannel => ({ ...source,
  id: 2, provider_slug: 'openrouter', provider_type: 'aggregator', promo_ends_at: null,
  regular_input_price_per_1m: null, regular_output_price_per_1m: null, ...patch,
});

test('propagates to every same-price reseller/cloud and is idempotent, without refreshing verification', () => {
  const rows = [source, reseller(), reseller({ id: 3, provider_slug: 'google-vertex', provider_type: 'cloud' }),
    reseller({ id: 4, provider_slug: 'other', provider_type: 'reseller' })];
  const changes = planPromoSync(rows);
  assert.deepEqual(changes.map(change => change.id), [2, 3, 4]);
  const updated = rows.map(row => ({ ...row, ...changes.find(change => change.id === row.id)?.values }));
  assert.deepEqual(planPromoSync(updated), []);
  for (const row of updated) {
    assert.equal(effectivePrice(row, new Date('2026-12-01T07:59:59.999Z')).input_price_per_1m, 2);
    assert.deepEqual([effectivePrice(row, new Date('2026-12-01T08:00:00Z')).input_price_per_1m,
      effectivePrice(row, new Date('2026-12-01T08:00:00Z')).output_price_per_1m], [4, 20]);
  }
  assert.ok(changes.every(change => !('last_verified' in change.values)));
});

test('does not infer schedules for a discounted/output-mismatched, non-USD, batch, Lite, or unknown price', () => {
  for (const patch of [
    { input_price_per_1m: 1.5 }, { output_price_per_1m: 7.5 }, { currency: 'CNY' }, { price_unit: 'per_request' },
    { model_slug: 'gemini-4-argon-batch' }, { model_slug: 'gemini-3.8-flash-lite' },
    { input_price_per_1m: null }, { output_price_per_1m: NaN }, { input_price_per_1m: 0, output_price_per_1m: 0 },
  ]) assert.deepEqual(planPromoSync([source, reseller(patch)]), []);
  assert.deepEqual(planPromoSync([source, { ...source, id: 5 }, reseller()]), []);
  assert.deepEqual(planPromoSync([{ ...source, regular_output_price_per_1m: null }, reseller()]), []);
  assert.deepEqual(planPromoSync([{ ...source, regular_output_price_per_1m: Infinity }, reseller()]), []);
  assert.deepEqual(planPromoSync([{ ...source, input_price_per_1m: 0, output_price_per_1m: 0 }, reseller({ input_price_per_1m: 0, output_price_per_1m: 0 })]), []);
});

test('cache schedule stays null with a needs-verification note when source cache is unknown or differs', () => {
  const [change] = planPromoSync([source, reseller()]);
  assert.equal(change.values.regular_cached_input_price_per_1m, null);
  assert.match(change.values.notes, /needs-verification/);
});

test('Flash repair uses audited cutoff and regular pair, retaining current official prices instead of inventing them', () => {
  for (const slug of ['gemini-3.6-flash', 'gemini-3.8-flash']) {
    // Current source pair is synthetic; only the future pair/cutoff is audited.
    const official = { ...source, model_slug: slug, promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null };
    const rows = auditedPromoSources([official, reseller({ model_slug: `google-gemini-${slug.replace('.', '-')}` })]);
    assert.equal(rows[0].input_price_per_1m, official.input_price_per_1m);
    const [change] = planPromoSync(rows);
    assert.equal(change.values.promo_ends_at, '2027-01-01T08:00:00.000Z');
    assert.equal(change.values.regular_input_price_per_1m, 1.5);
    assert.equal(change.values.regular_output_price_per_1m, 7.5);
    assert.equal(effectivePrice({ ...rows[1], ...change.values }, new Date('2027-01-01T08:00:00Z')).output_price_per_1m, 7.5);
  }
  assert.equal(promoModelKey('google-gemini-gemini-3-6-flash'), 'gemini-3.6-flash');
});

test('subsequent plain scraper prices retain matching schedules even after expiry; changed prices and explicit null clear them', () => {
  const incoming = { input_price_per_1m: 2, output_price_per_1m: 10, currency: 'USD', price_unit: 'per_1m_tokens' };
  const retained = retainMatchingPromo(incoming, source);
  assert.equal(effectivePrice(retained, new Date('2027-01-01')).input_price_per_1m, 4);
  assert.equal(retainMatchingPromo({ ...incoming, input_price_per_1m: 4 }, source).promo_ends_at, undefined);
  assert.equal(retainMatchingPromo({ ...incoming, promo_ends_at: null }, source).promo_ends_at, null);
  assert.equal(retainMatchingPromo({ ...incoming, currency: 'CNY' }, source).promo_ends_at, undefined);
});


test('matching cache rates inherit the source cache schedule; cache changes drop only its future rate', () => {
  const cached = { ...source, cached_input_price_per_1m: 2, regular_cached_input_price_per_1m: 4 };
  const [change] = planPromoSync([cached, reseller({ cached_input_price_per_1m: 2 })]);
  assert.equal(change.values.regular_cached_input_price_per_1m, 4);
  const retained = retainMatchingPromo({ input_price_per_1m: 2, output_price_per_1m: 10,
    cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens' }, cached);
  assert.equal(retained.regular_cached_input_price_per_1m, null);
  assert.equal(retained.regular_input_price_per_1m, 4);
});
