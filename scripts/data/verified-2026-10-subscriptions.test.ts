import assert from 'node:assert/strict';
import test from 'node:test';
import { X_SUBSCRIPTION_PLANS, MUSE_CODE_PLANS, MUSE_WONDER_MODEL, LEGACY_CLOSED_RULES, SHARED_POOL_MARKER, THIRD_PARTY_MARKER } from './verified-2026-10-subscriptions';

test('X Subscription tiers and prices', () => {
  assert.deepEqual(X_SUBSCRIPTION_PLANS.map((p) => [p.slug.replace('x-subscription-', ''), p.price]),
    [['free', 0], ['plus', 8], ['premium', 30], ['super', 100], ['ultra', 200]]);
  for (const p of X_SUBSCRIPTION_PLANS.slice(1)) assert.ok(p.noteLines.includes(SHARED_POOL_MARKER));
  for (const p of X_SUBSCRIPTION_PLANS) assert.equal(p.noteLines.includes(THIRD_PARTY_MARKER), p.price >= 30);
});

test('Muse Code tiers; only Power and Maximum include Full', () => {
  assert.deepEqual(MUSE_CODE_PLANS.map((p) => p.price), [5, 15, 50, 200]);
  assert.deepEqual(MUSE_CODE_PLANS.filter((p) => p.features.includes('Muse Wonder Full')).map((p) => p.slug), ['muse-code-power', 'muse-code-maximum']);
});

test('Muse Wonder API price', () => {
  assert.equal(MUSE_WONDER_MODEL.inputPricePer1m, 4);
  assert.equal(MUSE_WONDER_MODEL.cachedInputPricePer1m, 0.2);
  assert.equal(MUSE_WONDER_MODEL.outputPricePer1m, 20);
  assert.equal(MUSE_WONDER_MODEL.contextWindow, 1_048_576);
});

test('legacy rules never match the new X Subscription plans', () => {
  for (const p of X_SUBSCRIPTION_PLANS) for (const r of LEGACY_CLOSED_RULES.filter((r) => r.providerSlugs.includes(p.providerSlug)))
    assert.ok(!r.nameRe.test(p.name), `${r.label} matches ${p.name}`);
});

test('legacy xAI rules cover both xai and grok vendor slugs', () => {
  const xaiRules = LEGACY_CLOSED_RULES.filter((r) => r.label === 'SuperGrok' || r.label === 'X Premium');
  for (const r of xaiRules) {
    assert.ok(r.providerSlugs.includes('xai'), r.label);
    assert.ok(r.providerSlugs.includes('grok'), r.label);
  }
});

test('Muse quotas scale from Everyday; paid X tiers carry a Grok selector', () => {
  assert.deepEqual(MUSE_CODE_PLANS.map((p) => p.quotas[0].amount), [50, 250, 1000, 4000]);
  assert.equal(X_SUBSCRIPTION_PLANS[0].modelSelector, null);
  for (const p of X_SUBSCRIPTION_PLANS.slice(1)) assert.deepEqual(p.modelSelector?.providers, ['xai']);
});
