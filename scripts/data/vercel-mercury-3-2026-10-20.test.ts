import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeSeedTx } from './fake-seed-tx';
import { seedVercelMercury3, vercelMercury3Options } from './vercel-mercury-3-2026-10-20';

const base = { models: [{ id: 7, slug: 'inception-mercury-3' }], providers: [{ id: 40, slug: 'vercel-ai-gateway', type: 'aggregator' }] };

test('dry-run writes nothing; apply adds Vercel launch price without a fake end date; idempotent', async () => {
  const f = fakeSeedTx(base);
  assert.equal((await seedVercelMercury3(f.tx, false)).length, 1);
  assert.equal(f.writes(), 0);
  await seedVercelMercury3(f.tx, true);
  const [cp] = f.data.api_channel_prices;
  assert.deepEqual([cp.model_id, cp.provider_id, cp.input_price_per_1m, cp.output_price_per_1m, cp.cached_input_price_per_1m, cp.promo_ends_at],
    [7, 40, 0.1, 0.35, 0.01, null]);
  assert.match(String(cp.notes), /\$0\.2 \/ \$0\.7/);
  assert.deepEqual(await seedVercelMercury3(f.tx, true), []);
});

test('refuses missing model or provider', async () => {
  await assert.rejects(seedVercelMercury3(fakeSeedTx({ providers: base.providers }).tx), /nothing written/);
  await assert.rejects(seedVercelMercury3(fakeSeedTx({ models: base.models }).tx), /nothing written/);
  assert.throws(() => vercelMercury3Options(['--x']));
});
