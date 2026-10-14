import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseGooglePriceCell } from './lib/google-price-parser';
import { parseGooglePricingTables, type GooglePricingTable } from './google-gemini-dynamic';
import { normalizeModelName, normalizeSlug } from '../utils/model-normalizer';
import { checkModelIdentity } from '../utils/model-identity-guard';

const cutoff = '2026-12-01T08:00:00.000Z';
const promo = '$2.00 through November 30, 2026. $4.00 starting December 1, 2026.';

test('selects the introductory price until Pacific midnight, then regular at the exact boundary', () => {
  assert.deepEqual(parseGooglePriceCell(promo, new Date('2026-12-01T07:59:59.999Z')),
    { current: 2, regular: 4, promoEndsAt: cutoff });
  assert.deepEqual(parseGooglePriceCell(promo, new Date(cutoff)),
    { current: 4, regular: 4, promoEndsAt: cutoff });
  assert.equal(parseGooglePriceCell(promo, new Date('2027-01-01')).current, 4);
});

test('plain multimodal and context-band prices retain the first dollar, without a promotion', () => {
  for (const [text, current] of [
    ['$0.30 (text / image / video / audio)', 0.3],
    ['$2.00, prompts <= 200k tokens $4.00, prompts > 200k tokens', 2],
    ['$0.10 / 1,000,000 tokens $1.00 per hour (storage price)', 0.1],
  ] as const) assert.deepEqual(parseGooglePriceCell(text), { current, regular: null, promoEndsAt: null });
  assert.deepEqual(parseGooglePriceCell('Not available'), { current: undefined, regular: null, promoEndsAt: null });
  assert.equal(parseGooglePriceCell('$1.00 per hour (storage price)').current, undefined);
});

test('does not invent a schedule from invalid or noncontiguous dates', () => {
  for (const text of [promo.replace('November 30', 'November 31'), promo.replace('December 1', 'December 2')]) {
    assert.equal(parseGooglePriceCell(text).promoEndsAt, null);
  }
});

// The minimal verbatim HTML fixture is flattened like DOM textContent (br adds no whitespace).
function fixtureTables(): GooglePricingTable[] {
  const html = readFileSync(new URL('./fixtures/google-gemini-promos.html', import.meta.url), 'utf8');
  const text = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return [...html.matchAll(/<h2\b[^>]*>(.*?)<\/h2>\s*<section><h3\b[^>]*>(.*?)<\/h3>(<table\b.*?<\/table>)/gs)]
    .map((match) => ({
      model: text(match[1]), tier: text(match[2]),
      rows: [...match[3].matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)].map(row =>
        [...row[1].matchAll(/<(?:th|td)\b[^>]*>(.*?)<\/(?:th|td)>/gs)].map(cell => text(cell[1]))),
    }));
}

test('official HTML parses Argon and Flash including implicit cache, ignoring dated storage fees', () => {
  const tables = fixtureTables();
  assert.equal(tables.length, 2);
  const prices = parseGooglePricingTables(tables, new Date('2026-10-14'));
  assert.deepEqual(prices.map(p => [p.modelSlug, p.inputPricePer1M, p.outputPricePer1M,
    p.cachedInputPricePer1M, p.regularInputPricePer1M, p.regularOutputPricePer1M,
    p.regularCachedInputPricePer1M, p.promoEndsAt]), [
    ['gemini-4-argon', 2, 10, 0.1, 4, 20, 0.2, cutoff],
    ['gemini-3.8-flash', 0.75, 3.75, 0.075, 1.5, 7.5, 0.15, '2027-01-01T08:00:00.000Z'],
  ]);
  const after = parseGooglePricingTables(tables, new Date('2027-01-01T08:00:00Z'));
  assert.deepEqual(after.map(p => [p.inputPricePer1M, p.outputPricePer1M, p.cachedInputPricePer1M]),
    [[4, 20, 0.2], [1.5, 7.5, 0.15]]);
  assert.equal(parseGooglePricingTables(tables.map(t => ({ ...t, tier: 'Batch' }))).length, 0);
});

test('Argon keeps its identity through normalizer and auto-create guard', () => {
  const name = normalizeModelName('gemini-4-argon');
  const slug = normalizeSlug('gemini-4-argon');
  assert.equal(name, 'gemini-4-argon');
  assert.equal(slug, name);
  assert.deepEqual(checkModelIdentity(name, slug), { ok: true, reasons: [] });
});

test('Pacific midnight uses daylight saving offset for summer introductory periods', () => {
  const cell = '$1.00 through June 30, 2026. $2.00 starting July 1, 2026.';
  assert.equal(parseGooglePriceCell(cell, new Date('2026-07-01T06:59:59Z')).current, 1);
  assert.deepEqual(parseGooglePriceCell(cell, new Date('2026-07-01T07:00:00Z')),
    { current: 2, regular: 2, promoEndsAt: '2026-07-01T07:00:00.000Z' });
});
