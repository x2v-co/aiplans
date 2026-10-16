import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGatewaySectionRows, gatewaySectionCopy } from './gateway-subscription-section';

const tp = { id: 2253, name: 'Token Pass', provider_name: 'Vercel AI Gateway', provider_slug: 'vercel-ai-gateway',
  plan_kind: 'gateway_subscription', price: 30, currency: 'USD', monthly_api_credit_usd: 80 };

test('Token Pass row: price, credit, multiple, provider link', () => {
  assert.deepEqual(buildGatewaySectionRows([tp], 'en'), [{ id: 2253, name: 'Token Pass', providerName: 'Vercel AI Gateway',
    href: '/en/providers/vercel-ai-gateway', priceText: '$30/mo', creditText: '$80 credit', multipleText: '2.67×' }]);
  const zh = buildGatewaySectionRows([tp], 'zh')[0];
  assert.equal(zh.priceText, '$30/月');
  assert.equal(zh.creditText, '$80 额度');
  assert.equal(zh.href, '/zh/providers/vercel-ai-gateway');
});

test('no gateway plans => empty (section hidden); invalid ones dropped', () => {
  assert.deepEqual(buildGatewaySectionRows([], 'en'), []);
  assert.deepEqual(buildGatewaySectionRows([{ ...tp, plan_kind: 'coding' }, { ...tp, currency: 'CNY' }, { ...tp, monthly_api_credit_usd: null }], 'en'), []);
});

test('sorted by best multiple', () => {
  const rows = buildGatewaySectionRows([tp, { ...tp, id: 1, name: 'X', price: 10, monthly_api_credit_usd: 50 }], 'en');
  assert.deepEqual(rows.map(r => r.name), ['X', 'Token Pass']);
});

test('copy localized', () => {
  assert.equal(gatewaySectionCopy('zh').title, '网关订阅');
  assert.equal(gatewaySectionCopy('en').title, 'Gateway subscriptions');
});
