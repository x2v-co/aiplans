import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { groupModelPlansByOwnership } from '@/lib/model-plan-groups';
import { ModelPlanGroups } from './model-plan-groups';
import type { ModelPlanCardRow } from './model-plan-card';

const plan = (id: number, providerId: number, kind: string, name: string): ModelPlanCardRow => ({
  id, name, slug: `plan-${id}`, tier: 'pro', price: 20, annual_price: null,
  currency: 'USD', features: [], access_from_china: false, plan_kind: kind,
  providers: { id: providerId, name: 'Vendor', slug: `vendor-${providerId}`, logo: null },
});
// Third-party coding comes first in input; official chat/coding must both
// precede it, regardless of the product-kind order or price order.
const plans = [plan(1, 99, 'coding', 'GitHub Copilot'), plan(2, 7, 'coding', 'Official Coding'),
  plan(3, 7, 'chat', 'Official Chat'), plan(4, 99, 'chat', 'Third-party Chat')];

test('producer ownership is the outer grouping; product kinds and input ordering survive within each group', () => {
  const groups = groupModelPlansByOwnership(plans, 7);
  assert.deepEqual(groups.map(group => group.official), [true, false]);
  assert.deepEqual(groups.map(group => group.kindGroups.map(({ kind, plans }) => [kind, plans.map(p => p.id)])),
    [[['chat', [3]], ['coding', [2]]], [['chat', [4]], ['coding', [1]]]]);
  assert.deepEqual(plans.map(p => p.id), [1, 2, 3, 4]);
});

test('unknown producer and empty/one-sided results never invent official ownership or empty sections', () => {
  assert.deepEqual(groupModelPlansByOwnership([], 7), []);
  assert.deepEqual(groupModelPlansByOwnership(plans, null).map(g => g.official), [false]);
  assert.deepEqual(groupModelPlansByOwnership([plans[1]], 7).map(g => g.official), [true]);
  assert.deepEqual(groupModelPlansByOwnership([plans[0]], 7).map(g => g.official), [false]);
  assert.deepEqual(groupModelPlansByOwnership([{ providers: null, plan_kind: 'chat' }], null).map(g => g.official), [false]);
});

test('both locales render official cards before third-party cards with distinct headings and an availability qualification', () => {
  for (const locale of ['zh', 'en'] as const) {
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, {
      locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en,
      children: createElement(ModelPlanGroups, {
        groups: groupModelPlansByOwnership(plans, 7), locale, now: new Date('2026-10-30T00:00:00Z'),
        usagePrices: [], recommendedPlanIds: new Set<number>(), bestValuePlanId: null,
      }),
    }));
    const official = html.indexOf('data-plan-group="official"');
    const thirdParty = html.indexOf('data-plan-group="third-party"');
    assert.ok(official >= 0 && thirdParty > official);
    for (const id of [2, 3]) assert.ok(html.indexOf(`data-plan-card="${id}"`) < thirdParty);
    for (const id of [1, 4]) assert.ok(html.indexOf(`data-plan-card="${id}"`) > thirdParty);
    assert.match(html, locale === 'zh' ? />官方套餐<\/h3>/ : />Official plans<\/h3>/);
    assert.match(html, locale === 'zh' ? />第三方套餐<\/h3>/ : />Third-party plans<\/h3>/);
    assert.match(html, locale === 'zh' ? /不代表每个套餐均包含此型号/ : /may not include this exact model/);
    assert.equal((html.match(/data-plan-card=/g) ?? []).length, 4);
  }
});
