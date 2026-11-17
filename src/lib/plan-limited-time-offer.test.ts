import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanLimitedTimeOfferMark } from '@/components/plan-limited-time-offer';
import { planLimitedTimeOffer, planHasLimitedTimeOffer, filterPlanOffers, type PlanOfferRow } from './plan-limited-time-offer';
import { loadQueryModule } from './test-helpers/query-module';

const cutoff = '2026-12-01T08:00:00Z';
const before = new Date('2026-11-30T00:00:00Z');
const at = new Date(cutoff);
const plan: PlanOfferRow = { pricing_model: 'subscription', price: 10, regular_price: 20,
  price_unit: 'per_month', annual_price: 100, regular_annual_price: 200, currency: 'USD', promo_ends_at: cutoff };

test('subscription metadata is explicit, strictly discounted and immutable at the expiry boundary', () => {
  const original = structuredClone(plan);
  assert.deepEqual(planLimitedTimeOffer(plan, before)?.current, 10);
  assert.equal(planLimitedTimeOffer(plan, new Date(at.getTime() - 1))?.regular, 20);
  for (const now of [at, new Date(at.getTime() + 1)]) {
    assert.equal(planLimitedTimeOffer(plan, now), null);
    assert.equal(planHasLimitedTimeOffer(plan, now), false);
  }
  for (const fields of [
    { pricing_model: null }, { pricing_model: 'token_pack' }, { is_contact_sales: true }, { tier: 'enterprise' },
    { price: null }, { price: -1 }, { price: NaN }, { price: Infinity },
    { regular_price: null }, { regular_price: 10 }, { regular_price: 5 }, { regular_price: Infinity },
    { promo_ends_at: null }, { promo_ends_at: 'invalid' }, { price_unit: null }, { price_unit: 'per_1m_tokens' },
  ]) assert.equal(planLimitedTimeOffer({ ...plan, ...fields }, before), null, JSON.stringify(fields));
  assert.equal(planLimitedTimeOffer({ ...plan, price: 0 }, before)?.current, 0);
  assert.deepEqual(plan, original, 'no price or metadata mutation');
});

test('monthly and annual prices cannot be substituted for each other or mistaken for a promotion', () => {
  assert.equal(planLimitedTimeOffer(plan, before, 'en', true)?.current, 100);
  assert.equal(planLimitedTimeOffer(plan, before, 'en', true)?.regular, 200);
  assert.equal(planLimitedTimeOffer(plan, before, 'en', true)?.unit, 'per_year');
  assert.equal(planLimitedTimeOffer({ ...plan, annual_price: null, price_yearly_monthly: 8 }, before, 'en', true)?.current, 96);
  assert.equal(planLimitedTimeOffer({ ...plan, regular_annual_price: null }, before, 'en', true), null);
  assert.equal(planLimitedTimeOffer({ ...plan, annual_price: null }, before, 'en', true)?.unit, 'per_month');
  assert.equal(planLimitedTimeOffer({ ...plan, regular_price: null, regular_annual_price: null }, before), null);
  const rows = [{ ...plan, id: 1 }, { ...plan, id: 2, promo_ends_at: '2020-01-01' },
    { ...plan, id: 3, regular_price: null }, { id: 4, price: 20, annual_price: 100 }];
  assert.deepEqual(filterPlanOffers(rows, before).map(row => row.id), [1, 3], 'annual-only offers qualify too');
  assert.deepEqual(filterPlanOffers(rows, at), []);
});

test('real server component prints both languages, price periods, source timezone, no coupon and nothing at expiry', () => {
  for (const locale of ['zh', 'en']) for (const yearly of [false, true]) {
    const html = renderToStaticMarkup(createElement(PlanLimitedTimeOfferMark, { plan, locale, now: before, yearly }));
    assert.match(html, locale === 'zh' ? /限时优惠/ : /Limited-time offer/);
    assert.match(html, locale === 'zh' ? /现价/ : /Now/);
    assert.match(html, locale === 'zh' ? /原价/ : /Was/);
    assert.match(html, yearly ? /\$100.*\$200/ : /\$10.*\$20/);
    assert.match(html, yearly ? (locale === 'zh' ? /年/ : /year/) : (locale === 'zh' ? /月/ : /month/));
    assert.match(html, /dateTime="2026-12-01T08:00:00.000Z"/);
    assert.match(html, locale === 'zh' ? /2026-11-30/ : /Nov 30, 2026/);
    assert.doesNotMatch(html, /coupon|优惠码|<script/i);
    assert.equal(renderToStaticMarkup(createElement(PlanLimitedTimeOfferMark, { plan, locale, now: at, yearly })), '');
  }
  const cn = planLimitedTimeOffer({ ...plan, providers: { slug: 'deepseek', region: 'china' } }, before, 'zh');
  assert.equal(cn?.timeZone, 'Asia/Shanghai');
  assert.equal(cn?.endsOn, '2026-12-01');
});

test('plan filter query reads optional metadata without requiring migration or altering prices', async () => {
  let statement = '';
  const sql = async (strings: TemplateStringsArray) => {
    statement = strings.join('?');
    return [{ ...plan, id: 1, provider_id: 7 }, { ...plan, id: 2, provider_id: 8, promo_ends_at: '2020-01-01' },
      { ...plan, id: 3, provider_id: 9, regular_price: null, regular_annual_price: null }, { id: 4, provider_id: 10 }];
  };
  const mod = loadQueryModule(new URL('./plan-offers-query.ts', import.meta.url), { './db': { sql } });
  const rows = await (mod.getActivePlanOffers as (now: Date) => Promise<{ id: number }[]>)(before);
  assert.deepEqual(Array.from(rows, row => row.id), [1]);
  for (const column of ['promo_ends_at', 'regular_price', 'regular_annual_price']) assert.ok(statement.includes(`to_jsonb(pl)->>'${column}'`));
  assert.match(statement, /pricing_model = 'subscription'/);
  assert.match(statement, /legacy_ends_on/);
  assert.match(statement, /superseded-by/);
  assert.doesNotMatch(statement, /\b(?:UPDATE|INSERT|DELETE)\b/);
});

test('additive DDL and deployment migration registry contain no price/data backfill', () => {
  const ddl = readFileSync(new URL('../../drizzle/0017_plan_promotions.sql', import.meta.url), 'utf8');
  assert.equal((ddl.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, 3);
  assert.doesNotMatch(ddl, /\b(?:UPDATE|INSERT|DELETE|DROP|DEFAULT)\b/i);
  const registry = readFileSync(new URL('../../scripts/migrate-data-accuracy.ts', import.meta.url), 'utf8');
  assert.match(registry, /040_plan_promotion_display_metadata/);
  assert.match(registry, /drizzle\/0017_plan_promotions.sql/);
});
