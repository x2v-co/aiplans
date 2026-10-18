import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOP_TRUST_PAGES,
  TRUST_STALE_DAYS,
  channelListPriceTrust,
  featureLooksEstimated,
  planCreditTrust,
  planEntitlementTrust,
  planPriceTrust,
  quotaEstimateTrust,
  safeSourceUrl,
  usageEstimateTrust,
  variantPriceTrust,
} from './data-trust';

const NOW = new Date('2026-10-18T12:00:00Z');

test('top traffic set is ten unique model and provider pages', () => {
  assert.equal(TOP_TRUST_PAGES.length, 10);
  assert.equal(new Set(TOP_TRUST_PAGES.map((page) => `${page.kind}:${page.slug}`)).size, 10);
  assert.deepEqual(TOP_TRUST_PAGES.map((page) => page.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(
    TOP_TRUST_PAGES.filter((page) => page.kind === 'model').map((page) => page.slug),
    [
      'anthropic-claude-fable-5-1',
      'anthropic-claude-opus-5-5',
      'anthropic-claude-sonnet-5-5',
      'openai-gpt-6-astra',
      'openai-gpt-6-1-sol',
      'openai-gpt-6-sol',
    ],
  );
  assert.ok(TOP_TRUST_PAGES.some((page) => page.slug === 'zhipu-china' && page.kind === 'provider'));
});

test('source urls reject scripts and credentials', () => {
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
  assert.equal(safeSourceUrl('https://user:pass@openai.com/pricing'), null);
  assert.equal(safeSourceUrl('https://openai.com/chatgpt/pricing/'), 'https://openai.com/chatgpt/pricing/');
  assert.equal(safeSourceUrl('/zh/methodology'), '/zh/methodology');
  assert.equal(safeSourceUrl('//evil.example'), null);
});

test('fresh official list price is verified and names source, conditions and day', () => {
  const fact = channelListPriceTrust({
    currency: 'USD',
    price_unit: 'per_1m_tokens',
    last_verified: '2026-10-10T00:00:00Z',
    providers: { name: 'OpenAI', slug: 'openai', type: 'official', pricing_url: 'https://example.test/ignored' },
  }, 'zh', NOW);
  assert.equal(fact.sourceUrl, 'https://developers.openai.com/api/docs/pricing');
  assert.match(fact.sourceLabel, /OpenAI API/);
  assert.match(fact.conditions[0], /USD/);
  assert.equal(fact.verifiedOn, '2026-10-10');
  assert.deepEqual(fact.flags, { estimated: false, expired: false, stale: false, unverified: false });
});

test('missing verification, stale rows, ended promos and estimates stay distinct', () => {
  const unverified = channelListPriceTrust({
    currency: 'USD',
    last_verified: null,
    notes: '[needs-verification] base row missing',
    providers: { name: 'OpenAI', slug: 'openai', type: 'producer' },
  }, 'en', NOW);
  assert.equal(unverified.flags.unverified, true);
  assert.equal(unverified.flags.estimated, false);
  assert.equal(unverified.verifiedOn, null);

  const stale = channelListPriceTrust({
    currency: 'CNY',
    last_verified: '2026-09-01T00:00:00Z',
    providers: { name: '智谱', slug: 'zhipu-china', type: 'official', pricing_url: 'https://bigmodel.cn/pricing' },
  }, 'zh', NOW);
  assert.equal(stale.flags.stale, true);
  assert.equal(stale.flags.unverified, false);
  assert.ok(NOW.getTime() - new Date('2026-09-01T00:00:00Z').getTime() > TRUST_STALE_DAYS * 86400000);

  const expiredPromo = channelListPriceTrust({
    currency: 'USD',
    last_verified: '2026-10-17T00:00:00Z',
    promo_ends_at: '2026-10-01T00:00:00Z',
    providers: { name: 'OpenAI', slug: 'openai', type: 'official' },
  }, 'zh', NOW);
  assert.equal(expiredPromo.flags.expired, true);
  assert.match(expiredPromo.conditions.join(' '), /不要把该数字当成现行标价/);

  const replaced = channelListPriceTrust({
    currency: 'USD',
    last_verified: '2026-10-17T00:00:00Z',
    promo_ends_at: '2026-10-01T00:00:00Z',
    regular_input_price_per_1m: 4,
    regular_output_price_per_1m: 16,
    providers: { name: 'Google', slug: 'google', type: 'producer' },
  }, 'en', NOW);
  assert.equal(replaced.flags.expired, false);
  assert.match(replaced.conditions.join(' '), /regular price/);

  const estimate = usageEstimateTrust('zh', NOW);
  assert.equal(estimate.flags.estimated, true);
  assert.equal(estimate.flags.unverified, false);
  assert.equal(estimate.verifiedOn, '2026-10-18');
  assert.match(estimate.conditions.join(''), /不能当成账单/);
});

test('plan price, entitlement and unknown credit do not promote guesses', () => {
  const source = { label: 'Claude 官方定价页', url: 'https://claude.com/pricing' };
  const price = planPriceTrust({
    currency: 'USD', price_unit: 'per_month', price: 0, is_contact_sales: true,
    last_verified: '2026-10-18T00:00:00Z', legacy_ends_on: '2026-10-01',
  }, source, 'zh', NOW);
  assert.equal(price.flags.expired, true);
  assert.match(price.conditions.join(''), /不是公开成交价/);

  const benefit = planEntitlementTrust({
    last_verified: '2026-10-18T00:00:00Z',
    monthly_api_credit_status: 'needs-verification',
    quota_unit: 'usd',
  }, source, 'zh', NOW);
  assert.equal(benefit.flags.estimated, false);
  assert.match(benefit.conditions.join(''), /不是厂商保证额度/);

  const team = planPriceTrust({
    name: 'Claude Team Standard', currency: 'USD', price_unit: 'per_month', price: 30,
    last_verified: '2026-10-18T00:00:00Z',
  }, source, 'zh', NOW, 'anthropic');
  assert.equal(team.flags.unverified, true);
  assert.equal(team.flags.estimated, false);
  assert.match(team.conditions.join(''), /\$25/);
  assert.equal(planPriceTrust({
    name: 'Claude Pro', currency: 'USD', price: 20, last_verified: '2026-10-18T00:00:00Z',
  }, source, 'zh', NOW, 'anthropic').flags.unverified, false);
  const plus = planPriceTrust({
    name: 'Google AI Plus', price: null, last_verified: '2026-10-18T00:00:00Z',
  }, source, 'zh', NOW, 'google');
  assert.equal(plus.flags.unverified, true);
  assert.match(plus.conditions.join(''), /\$4\.99/);
  assert.equal(planPriceTrust({
    name: 'Google AI Ultra (5x)', price: 99.99, last_verified: '2026-10-18T00:00:00Z',
  }, source, 'zh', NOW, 'google').flags.unverified, false);

  const credit = planCreditTrust(source, 'zh', NOW);
  assert.equal(credit.flags.unverified, true);
  assert.equal(credit.flags.estimated, false);
  assert.match(credit.conditions[0], /没有核成确定数字/);

  assert.equal(featureLooksEstimated('大约 100 万 token'), true);
  assert.equal(featureLooksEstimated('Unlimited messages'), false);
  assert.equal(featureLooksEstimated('Priority support'), false);
});

test('quota ranges stay estimates and a superseded range is expired', () => {
  const current = quotaEstimateTrust({
    verifiedAt: '2026-10-14T00:00:00Z',
    windowLabel: '每周',
    mix: '缓存读取 50%',
    servedModel: 'claude-opus',
    evidenceUrl: 'https://claude.com/pricing',
    isCurrent: true,
  }, 'zh', NOW);
  assert.equal(current.flags.estimated, true);
  assert.equal(current.flags.expired, false);
  assert.equal(current.sourceUrl, 'https://claude.com/pricing');
  assert.match(current.conditions.join(''), /不是厂商保证/);

  const old = quotaEstimateTrust({
    verifiedAt: '2026-09-01T00:00:00Z',
    windowLabel: '每周',
    mix: '缓存读取 50%',
    servedModel: null,
    evidenceUrl: null,
    isCurrent: false,
  }, 'en', NOW);
  assert.equal(old.flags.expired, true);
  assert.equal(old.flags.stale, true);
  assert.equal(old.sourceUrl, '/en/methodology');
});

test('variant rows keep their own source and constraints', () => {
  const fact = variantPriceTrust({
    variant_name: 'Fast mode',
    variant_kind: 'tier',
    source_url: 'https://docs.claude.com/en/docs/build-with-claude/fast-mode',
    last_verified: '2026-10-15T00:00:00Z',
    currency: 'USD',
    constraints_json: { speed: 'fast', status: 'ga' },
    notes: 'Up to 2.5x output tokens/s.',
  }, {
    currency: 'USD',
    last_verified: '2026-10-01T00:00:00Z',
    providers: { name: 'Anthropic', slug: 'anthropic', type: 'official' },
  }, 'en', NOW);
  assert.equal(fact.sourceUrl, 'https://docs.claude.com/en/docs/build-with-claude/fast-mode');
  assert.match(fact.conditions.join(' '), /speed: fast/);
  assert.equal(fact.verifiedOn, '2026-10-15');
  assert.equal(fact.flags.estimated, false);
});
