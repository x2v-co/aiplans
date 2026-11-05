import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_REGIONS_2026_11_05, seedSupportedRegions, validateRegionSpec } from './supported-regions-2026-11-05';
import { fakeSeedTx } from './fake-seed-tx';
import { deriveProviderRegions, shouldShowChinaBadge } from '../../src/lib/supported-regions';

const CN_SLUGS = ['deepseek', 'qwen', 'moonshot-china', 'minimax-china', 'zhipu-china', 'stepfun', 'seed', 'hunyuan', 'baidu', 'siliconflow'];
const GLOBAL3 = ['openai', 'anthropic', 'google'];

const providers = () => [
  { id: 1, slug: 'openai', name: 'OpenAI', access_from_china: false, notes: 'keep', region: 'global' },
  { id: 2, slug: 'anthropic', name: 'Anthropic', access_from_china: false, notes: null, region: 'global' },
  { id: 3, slug: 'google', name: 'Google', access_from_china: true, notes: null, region: 'global' },
  ...CN_SLUGS.map((slug, i) => ({ id: 10 + i, slug, name: slug, access_from_china: true, notes: null, region: 'china' })),
  { id: 99, slug: 'moonshot-global', name: 'Kimi Global', access_from_china: true, notes: null, region: 'global' },
];
const N = 3 + CN_SLUGS.length;

test('specs: official https source, uppercase alpha-2, no CN for these vendors', () => {
  assert.deepEqual(SUPPORTED_REGIONS_2026_11_05.slice(0, 3).map(s => [s.slug, s.regions.length]), [['openai', 208], ['anthropic', 185], ['google', 229]]);
  for (const spec of SUPPORTED_REGIONS_2026_11_05.filter(s => GLOBAL3.includes(s.slug))) {
    validateRegionSpec(spec);
    for (const c of ['CN', 'RU', 'IR', 'KP', 'CU', 'SY']) assert.ok(!spec.regions.includes(c), `${spec.slug} ${c}`);
    assert.ok(spec.regions.includes('US'));
  }
});

test('Chinese vendors: exactly CN with https source; global twins absent', () => {
  const cn = SUPPORTED_REGIONS_2026_11_05.filter(s => !GLOBAL3.includes(s.slug));
  assert.deepEqual(cn.map(s => s.slug), CN_SLUGS);
  for (const spec of cn) { validateRegionSpec(spec); assert.deepEqual(spec.regions, ['CN']); }
  for (const slug of ['moonshot-global', 'minimax-global', 'zhipu-global']) {
    assert.ok(!SUPPORTED_REGIONS_2026_11_05.some(s => s.slug === slug), slug);
  }
});

test('writes only the three region fields, then a rerun changes nothing', async () => {
  const { tx, data, writes } = fakeSeedTx({ providers: providers() });
  const before = structuredClone(data.providers);
  const first = await seedSupportedRegions(tx);
  assert.equal(first.length, N);
  assert.ok(first.every(s => s.action === 'update'));
  for (const row of data.providers) {
    if (row.slug === 'moonshot-global') { assert.equal(row.supported_regions ?? null, null, 'global twin untouched'); continue; }
    const old = before.find(r => r.id === row.id)!;
    const changed = Object.keys(row).filter(k => JSON.stringify(row[k]) !== JSON.stringify(old[k])).sort();
    assert.deepEqual(changed, ['regions_source_url', 'regions_verified_at', 'supported_regions']);
    assert.equal(row.access_from_china, old.access_from_china, 'access_from_china untouched');
    const evidence = deriveProviderRegions(row as never);
    assert.equal(evidence.hasSource, true);
    assert.equal(shouldShowChinaBadge(evidence, 'zh'), CN_SLUGS.includes(row.slug));
    assert.equal(shouldShowChinaBadge(evidence, 'en'), false);
  }
  const n = writes();
  const second = await seedSupportedRegions(tx);
  assert.ok(second.every(s => s.action === 'unchanged'));
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
