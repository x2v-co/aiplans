import assert from 'node:assert/strict';
import test from 'node:test';
import { localizeProvider, providerDisplayName } from './provider-display-name';

test('provider display uses existing English names first, then known mappings and preserves Chinese copy', () => {
  for (const [name, slug, english] of [
    ['月之暗面 (Moonshot/Kimi)', 'moonshot', 'Moonshot AI / Kimi'],
    ['智谱', 'zhipu-china', 'Zhipu AI / Z.ai'],
    ['智谱 AI (ChatGLM)', 'zhipu-global', 'Zhipu AI / Z.ai'],
  ]) {
    const provider = { id: 1, name, slug };
    assert.equal(providerDisplayName(provider, 'en'), english);
    assert.equal(providerDisplayName(provider, 'zh'), name);
    assert.equal(providerDisplayName({ ...provider, name_en: 'Authored English name' }, 'en'), 'Authored English name');
    assert.deepEqual(localizeProvider(provider, 'en'), { ...provider, name: english });
    assert.equal(provider.name, name);
  }
  assert.equal(providerDisplayName(null, 'en'), '');
  assert.equal(providerDisplayName({ name: 'Vendor' }, 'en'), 'Vendor');
});
