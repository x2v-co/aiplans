import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LimitedTimeOfferMark } from '../components/limited-time-offer';
import {
  applyPromoFilter,
  filteredListMetadata,
  filterLimitedTimeOffers,
  isPromoFilter,
  limitedTimeOffer,
  promoFilterHref,
  type LimitedTimeOfferRow,
} from './limited-time-offer';
import { buildMetadata } from './seo';

const cutoff = '2026-12-01T08:00:00Z';
const before = new Date('2026-11-30T00:00:00Z');
const atCutoff = new Date(cutoff);

const active: LimitedTimeOfferRow = {
  input_price_per_1m: 2,
  output_price_per_1m: 10,
  cached_input_price_per_1m: 0.1,
  promo_ends_at: cutoff,
  regular_input_price_per_1m: 4,
  regular_output_price_per_1m: 20,
  regular_cached_input_price_per_1m: 0.2,
  currency: 'USD',
};

const model = (row: LimitedTimeOfferRow | null, slug = 'm') => ({
  slug,
  versions: row ? [row] : [],
});

test('offer disappears at promo_ends_at and does not change the stored price', () => {
  const row = { ...active };
  const shown = limitedTimeOffer(row, before, 'en');
  assert.equal(shown?.lines.find(line => line.kind === 'input')?.current, 2);
  assert.equal(shown?.lines.find(line => line.kind === 'input')?.regular, 4);
  assert.equal(shown?.endsOn, 'Nov 30, 2026');
  assert.equal(limitedTimeOffer(row, atCutoff, 'en'), null);
  assert.equal(limitedTimeOffer(row, new Date(atCutoff.getTime() + 1), 'zh'), null);
  assert.equal(limitedTimeOffer({ ...active, promo_ends_at: null }, before), null);
  assert.equal(limitedTimeOffer({ ...active, promo_ends_at: 'not-a-date' }, before), null);
  assert.equal(limitedTimeOffer({
    ...active,
    regular_input_price_per_1m: null,
    regular_output_price_per_1m: null,
  }, before), null);
  assert.deepEqual(row, active);
});

test('mark renders current price, regular price and end date, then nothing after expiry', () => {
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(LimitedTimeOfferMark, { row: active, locale, now: before }));
    assert.match(html, locale === 'zh' ? /限时优惠/ : /Limited-time offer/);
    assert.match(html, locale === 'zh' ? /现价/ : /now/);
    assert.match(html, locale === 'zh' ? /原价/ : /was/);
    assert.match(html, /\$2/);
    assert.match(html, /\$4/);
    assert.match(html, /\$10/);
    assert.match(html, /\$20/);
    assert.match(html, locale === 'zh' ? /2026-11-30/ : /Nov 30, 2026/);
    assert.doesNotMatch(html, /coupon|优惠码|code/i);
    assert.equal(renderToStaticMarkup(createElement(LimitedTimeOfferMark, { row: active, locale, now: atCutoff })), '');
  }
});

test('promo filter keeps only models with an unexpired offer', () => {
  const expired = model({ ...active, promo_ends_at: '2026-10-01T00:00:00Z' }, 'expired');
  const plain = model({ input_price_per_1m: 1, output_price_per_1m: 2, promo_ends_at: null }, 'plain');
  const live = model(active, 'live');
  const missingRegular = model({ ...active, regular_input_price_per_1m: null, regular_output_price_per_1m: null }, 'partial');
  const rows = [live, expired, plain, missingRegular];
  assert.deepEqual(filterLimitedTimeOffers(rows, before).map(item => item.slug), ['live']);
  assert.deepEqual(filterLimitedTimeOffers(rows, atCutoff).map(item => item.slug), []);
  const off = applyPromoFilter(rows, undefined, before);
  assert.equal(off.filtered, false);
  assert.equal(off.models.length, 4);
  const on = applyPromoFilter(rows, '1', before);
  assert.equal(on.filtered, true);
  assert.deepEqual(on.models.map(item => item.slug), ['live']);
  assert.equal(isPromoFilter('1'), true);
  assert.equal(isPromoFilter(['1']), true);
  assert.equal(isPromoFilter('true'), false);
  assert.equal(isPromoFilter(undefined), false);
});

test('filtered list metadata is noindex and canonical points at the unfiltered page', () => {
  const filtered = filteredListMetadata('zh', '/models', true);
  assert.deepEqual(filtered.robots, {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  });
  assert.equal(filtered.alternates?.canonical, 'https://aiplans.dev/zh/models');
  assert.equal(String(filtered.alternates?.canonical).includes('promo'), false);
  assert.deepEqual(filteredListMetadata('en', '/api-pricing', false), {});

  const catalog = buildMetadata({
    locale: 'en',
    path: '/models',
    title: { en: 'Models', zh: '模型' },
    description: { en: 'Catalog', zh: '目录' },
    noindex: true,
  });
  const robots = catalog.robots as { index?: boolean };
  assert.equal(robots.index, false);
  assert.equal(catalog.alternates?.canonical, 'https://aiplans.dev/en/models');
});

test('promo toggle href adds and removes only the promo parameter', () => {
  assert.equal(promoFilterHref('en', '/models', false), '/en/models?promo=1');
  assert.equal(promoFilterHref('zh', '/models', true), '/zh/models');
  assert.equal(
    promoFilterHref('en', '/api-pricing', false, { q: 'claude', sort: 'price', promo: '1' }),
    '/en/api-pricing?q=claude&sort=price&promo=1',
  );
  assert.equal(
    promoFilterHref('en', '/api-pricing', true, { q: 'claude', china: '1' }),
    '/en/api-pricing?q=claude&china=1',
  );
});

test('offer pages stay dynamic and filtered lists opt out of indexing', () => {
  const modelPage = readFileSync(new URL('../app/[locale]/models/[slug]/page.tsx', import.meta.url), 'utf8');
  const modelList = readFileSync(new URL('../app/[locale]/models/page.tsx', import.meta.url), 'utf8');
  const apiPricing = readFileSync(new URL('../app/[locale]/api-pricing/page.tsx', import.meta.url), 'utf8');
  for (const source of [modelPage, modelList, apiPricing]) {
    assert.match(source, /export const dynamic = 'force-dynamic'/);
  }
  assert.match(modelPage, /LimitedTimeOfferMark/);
  assert.match(modelList, /applyPromoFilter/);
  assert.match(modelList, /noindex: promoFiltered/);
  assert.match(apiPricing, /filteredListMetadata/);
  assert.match(apiPricing, /applyPromoFilter/);
  const schema = readFileSync(new URL('../db/schema/index.ts', import.meta.url), 'utf8');
  const plans = schema.slice(schema.indexOf("pgTable('plans'"), schema.indexOf("pgTable('api_channel_prices'"));
  assert.doesNotMatch(plans, /promo_ends_at|regular_input_price_per_1m|regular_output_price_per_1m/);
  const channels = schema.slice(schema.indexOf("pgTable('api_channel_prices'"), schema.indexOf("pgTable('api_channel_price_variants'"));
  assert.match(channels, /promo_ends_at/);
  assert.match(channels, /regular_input_price_per_1m/);
  assert.match(channels, /regular_output_price_per_1m/);
  assert.match(channels, /regular_cached_input_price_per_1m/);
});
