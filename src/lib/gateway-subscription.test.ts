import assert from 'node:assert/strict';
import test from 'node:test';
import { gatewayEffectiveRate, gatewaySubscriptionEconomics, gatewaySubscriptionSummary } from './gateway-subscription';
import { groupPlansByKind, normalizePlanKind, planKindLabel } from './plan-kinds';

const tokenPass = { plan_kind: 'gateway_subscription', price: 30, currency: 'USD', monthly_api_credit_usd: 80, has_overage_pricing: false };

test('Token Pass economics come from fee and credit only', () => {
  const e = gatewaySubscriptionEconomics(tokenPass)!;
  assert.equal(e.costFactor, 0.375);
  assert.ok(Math.abs(e.creditMultiple - 80 / 30) < 1e-12);
  assert.equal(e.hardStop, true);
  assert.equal(gatewayEffectiveRate(2, e), 0.75);
});

test('non-gateway, non-USD or incomplete plans yield null', () => {
  assert.equal(gatewaySubscriptionEconomics({ ...tokenPass, plan_kind: 'coding' }), null);
  assert.equal(gatewaySubscriptionEconomics({ ...tokenPass, currency: 'CNY' }), null);
  assert.equal(gatewaySubscriptionEconomics({ ...tokenPass, monthly_api_credit_usd: null }), null);
  assert.equal(gatewaySubscriptionEconomics({ ...tokenPass, price: 0 }), null);
});

test('overage unknown is not shown as a hard stop', () => {
  assert.equal(gatewaySubscriptionEconomics({ ...tokenPass, has_overage_pricing: null })!.hardStop, false);
});

test('summary is localized', () => {
  const e = gatewaySubscriptionEconomics(tokenPass)!;
  assert.deepEqual(gatewaySubscriptionSummary(e, 'zh'), ['每月 $30 换 $80 额度（2.67×）', '额度用满时，等效价 = 网关单价 × 0.375', '用完即停，无超额计费']);
  assert.match(gatewaySubscriptionSummary(e, 'en')[0], /\$30\/mo buys \$80 credit/);
});

test('gateway_subscription is its own plan kind section', () => {
  assert.equal(normalizePlanKind('gateway_subscription'), 'gateway_subscription');
  assert.equal(planKindLabel('gateway_subscription', 'zh'), '网关订阅');
  const groups = groupPlansByKind([{ k: 'coding' }, { k: 'gateway_subscription' }, { k: 'token_pack' }], p => p.k);
  assert.deepEqual(groups.map(g => g.kind), ['coding', 'token_pack', 'gateway_subscription']);
});
