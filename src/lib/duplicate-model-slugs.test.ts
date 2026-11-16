import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalModelSlug, DUPLICATE_MODEL_SLUGS, isDuplicateModelSlug, JUNK_MODEL_SLUGS } from './duplicate-model-slugs';
import { LEGACY_MODEL_SLUGS } from './legacy-slug-redirects';
import { modelShouldIndex, selectSeoModels } from './seo-index-policy';
import { facts } from './seo-index-policy.test';

test('duplicate map has no chains, self-links, aliases or legacy-redirected targets', () => {
  for (const [dup, canonical] of Object.entries(DUPLICATE_MODEL_SLUGS)) {
    assert.notEqual(dup, canonical, dup);
    assert.ok(!isDuplicateModelSlug(canonical), `${dup} -> ${canonical} chains`);
    assert.ok(!canonical.startsWith('~') && !dup.startsWith('~'), dup);
    // A legacy 301 wins before metadata runs, so a canonical there would never render.
    assert.ok(!Object.hasOwn(LEGACY_MODEL_SLUGS, dup), `${dup} is also a legacy redirect`);
    assert.ok(!Object.hasOwn(LEGACY_MODEL_SLUGS, canonical), `${canonical} is a legacy redirect`);
    assert.ok(!JUNK_MODEL_SLUGS.has(canonical), canonical);
  }
});

test('known duplicate pairs resolve to the row that ranks', () => {
  assert.equal(canonicalModelSlug('claude-opus-5:batch'), 'anthropic-claude-opus-5-batch');
  assert.equal(canonicalModelSlug('gpt-5.2-(batch)'), 'openai-gpt-5-2-batch');
  assert.equal(canonicalModelSlug('openai-gpt-5-4'), 'gpt-5.4');
  assert.equal(canonicalModelSlug('kimi-k3us-geo-pinned'), 'kimi-k3-us-geo-pinned');
  assert.equal(canonicalModelSlug('gpt-5.4'), 'gpt-5.4');
});

test('duplicates leave the sitemap but keep their robots tag; junk rows are noindex', () => {
  const priced = { api_price_count: 1 };
  const dup = facts({ slug: 'openai-gpt-5-4', ...priced });
  const canonical = facts({ slug: 'gpt-5.4', ...priced });
  assert.deepEqual(selectSeoModels([dup, canonical]).map(row => row.slug), ['gpt-5.4']);
  assert.equal(modelShouldIndex(dup), true);
  const junk = facts({ slug: 'chat', ...priced });
  assert.equal(modelShouldIndex(junk), false);
  assert.equal(selectSeoModels([junk]).length, 0);
});

test('model page metadata canonicalizes duplicate rows', () => {
  const page = readFileSync('src/app/[locale]/models/[slug]/page.tsx', 'utf8');
  assert.match(page, /path: `\/models\/\$\{canonicalModelSlug\(slug\)\}`/);
});
