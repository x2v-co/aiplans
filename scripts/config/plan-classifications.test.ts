import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSelector, type SelectableModel } from '../../src/lib/plan-selector';
import { CLASSIFICATIONS } from './plan-classifications';

const catalog: SelectableModel[] = [
  { id: 1, slug: 'claude-fable-5', providerSlugs: ['anthropic'], elo: null },
  { id: 2, slug: 'claude-fable-5.1', providerSlugs: ['anthropic'], elo: null },
  { id: 3, slug: 'claude-fable-5-batch', providerSlugs: ['anthropic'], elo: null },
];

function selectedSlugs(planSlug: string): string[] {
  const classification = CLASSIFICATIONS.find(
    (entry) => entry.providerSlug === 'anthropic' && entry.planSlug === planSlug,
  );
  assert.ok(classification, `missing Anthropic classification for ${planSlug}`);

  return resolveSelector(classification.selector, catalog, ['anthropic'])
    .models.map((model) => model.slug);
}

test('Claude Max plans include Fable releases but not API batch variants', () => {
  for (const planSlug of ['claude-max', 'claude-max-5x', 'claude-max-20x']) {
    assert.deepEqual(selectedSlugs(planSlug), ['claude-fable-5', 'claude-fable-5.1']);
  }
});

test('Claude Pro does not claim the Max-only Fable family', () => {
  assert.deepEqual(selectedSlugs('claude-pro'), []);
});
