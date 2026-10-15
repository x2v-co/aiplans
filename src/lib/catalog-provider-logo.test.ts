import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { getCatalogProviderLogoSrc } from './provider-branding';

const names = ['Google', 'OpenAI', 'Black Forest Labs', 'ByteDance (BytePlus ModelArk)', 'ByteDance / Volcano Engine',
  'Alibaba Cloud (Qwen)', 'Microsoft', 'Ideogram', 'Recraft', 'xAI', 'Moondream', 'Runway', 'Kuaishou', 'Pika',
  'Luma AI', 'ShengShu', 'SkyReels', 'MiniMax', 'Meta', 'Tencent', 'Genmo', 'Kandinsky', 'SpaceXSI', 'Alibaba-ATH'];

test('every image/video catalog provider resolves to a bundled logo that exists', () => {
  for (const name of names) {
    const src = getCatalogProviderLogoSrc(name);
    assert.ok(src, name);
    assert.ok(existsSync(`public${src}`), `${name} -> ${src}`);
  }
  assert.equal(getCatalogProviderLogoSrc('Alibaba-ATH'), '/providers/alibaba-ath.ico');
  assert.equal(getCatalogProviderLogoSrc('Unknown'), null);
});
