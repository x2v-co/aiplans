import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { AI_VERTICALS } from './ai-verticals';
import { AI_VERTICAL_CATALOG } from './ai-vertical-catalog';
import { STATIC_PATHS } from './sitemap-static-paths';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('decision models is a first-class model category entry', () => {
  assert.equal(AI_VERTICALS.decisionModels.href, '/decision-models');
  assert.deepEqual(AI_VERTICALS.decisionModels.label, { en: 'Decision Models', zh: '决策模型' });
});

test('home, header and search index link decision models alongside world models', () => {
  for (const file of ['../app/[locale]/home-view.tsx', '../components/SiteHeader.tsx']) {
    const src = read(file);
    assert.match(src, /\/\$\{locale\}\/world-models/, file);
    assert.match(src, /\/\$\{locale\}\/decision-models/, file);
  }
  assert.match(read('../app/api/search-index/route.ts'), /slug: 'decision-models', kind: 'decision-model'/);
});

test('sitemap covers decision models index and detail pages', () => {
  assert.ok(STATIC_PATHS.some((p) => p.path === '/decision-models'));
  assert.ok(AI_VERTICAL_CATALOG.some((i) => i.kind === 'decision-model' && i.slug));
  assert.match(read('./build-sitemap.ts'), /'decision-model'/);
});
