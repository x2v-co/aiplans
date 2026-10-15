import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildMinimaxPlans } from './plan-minimax-dynamic';
import { buildMinimaxGlobalPlans } from './plan-minimax-global-dynamic';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

test('China M Plan fixture (2026-10-15) yields regular CNY prices, not first-month offer', () => {
  const r = buildMinimaxPlans(fixture('minimax-mplan-offer-cn.md'));
  assert.equal(r.success, true);
  assert.deepEqual(r.plans.map(p => [p.planSlug, p.priceMonthly, p.currency]), [
    ['minimax-mplan-go', 49, 'CNY'], ['minimax-mplan-explore', 119, 'CNY'], ['minimax-mplan-build', 469, 'CNY'],
  ]);
});

test('Global M Plan fixture (2026-10-15) yields regular USD prices', () => {
  const r = buildMinimaxGlobalPlans(fixture('minimax-mplan-offer-global.md'));
  assert.equal(r.success, true);
  assert.deepEqual(r.plans.map(p => [p.planSlug, p.priceMonthly, p.currency]), [
    ['minimax-global-mplan-go', 22, 'USD'], ['minimax-global-mplan-explore', 55, 'USD'], ['minimax-global-mplan-build', 132, 'USD'],
  ]);
});

test('missing tier row fails instead of returning partial plans', () => {
  const md = fixture('minimax-mplan-offer-cn.md').replace(/^\| Build .*$/m, '');
  const r = buildMinimaxPlans(md);
  assert.equal(r.success, false);
  assert.deepEqual(r.plans, []);
});
