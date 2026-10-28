import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProviderPlanPrice } from './provider-plan-price';

function render(plan: Parameters<typeof ProviderPlanPrice>[0]['plan'], showYearly = true, locale = 'zh') {
  return renderToStaticMarkup(createElement(ProviderPlanPrice, { plan, showYearly, locale, currency: 'USD' }));
}

test('annual tab does not relabel ChatGPT monthly-only prices as yearly', () => {
  for (const price of [8, 20, 100, 200, 500]) {
    const html = render({price, annual_price: null, price_unit: 'per_month'});
    assert.match(html, new RegExp(`US\\$${price}\\.00`));
    assert.match(html, /\/月/);
    assert.match(html, /暂无年付报价/);
    assert.doesNotMatch(html, /\/年|\/year/);
  }
});

test('annual quote and monthly quote keep their own units and amounts', () => {
  const plan = {price: 30, annual_price: 300, price_unit: 'per_month'};
  assert.match(render(plan), /US\$300\.00/);
  assert.match(render(plan), /\/年/);
  assert.match(render(plan), /（US\$25\.00\/月）/);
  assert.doesNotMatch(render(plan, false), /年付价格折算到每月/);
  assert.doesNotMatch(render(plan), /暂无年付报价/);
  assert.match(render(plan, false), /US\$30\.00/);
  assert.match(render(plan, false), /\/月/);
  assert.match(render({...plan, price: null}), /US\$300\.00/);
  assert.match(render({price: 30, price_yearly_monthly: 25, price_unit: 'per_month'}), /US\$300\.00/);
});

test('free, contact sales, unknown and usage prices are not annualized', () => {
  assert.match(render({price: '0', price_unit: 'per_month'}), /免费/);
  assert.doesNotMatch(render({price: 0, price_unit: 'per_month'}), /\/年|暂无年付报价/);
  const sales = render({price: 0, annual_price: 300, is_contact_sales: true});
  assert.match(sales, /按需报价/);
  assert.doesNotMatch(sales, /US\$|免费|\/年/);
  assert.match(render({price: null}), /价格未知/);
  assert.match(render({price: 2, price_unit: 'per_1m_tokens'}), /\/per 1m tokens/);
  assert.doesNotMatch(render({price: 2, price_unit: 'per_1m_tokens'}), /\/年/);
});

test('English uses the same annual fallback and zero-valued annual prices are retained', () => {
  assert.match(render({price: 20, price_unit: 'per_month'}, true, 'en'), /\/mo/);
  assert.match(render({price: 20, price_unit: 'per_month'}, true, 'en'), /Annual price unavailable/);
  assert.match(render({price: 30, annual_price: 300}, true, 'en'), /\/year/);
  assert.match(render({price: 30, annual_price: 300}, true, 'en'), /\(\$25\.00\/mo\)/);
  assert.match(render({price: 30, annual_price: 0}), /免费/);
});
