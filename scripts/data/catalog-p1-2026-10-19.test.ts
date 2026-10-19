import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SONNET_45_SHUTDOWN,
  ZHIPU_GLOBAL_PRICES,
  catalogP1SeedOptions,
  planZhipuGlobalPrices,
  withSonnetNote,
} from './catalog-p1-2026-10-19';

test('Sonnet 4.5 shutdown matches the dated API id and keeps an existing description', () => {
  assert.equal(SONNET_45_SHUTDOWN.shutdown_date, '2026-11-30');
  assert.equal(SONNET_45_SHUTDOWN.deprecated_at, '2026-09-30');
  assert.equal(SONNET_45_SHUTDOWN.replacement_model, 'claude-sonnet-5-5');
  assert.deepEqual([...SONNET_45_SHUTDOWN.slugs], ['claude-sonnet-4.5', 'anthropic-claude-sonnet-4-5']);
  const once = withSonnetNote('existing channel note');
  assert.match(once, /^existing channel note\n\[shutdown\]/);
  assert.match(once, /Bedrock/);
  assert.equal(withSonnetNote(once), once);
});

test('Z.ai prices are the verified list and a missing FlashX slug is not created', () => {
  assert.deepEqual(ZHIPU_GLOBAL_PRICES.find(row => row.slug === 'glm-5.3-flashx'), { slug: 'glm-5.3-flashx', input: 0.37, cached: 0.075, output: 1.25 });
  const plan = planZhipuGlobalPrices(
    [{ id: 1, slug: 'glm-5.3' }, { id: 2, slug: 'glm-5.2' }],
    [{ id: 9, model_id: 1, input_price_per_1m: 1, output_price_per_1m: 3, cached_input_price_per_1m: null, currency: 'USD', notes: null }],
  );
  assert.deepEqual(plan.missing.sort(), ['glm-5.3-flash', 'glm-5.3-flashx']);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].slug, 'glm-5.2');
  assert.equal(plan.updates[0].slug, 'glm-5.3');
  assert.equal(plan.updates[0].changes.input_price_per_1m.to, 1.4);
  assert.throws(() => planZhipuGlobalPrices([{ id: 1, slug: 'glm-5.3' }, { id: 2, slug: 'glm-5.3' }], []), /Duplicate model/);
});

test('P1 seed stays off the deploy path', () => {
  assert.equal(catalogP1SeedOptions([]).apply, false);
  assert.throws(() => catalogP1SeedOptions(['--apply', '--dry-run']), /Usage/);
  for (const file of ['../../deploy/production/rollout.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:catalog-p1-2026-10-19|seed-catalog-p1-2026-10-19/);
  }
});
