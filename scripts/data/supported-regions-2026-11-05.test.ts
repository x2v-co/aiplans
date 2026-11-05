import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_REGIONS_2026_11_05, seedSupportedRegions, validateRegionSpec } from './supported-regions-2026-11-05';
import { fakeSeedTx } from './fake-seed-tx';
import { deriveProviderRegions, shouldShowChinaBadge } from '../../src/lib/supported-regions';

const providers = () => [
  { id: 1, slug: 'openai', name: 'OpenAI', access_from_china: false, notes: 'keep', region: 'global' },
  { id: 2, slug: 'anthropic', name: 'Anthropic', access_from_china: false, notes: null, region: 'global' },
  { id: 3, slug: 'google', name: 'Google', access_from_china: true, notes: null, region: 'global' },
];

test('specs: official https source, uppercase alpha-2, no CN for these vendors', () => {
  assert.deepEqual(SUPPORTED_REGIONS_2026_11_05.map(s => [s.slug, s.regions.length]), [['openai', 208], ['anthropic', 185], ['google', 229]]);
  for (const spec of SUPPORTED_REGIONS_2026_11_05) {
    validateRegionSpec(spec);
    for (const c of ['CN', 'RU', 'IR', 'KP', 'CU', 'SY']) assert.ok(!spec.regions.includes(c), `${spec.slug} ${c}`);
    assert.ok(spec.regions.includes('US'));
  }
});

test('writes only the three region fields, then a rerun changes nothing', async () => {
  const { tx, data, writes } = fakeSeedTx({ providers: providers() });
  const before = structuredClone(data.providers);
  const first = await seedSupportedRegions(tx);
  assert.deepEqual(first.map(s => s.action), ['update', 'update', 'update']);
  for (const row of data.providers) {
    const old = before.find(r => r.id === row.id)!;
    const changed = Object.keys(row).filter(k => JSON.stringify(row[k]) !== JSON.stringify(old[k])).sort();
    assert.deepEqual(changed, ['regions_source_url', 'regions_verified_at', 'supported_regions']);
    assert.equal(row.access_from_china, old.access_from_china, 'access_from_china untouched');
    const evidence = deriveProviderRegions(row as never);
    assert.equal(evidence.hasSource, true);
    assert.equal(shouldShowChinaBadge(evidence, 'zh'), false);
  }
  const n = writes();
  const second = await seedSupportedRegions(tx);
  assert.deepEqual(second.map(s => s.action), ['unchanged', 'unchanged', 'unchanged']);
  assert.equal(writes(), n, 'rerun issues no writes');
});

test('refuses to write without a source URL or with bad codes', async () => {
  const base = { table: 'providers' as const, slug: 'openai', regions: ['US'] };
  for (const sourceUrl of ['', 'not a url', 'http://example.com/x']) {
    const { tx, writes } = fakeSeedTx({ providers: providers() });
    await assert.rejects(seedSupportedRegions(tx, [{ ...base, sourceUrl }]), /refusing to write/);
    assert.equal(writes(), 0);
  }
  for (const regions of [[], ['us'], ['USA'], ['US', 'US']]) {
    assert.throws(() => validateRegionSpec({ ...base, sourceUrl: 'https://example.com/countries', regions }));
  }
});

test('missing provider aborts before any write', async () => {
  const { tx, writes } = fakeSeedTx({ providers: providers().slice(0, 1) });
  await assert.rejects(seedSupportedRegions(tx), /not found/);
  assert.equal(writes(), 0);
});
