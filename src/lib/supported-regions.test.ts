import assert from 'node:assert/strict';
import test from 'node:test';
import {
  derivePlanRegions, deriveProviderRegions, shouldShowChinaBadge,
  formatAvailableIn, sourcedChinaAccess, chinaAccessMark,
} from './supported-regions';

const sourced = (regions: string[]) => ({
  supported_regions: regions, regions_source_url: 'https://example.com/supported-countries',
  regions_verified_at: '2026-11-05T00:00:00Z',
});

test('plan > provider > legacy, including researched empty and unsourced plan lists', () => {
  const provider = sourced(['CN', 'US']);
  assert.deepEqual(derivePlanRegions(sourced(['US']), provider).regions, ['US']);
  assert.deepEqual(derivePlanRegions({}, provider).regions, ['CN', 'US']);
  const empty = derivePlanRegions(sourced([]), provider);
  assert.deepEqual(empty.regions, []);
  assert.equal(empty.includesChina, false);
  const unsourced = derivePlanRegions({ supported_regions: ['CN'] }, provider);
  assert.equal(unsourced.hasSource, false);
  assert.equal(unsourced.sourceUrl, null);
  assert.equal(shouldShowChinaBadge(unsourced, 'zh'), false);
  assert.equal(formatAvailableIn(unsourced, { locale: 'en' }), null);
});

test('legacy booleans, pricing URLs, home region and verification alone establish no country support', () => {
  for (const value of [true, false, null]) {
    const evidence = derivePlanRegions({ access_from_china: value,
      last_verified: '2026-11-05', notes: 'Source: https://example.com/pricing' });
    assert.equal(evidence.regions, null);
    assert.equal(evidence.includesChina, null);
    assert.equal(evidence.hasSource, false);
    assert.equal(sourcedChinaAccess(evidence), null);
    assert.equal(chinaAccessMark(evidence), '—');
  }
  assert.equal(deriveProviderRegions(null).includesChina, null);
});

test('legacy fallback requires an explicit matching decision, support URL and verification date', () => {
  const legacy = { access_from_china: true,
    notes: 'China access: true; Source: https://example.com/supported-countries',
    last_verified: '2026-11-05' };
  const evidence = derivePlanRegions(legacy);
  assert.equal(evidence.includesChina, true);
  assert.equal(evidence.hasSource, true);
  assert.equal(evidence.regions, null); // a CN decision cannot invent other countries
  assert.equal(formatAvailableIn(evidence, { locale: 'en' }), null);
  assert.equal(derivePlanRegions({ ...legacy, last_verified: null }).includesChina, null);
  assert.equal(derivePlanRegions({ ...legacy, access_from_china: false }).includesChina, null);
  assert.deepEqual(derivePlanRegions(legacy, sourced(['US'])).regions, ['US']);
  assert.deepEqual(derivePlanRegions(sourced([]), legacy).regions, []);
});

test('China badges require zh, a source and CN; English never gets a China badge', () => {
  for (const regions of [[], ['US'], ['CN']]) {
    const evidence = deriveProviderRegions(sourced(regions));
    assert.equal(shouldShowChinaBadge(evidence, 'zh'), regions.includes('CN'));
    assert.equal(shouldShowChinaBadge(evidence, 'en'), false);
  }
  for (const regions_source_url of [null, '', 'javascript:alert(1)', 'not a url']) {
    const evidence = deriveProviderRegions({ ...sourced(['CN']), regions_source_url });
    assert.equal(shouldShowChinaBadge(evidence, 'zh'), false);
    assert.equal(chinaAccessMark(evidence), '—');
  }
  assert.equal(chinaAccessMark(), '—');
  assert.equal(chinaAccessMark(deriveProviderRegions(sourced(['CN']))), '✓');
  assert.equal(chinaAccessMark(deriveProviderRegions(sourced(['US']))), '✗');
});

test('Available in is absent without evidence, compact for small lists and folded for large lists', () => {
  assert.equal(formatAvailableIn(derivePlanRegions({}), { locale: 'en' }), null);
  assert.equal(formatAvailableIn(derivePlanRegions(sourced(['US', 'CN', 'US'])), { locale: 'en' }), 'US, CN');
  const countries = 'US CN JP KR SG MY TH VN ID PH IN GB FR DE IT ES PT NL BE AT CH SE NO DK FI PL'.split(' ');
  const evidence = derivePlanRegions(sourced(countries));
  assert.equal(formatAvailableIn(evidence, { locale: 'en' }), '20+ countries');
  assert.equal(formatAvailableIn(evidence, { locale: 'zh' }), '20+ 个国家/地区');
  assert.equal(formatAvailableIn(evidence, { locale: 'en', maxList: 30 }), countries.join(', '));
  assert.equal(formatAvailableIn(derivePlanRegions(sourced([])), { locale: 'en' }), '0 countries');
});
