import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMetadata } from './seo';

const base = {
  locale: 'en' as const,
  path: '/compare/plans/moonshotai-kimi-k2',
  title: { en: 'Kimi K2 plans', zh: 'Kimi K2 套餐' },
  description: { en: 'Compare plans', zh: '比较套餐' },
};

test('noindex pages stay followable so link equity reaches the current pages', () => {
  assert.deepEqual(buildMetadata({ ...base, noindex: true }).robots, { index: false, follow: true });
});

test('indexable pages keep index, follow', () => {
  const robots = buildMetadata(base).robots;
  assert.equal(typeof robots === 'object' && robots?.index, true);
  assert.equal(typeof robots === 'object' && robots?.follow, true);
});
