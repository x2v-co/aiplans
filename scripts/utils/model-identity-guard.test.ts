import assert from 'node:assert/strict';
import test from 'node:test';
import { checkModelIdentity, isCachedPriceSane } from './model-identity-guard';
import { parseKimiModelCell, parseKimiModelIds } from '../scrapers/moonshot-dynamic';

const dirty = [
  'kimi-k3promopromotion-valid-until-october-11,',
  'kimi-k3-promo-promotion-valid-until-10/11/2026',
  'kimi-k3promo',
  'Kimi K3 Promotion valid until Oct 11',
  'glm-5-限时优惠',
  'model-a,model-b',
  'vendor/model',
];
const clean = [
  'kimi-k3', 'gpt-oss-120b', 'openai-gpt-6-1-sol', '~openai-gpt-5', 'anthropic-claude-sonnet-5-5',
  'claude-3.5-sonnet-20241022', 'gpt-4o-2024-08-06', 'qwen-qwen3-6-35b-a3b', 'gemini-nano-banana-2.1',
  'gpt-rosalind-discovery', 'deepseek-v4.1-flash', 'moonshot-v1-128k', 'mistral-large-2411',
];

test('identity guard rejects promo copy, dates, commas and slashes', () => {
  for (const s of dirty) assert.equal(checkModelIdentity(s, s.toLowerCase()).ok, false, s);
  const v = checkModelIdentity('kimi-k3-promo-promotion-valid-until-10/11/2026', 'kimi-k3-promo-promotion-valid-until-10/11/2026');
  assert.ok(v.reasons.includes('promo wording'));
  assert.ok(v.reasons.includes('validity wording'));
  assert.ok(v.reasons.includes('calendar date (d/m/y)'));
  assert.ok(v.reasons.includes('slash'));
  assert.ok(checkModelIdentity('x', 'kimi-k3promopromotion-valid-until-october-11,').reasons.includes('comma'));
});

test('identity guard accepts real model ids (incl. ISO date suffixes)', () => {
  for (const s of clean) assert.deepEqual(checkModelIdentity(s, s), { ok: true, reasons: [] }, s);
});

test('identity guard requires manual review for doubled vendor/family prefixes', () => {
  for (const slug of [
    'google-gemini-gemini-4-argon', 'google-gemini-gemini-4-argon-batch',
    'anthropic-claude-claude-opus-5', 'meta-llama-llama-4',
    'unknown-vendor-family-family-1',
  ]) {
    const verdict = checkModelIdentity('Model', slug);
    assert.equal(verdict.ok, false, slug);
    assert.ok(verdict.reasons.includes('doubled vendor/family prefix'), slug);
  }
  for (const slug of ['gemini-4-argon', 'gemini-4-argon-batch', 'vendor-family-1']) {
    assert.deepEqual(checkModelIdentity('Model', slug), { ok: true, reasons: [] }, slug);
  }
});

test('Kimi pricing cell splits ids that were concatenated with no separator', () => {
  const glued = 'kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base';
  assert.deepEqual(parseKimiModelIds(glued), [
    'kimi-k2-thinking', 'kimi-k2-instruct-0905', 'kimi-k2-instruct', 'kimi-k2-base',
  ]);
  assert.deepEqual(parseKimiModelIds('kimi-k2-thinking<br>kimi-k2.5'), ['kimi-k2-thinking', 'kimi-k2.5']);
  assert.equal(checkModelIdentity(glued, glued).ok, false);
  assert.ok(checkModelIdentity('Model', glued).reasons.includes('glued model ids'));
  assert.equal(checkModelIdentity('Model', 'glm-5glm-5.1').ok, false);
});

test('Kimi pricing cell: badge / tooltip text is stripped to the model id', () => {
  assert.equal(parseKimiModelCell('kimi-k3'), 'kimi-k3');
  assert.equal(parseKimiModelCell('kimi-k3<Badge>Promo</Badge>'), 'kimi-k3');
  assert.equal(parseKimiModelCell('kimi-k3PromoPromotion valid until October 11, 2026'), 'kimi-k3');
  assert.equal(parseKimiModelCell('kimi-k3 <Tooltip tip="Promotion valid until 10/11/2026">Promo</Tooltip>'), 'kimi-k3');
  assert.equal(parseKimiModelCell('moonshot-v1-128k'), 'moonshot-v1-128k');
  assert.equal(parseKimiModelCell('Promotion valid until October 11'), null);
});

test('cached input may not exceed input', () => {
  assert.equal(isCachedPriceSane(0.03, 0.075), false);
  assert.equal(isCachedPriceSane(0.05, 0.1), false);
  assert.equal(isCachedPriceSane(0.03, 0.03), true);
  assert.equal(isCachedPriceSane(0.02, 0.009), true);
  assert.equal(isCachedPriceSane(0.02, null), true);
});
