import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPlanDisplayText, planCardCopy, uniquePlanSentences } from './plan-card-display';

test('strips machine markers anywhere, detects unverified and preserves ordinary brackets', () => {
  assert.deepEqual(cleanPlanDisplayText('  Pro [NEEDS-VERIFICATION]\n [aiplans:review-source] [internal-only]  [100K context] '), {
    text: 'Pro [100K context]', unverified: true,
  });
  assert.deepEqual(cleanPlanDisplayText('Quota [unverified]'), { text: 'Quota', unverified: true });
  assert.deepEqual(cleanPlanDisplayText('Reviewed [aiplans:review-source]'), { text: 'Reviewed', unverified: false });
  for (const value of [null, undefined, {}, 12]) {
    assert.deepEqual(cleanPlanDisplayText(value), { text: '', unverified: false });
  }
});

test('deduplicates sentences across whitespace, casing, Chinese and repeated paragraphs', () => {
  assert.deepEqual(uniquePlanSentences([
    'Priority  support. More quota.', 'priority\n', 'PRIORITY support.',
    '更多额度。更多额度。', 'Source: https://example.com/a-very-long-source-url',
    'More quota.', 'Context [100K context]', null,
  ]), ['Priority support.', 'More quota.', 'priority', '更多额度。', 'Context [100K context]']);
  assert.deepEqual(uniquePlanSentences(['  HIGHER\n  quota. Extra tools.'], ['Higher quota']), ['Extra tools.']);
  assert.deepEqual(uniquePlanSentences(['Model 6.1 costs $0.50. Model 6.1 costs $0.50.']), ['Model 6.1 costs $0.50.']);
});

test('limits highlights to four and removes feature/source duplicates from details without mutating data', () => {
  const input = {
    name: 'Pro', features: ['Priority support.', 'More quota.', 'Tools', 'Team access', 'Fifth feature'],
    sourceLabel: 'Vendor pricing',
    conditions: [' priority SUPPORT. More quota.', 'Source: Vendor pricing', 'Extra condition. Extra condition.'],
    notes: '[needs-verification] More quota.\nSource: https://example.com/pricing\n[aiplans:review-source] https://example.com/pricing',
  };
  const before = structuredClone(input);
  assert.deepEqual(planCardCopy(input), {
    name: 'Pro', points: ['Priority support.', 'More quota.', 'Tools', 'Team access'],
    details: ['Fifth feature', 'Extra condition.'], unverified: true,
  });
  assert.deepEqual(input, before);
});

test('handles malformed features and a verification marker in a hidden feature or condition', () => {
  for (const features of [null, {}, 'not an array', [12, null, {}]]) {
    assert.deepEqual(planCardCopy({ name: 'Plan', features }).points, []);
  }
  assert.equal(planCardCopy({ name: 'Plan', features: ['[needs-verification]'] }).unverified, true);
  assert.equal(planCardCopy({ name: 'Plan', features: [], conditions: ['[needs-verification]'] }).unverified, true);
});

test('Chinese cards prefer authored translations and never use English feature prose as fallback', () => {
  const copy = planCardCopy({ name: 'ChatGPT Go', locale: 'zh',
    features: ['English original. More English. 来源：文档已核验。'],
    structured: { features_zh: ['已有中文功能'], price: 20, currency: 'USD',
      quotas: [{ amount: 100, unit: 'message', period: 'day' }], context_window: 32000 },
  });
  assert.equal(copy.points.length, 4);
  assert.equal(copy.points[0], '已有中文功能');
  assert.doesNotMatch(copy.points.join(' '), /English|核验/);
  assert.deepEqual(planCardCopy({ name: 'Copilot', locale: 'zh',
    features: ['Original English [needs-verification]'], structured: { price: 10 },
  }).points, ['套餐价格：$10.00/月']);
  assert.equal(planCardCopy({ name: 'Copilot', locale: 'zh', features: ['English [needs-verification]'] }).unverified, true);
  assert.deepEqual(planCardCopy({ name: 'Plan', locale: 'en', features: [{ zh: '中文', en: 'Authored English' }] }).points, ['Authored English']);
});

test('structured quotas, relative allowances, limits and benefits produce bounded bilingual highlights', () => {
  for (const locale of ['zh', 'en']) {
    const input = { name: 'Claude Max', locale, features: {}, structured: {
      quotas: [{ unit: 'relative', multiplier: 5, period: 'week', derived_from: 'claude-pro' }],
      benefits: { sso: true, made_up: true }, limits: { context_window: 200000, invented: 300 },
      price: 100, annual_price: 1000, payment_methods: ['Credit Card'],
    } };
    const copy = planCardCopy(input);
    assert.equal(copy.points.length, 4);
    assert.match(copy.points.join(' '), /claude-pro/);
    assert.match(copy.points.join(' '), /200000/);
    assert.match(copy.points.join(' '), locale === 'zh' ? /支持单点登录/ : /SSO included/);
    assert.doesNotMatch(JSON.stringify(copy), /made_up|invented/);
    assert.deepEqual(planCardCopy({ name: 'Gemini', locale, features: [], structured: {
      quotas: [], limits: { mystery: 10 }, benefits: {},
    } }).points, []);
    const minimal = planCardCopy({ name: 'GLM', locale, features: [], structured: {
      quotas: [{ amount: 10000, unit: 'credit', period: 'week' }], price: 118, annual_price: 991.2,
    } });
    assert.equal(minimal.points.length, 3);
  }
});

test('verification sentences disappear before URL stripping, while benefits and decimal numbers survive', () => {
  assert.deepEqual(uniquePlanSentences([
    '3,900 credits. Sources: https://example.com/a, https://example.com/b; verified 2026-10-29. More tools.',
    'Sources: verified 2026-10-28', '来源：https://example.com 文档，2026-10-28 核验。支持上传。',
    'Cost $0.50. Source: https://example.com',
  ]), ['3,900 credits.', 'More tools.', '支持上传。', 'Cost $0.50.']);
});

test('the same quota in a legacy limit column is one fact; derived numbers remain labeled estimates', () => {
  for (const locale of ['zh', 'en']) {
    const copy = planCardCopy({ name: 'Plan', features: [], locale, structured: {
      quotas: [{ amount: 60000, unit: 'credit', period: 'week', derived_from: 'glm-coding-lite' },
        { amount: 100, unit: 'message', period: 'day' }], daily_message_limit: 100,
      rate_limit: Infinity, tokens_per_day: NaN,
    } });
    assert.equal(copy.points.length, 2);
    assert.match(copy.points[0], locale === 'zh' ? /估算/ : /estimated/);
    assert.doesNotMatch(copy.points.join(' '), /Infinity|NaN/);
  }
});

test('annual billing line shows the yearly total with the monthly equivalent (Kimi Pro)', async () => {
  const { structuredPlanHighlights } = await import('./plan-card-display');
  const plan = { tier: 'pro', price: 199, annual_price: 1908, price_yearly_monthly: 159, currency: 'CNY', price_unit: 'per_month' };
  const zh = structuredPlanHighlights(plan, 'zh').join('\n');
  assert.match(zh, /年付 ¥1,908(\.00)?（折合 ¥159(\.00)?\/月）/);
  assert.match(zh, /¥199(\.00)?\/月/);
  const en = structuredPlanHighlights(plan, 'en').join('\n');
  assert.match(en, /Billed annually ¥1,908(\.00)? \(¥159(\.00)?\/month\)/);
  const noYm = structuredPlanHighlights({ ...plan, price_yearly_monthly: null }, 'zh').join('\n');
  assert.match(noYm, /年付 ¥1,908(\.00)?$/m);
});
